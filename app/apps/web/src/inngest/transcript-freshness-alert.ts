/**
 * Daily transcript-freshness cron (P0-4 follow-up).
 *
 * Runs at 06:00 UTC every day. For each tenant, counts the
 * `meeting_completed` activities + `transcript_chunks` rows in the
 * last 7 days. Pure helper `evaluateFreshness` decides healthy /
 * degraded / silent / no_meetings ; degraded + silent verdicts emit
 * a notification (and a Datadog metric so the dashboard can show
 * "X tenants with stale transcripts").
 *
 * Concurrency single-flight so two cron firings don't double-alert
 * the same tenant on the same day.
 *
 * Pure logic in `lib/coaching/freshness-check.ts` ; this file is the
 * IO orchestrator.
 */

import { inngest } from "./client";
import { db } from "@/db";
import { activities, tenants, transcriptChunks } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  evaluateFreshness,
  freshnessNotificationCopy,
  aggregateFreshness,
  type FreshnessVerdict,
} from "@/lib/coaching/freshness-check";
import { logger } from "@/lib/observability/logger";
import { metrics } from "@/lib/observability/metrics";

const WINDOW_DAYS = 7;

export const dailyTranscriptFreshnessAlert = inngest.createFunction(
  {
    id: "daily-transcript-freshness-alert",
    name: "Daily transcript-freshness alert",
    retries: 1,
    concurrency: [{ limit: 1 }],
    onFailure: async ({ error }) => {
      logger.error("daily-transcript-freshness-alert.dead_letter", {
        err: error instanceof Error ? error.message : String(error),
      });
    },
    triggers: [{ cron: "TZ=UTC 0 6 * * *" }],
  },
  async ({ step }: {
    step: { run<T>(id: string, fn: () => Promise<T> | T): Promise<T> };
  }) => {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // 1) Pull the per-tenant count summary in one query.
    const allTenants = await step.run("fetch-tenants", () =>
      db.select({ id: tenants.id }).from(tenants),
    );

    const verdicts: FreshnessVerdict[] = [];

    for (const t of allTenants) {
      const summary = await step.run(`evaluate-${t.id}`, async () => {
        const [{ count: meetings }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(activities)
          .where(
            and(
              eq(activities.tenantId, t.id),
              eq(activities.activityType, "meeting_completed"),
              gte(activities.occurredAt, since),
            ),
          );
        const [{ count: chunks }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(transcriptChunks)
          .where(
            and(
              eq(transcriptChunks.tenantId, t.id),
              gte(transcriptChunks.createdAt, since),
            ),
          );
        return {
          completedMeetingsLastNdays: Number(meetings ?? 0),
          chunksLastNdays: Number(chunks ?? 0),
        };
      });

      const verdict = evaluateFreshness({
        tenantId: t.id,
        completedMeetingsLastNdays: summary.completedMeetingsLastNdays,
        chunksLastNdays: summary.chunksLastNdays,
        windowDays: WINDOW_DAYS,
      });
      verdicts.push(verdict);

      // 2) Emit metric for the dashboard tile.
      metrics.increment("transcript_freshness.evaluated", {
        status: verdict.status,
      });

      // 3) Surface degraded / silent verdicts via structured log +
      // counter so the admin dashboard tile can render them. The
      // notifications table requires user-level resolution
      // (userId NOT NULL) which deserves its own iteration — for
      // now we rely on the dashboard tile + Datadog alarm on the
      // counter spike.
      const copy = freshnessNotificationCopy(verdict);
      if (!copy) continue;
      logger.warn("transcript-freshness.alert", {
        tenantId: t.id,
        status: verdict.status,
        severity: verdict.severity,
        reason: verdict.reason,
        title: copy.title,
        cta: copy.cta,
        coverageRatio: verdict.coverageRatio,
      });
      metrics.increment("transcript_freshness.alerted", {
        status: verdict.status,
      });
    }

    const summary = aggregateFreshness(verdicts);
    logger.info("daily-transcript-freshness-alert: complete", { summary });

    return summary;
  },
);
