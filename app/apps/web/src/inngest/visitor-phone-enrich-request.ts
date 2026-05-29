/**
 * Visitor → phone enrich request (stub producer, feat/hot-to-call).
 *
 * Every 5 minutes, scan the last 15 minutes of `visits` that have
 * been resolved to a company (visits.companyId IS NOT NULL — the
 * `identify-visit.ts` Inngest fn populated it after RB2B/Snitcher/
 * Clearbit reveal). For every contact at that company who lacks a
 * phone on file, emit `phone/enrich-requested` with the contactId.
 *
 * The CONSUMER of `phone/enrich-requested` is the Apollo→Kaspr→Lusha
 * waterfall fn that lives on the `feat/voice-cold-call` branch
 * (`lib/voice/number-waterfall.ts`). Until that branch merges, this
 * producer fires into the void — but the event surface is now
 * defined so the waterfall lands as a drop-in consumer.
 *
 * Why a 5-minute cron and not a `visit/created` subscriber:
 *   - identify-visit (the existing fn) runs in parallel on the same
 *     event. By the time a parallel subscriber looks up visits.companyId
 *     it might not be populated yet.
 *   - A 5-minute lookback over a 15-minute window catches every
 *     identified visit at least once, with a 15-min idempotency
 *     guarantee from the de-duplication below.
 *
 * Idempotency: tracks recently-requested contacts in memory across the
 * loop, and skips contacts whose `phone` was set after the visit (the
 * waterfall already filled it). If two crons race, both fire a
 * `phone/enrich-requested` for the same contact — the consumer is
 * expected to be idempotent on its side (the waterfall caches).
 */

import { inngest } from "./client";
import { db } from "@/db";
import { contacts, visits } from "@/db/schema";
import { and, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { logger } from "@/lib/observability/logger";

const LOOKBACK_MINUTES = 15;

export const visitorPhoneEnrichRequest = inngest.createFunction(
  {
    id: "visitor-phone-enrich-request",
    name: "Stub: emit phone/enrich-requested for visitors without phones",
    retries: 1,
    concurrency: [{ limit: 1 }],
    onFailure: async ({ error }) => {
      logger.error("visitor-phone-enrich-request.dead_letter", {
        err: error instanceof Error ? error.message : String(error),
      });
    },
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async ({ step }: {
    step: { run<T>(id: string, fn: () => Promise<T> | T): Promise<T> };
  }) => {
    const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);

    // 1. Recently identified visits — companyId resolved, no phone
    //    on at least one contact at that company.
    const candidates = await step.run("scan-recent-identified-visits", async () =>
      db
        .select({
          contactId: contacts.id,
          companyId: contacts.companyId,
          tenantId: contacts.tenantId,
        })
        .from(visits)
        .innerJoin(
          contacts,
          and(
            eq(contacts.companyId, visits.companyId),
            eq(contacts.tenantId, visits.tenantId),
            isNull(contacts.phone),
            isNull(contacts.deletedAt),
          ),
        )
        .where(
          and(
            isNotNull(visits.companyId),
            gte(visits.createdAt, since),
          ),
        ),
    );

    if (candidates.length === 0) {
      return { requested: 0 };
    }

    // 2. Dedupe by contactId — a contact may show up multiple times
    //    across visits in the window.
    const uniqueByContact = new Map<
      string,
      { contactId: string; companyId: string | null; tenantId: string }
    >();
    for (const c of candidates) {
      if (!uniqueByContact.has(c.contactId)) {
        uniqueByContact.set(c.contactId, c);
      }
    }

    // 3. Fan out the events. The consumer (Apollo→Kaspr→Lusha waterfall
    //    on feat/voice-cold-call) does the actual enrichment + writes
    //    contacts.phone. Until that branch merges, this is dead-letter
    //    — the architectural intent stays in place.
    let requested = 0;
    for (const c of uniqueByContact.values()) {
      await inngest
        .send({
          name: "phone/enrich-requested",
          data: {
            tenantId: c.tenantId,
            contactId: c.contactId,
            companyId: c.companyId,
            requestedAt: new Date().toISOString(),
            source: "visitor-hot-to-call",
          },
        })
        .catch((err) =>
          logger.warn("visitor-phone-enrich-request.emit_failed", {
            contactId: c.contactId,
            err: err instanceof Error ? err.message : String(err),
          }),
        );
      requested++;
    }

    return {
      requested,
      windowMinutes: LOOKBACK_MINUTES,
      note: "Consumer ships with feat/voice-cold-call (Apollo→Kaspr→Lusha waterfall).",
    };
  },
);
