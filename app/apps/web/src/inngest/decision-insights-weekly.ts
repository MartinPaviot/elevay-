/**
 * T9 (outreach-autopilot) — decision-insights-weekly. Monday 06:00 UTC
 * (design §8), per-tenant fan-out with step.run fault isolation, mirrors
 * the sibling weekly crons (retries 1, concurrency 1, dead-letter log).
 *
 * TWO sources per tenant, over a rolling 90-day window (WINDOW_DAYS —
 * weekly cadence, longer evidence window; see lib/decision-insights/
 * aggregate.ts):
 *  (a) PATTERNS — outreach_decisions JOIN action_outcomes via outcome_id
 *      (the T8 backfill), status 'resolved': persona x signal buckets with
 *      n >= MIN_PATTERN_N and |lift| >= LIFT_FLOOR vs the tenant baseline;
 *  (b) ANTI-PATTERNS — sequence_drafts founder rejections (a rejected draft
 *      never made a decision-record, so this signal exists nowhere else).
 *      reviewedBy='system' rows are EXCLUDED: an expiry/gate timeout is not
 *      founder feedback.
 *
 * M12-R5 deliverability cross-check at publication: when the tenant-level
 * guard is tripped (lib/deliverability/db-guard.ts), every POSITIVE-lift
 * pattern is written status 'invalidated' ('deliverability_guard_tripped')
 * because acting on it would push MORE volume into a breached tenant.
 * Anti-patterns and negative-lift patterns stay published — following them
 * REDUCES volume. Per-SEGMENT bounce aggregation does not exist yet; the
 * tenant-level guard is the v1 rule.
 *
 * Sonnet phrases the summaries (agentId decision-insights-synthesizer; the
 * traced wrapper enforces the budget guard + AI_DISABLED kill-switch), with
 * a DETERMINISTIC FALLBACK: every row carries a template summary before the
 * model is asked, so an LLM failure still publishes — the numbers ARE the
 * insight, Sonnet only makes them readable.
 *
 * Idempotency: DELETE the (tenant, week_of) batch, then insert — a re-run
 * replaces the week wholesale (no unique index on the jsonb pattern).
 */

import { z } from "zod";
import { inngest } from "./client";
import { db } from "@/db";
import {
  tenants,
  outreachDecisions,
  actionOutcomes,
  sequenceDrafts,
  weeklyDecisionInsights,
} from "@/db/schema";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import { tracedGenerateObject } from "@/lib/ai/traced-ai";
import { anthropic } from "@/lib/ai/ai-provider";
import { guardTrippedForTenant } from "@/lib/deliverability/db-guard";
import { logger } from "@/lib/observability/logger";
import {
  classifyRejection,
  aggregateRejections,
  dominantInsight,
} from "@/lib/sequence-drafts/rejection-classifier";
import {
  computeInsights,
  describeBucket,
  MIN_PATTERN_N,
  WINDOW_DAYS,
  type PatternInsight,
} from "@/lib/decision-insights/aggregate";

const DAY_MS = 24 * 60 * 60 * 1000;

/** M12-R5 invalidation marker (weekly_decision_insights.invalidated_reason). */
const GUARD_INVALIDATED_REASON = "deliverability_guard_tripped";

/** The Monday (UTC) of the week containing `now` — the batch key. The cron
 *  fires Mondays, but computing it (instead of trusting the fire date)
 *  keeps a manual replay on any weekday in the same batch. */
export function mondayOfWeekUtc(now: Date = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const sinceMonday = (d.getUTCDay() + 6) % 7; // 0 = Monday ... 6 = Sunday
  d.setUTCDate(d.getUTCDate() - sinceMonday);
  return d.toISOString().slice(0, 10);
}

// ── Deterministic template summaries (the LLM fallback) ─────────────────
// No em-dashes here on purpose (copy fixture rule).

function patternTemplate(p: PatternInsight): string {
  const direction = p.lift > 0 ? "above" : "below";
  const advice =
    p.lift > 0
      ? "Prefer this combination when choosing targets and angles."
      : "Deprioritize or rework this combination.";
  return (
    `Pattern (n=${p.n}, ${WINDOW_DAYS}-day window): outreach to [${describeBucket(p.pattern)}] ` +
    `averaged positivity ${p.positivityAvg.toFixed(2)}, ${direction} the workspace baseline ` +
    `${p.baseline.toFixed(2)} (lift ${p.lift >= 0 ? "+" : ""}${p.lift.toFixed(2)}). ${advice}`
  );
}

function antiPatternTemplate(category: string, count: number): string {
  return (
    `Anti-pattern (n=${count}, ${WINDOW_DAYS}-day window): the founder rejected ${count} drafts ` +
    `for ${category} issues. Avoid this failure mode in new drafts.`
  );
}

function coldStartTemplate(total: number): string {
  return (
    `Cold start: ${total} of ${MIN_PATTERN_N} minimum resolved outreach decisions ` +
    `in the last ${WINDOW_DAYS} days. No decision-level patterns published yet; ` +
    `insights unlock at ${MIN_PATTERN_N} resolved decisions.`
  );
}

// ── Sonnet phrasing ──────────────────────────────────────────────────────

const phrasingSchema = z.object({
  summaries: z.array(
    z.object({
      index: z.number().int(),
      summary: z.string(),
    }),
  ),
});

type InsightRow = {
  tenantId: string;
  weekOf: string;
  kind: "pattern" | "anti_pattern" | "cold_start";
  pattern: Record<string, unknown> | null;
  n: number;
  lift: number | null;
  positivityAvg: number | null;
  baseline: number | null;
  summary: string;
  status: "published" | "invalidated";
  invalidatedReason: string | null;
};

/**
 * Ask Sonnet to rephrase the template summaries into one crisp sentence
 * each, keeping every number exact. Mutates rows in place on success; any
 * throw (budget cap, AI_DISABLED, transport, schema) leaves the
 * deterministic templates standing — publication never depends on the LLM.
 */
/** Only the strongest rows are worth an LLM sentence: the getter injects at
 *  most 5; phrasing more than this per tenant per week is spend for nothing. */
const PHRASE_CAP = 10;

/** A rephrased sentence is accepted only if the row's load-bearing digits
 *  survived (n, and the formatted lift when the row has one): "keep every
 *  number EXACT" is otherwise prompt-only, and a hallucinated figure would
 *  be injected into a week of drafting prompts (review fix). */
function rephraseKeepsNumbers(row: InsightRow, rephrased: string): boolean {
  if (!rephrased.includes(String(row.n))) return false;
  if (row.lift != null) {
    const lift = `${row.lift >= 0 ? "+" : ""}${row.lift.toFixed(2)}`;
    if (!rephrased.includes(lift) && !rephrased.includes(row.lift.toFixed(2))) return false;
  }
  return true;
}

async function phraseSummaries(
  tenantId: string,
  rows: InsightRow[],
): Promise<void> {
  // Rows arrive |lift|-sorted from the aggregator; cap the LLM's workload
  // (and its output, below) — the cost audit flagged uncapped cron sites.
  const toPhrase = rows.slice(0, PHRASE_CAP);
  if (toPhrase.length === 0) return;
  try {
    const { object } = await tracedGenerateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: phrasingSchema,
      maxOutputTokens: 2048,
      prompt:
        `You phrase weekly outreach learning insights for a founder. For each item below, ` +
        `rewrite the draft summary as ONE crisp, plain-language sentence (max ~40 words). ` +
        `Keep every number (n, positivity, baseline, lift, counts) EXACTLY as given. ` +
        `Do not invent data. Return one entry per item, keyed by its index.\n\n` +
        toPhrase
          .map(
            (r, i) =>
              `Item ${i} (${r.kind}${r.status === "invalidated" ? ", invalidated by the deliverability guard" : ""}):\n${r.summary}`,
          )
          .join("\n\n"),
      _trace: {
        agentId: "decision-insights-synthesizer",
        tenantId,
        inputPreview: `Phrase ${toPhrase.length} weekly decision insights`,
      },
    });
    for (const s of object.summaries) {
      const row = toPhrase[s.index];
      const summary = typeof s.summary === "string" ? s.summary.trim() : "";
      if (row && summary && rephraseKeepsNumbers(row, summary)) row.summary = summary;
    }
  } catch (err) {
    // Deterministic fallback: the template summaries already carry the
    // numbers, so the insight publishes without the model.
    logger.warn?.("decision-insights-weekly: LLM phrasing failed, templates stand", {
      tenantId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Per-tenant pass ──────────────────────────────────────────────────────

export interface TenantInsightsResult {
  published: number;
  invalidated: number;
  coldStart: boolean;
}

/** Generate + persist one tenant's weekly insight batch. Exported for the
 *  unit tests; the handler wraps it in step.run + a fail-soft catch. */
export async function generateTenantInsights(
  tenantId: string,
  weekOf: string,
  now: Date = new Date(),
): Promise<TenantInsightsResult> {
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);

  // Idempotent re-run helper: replace the whole (tenant, week_of) batch.
  // Called ADJACENT to each insert (review fix): deleting up front meant a
  // replay that failed mid-pass (after the delete, before the insert)
  // permanently lost an already-published week — the per-tenant fail-soft
  // catch would swallow it and Inngest would never retry.
  const replaceWeek = async (rows: InsightRow[]): Promise<void> => {
    await db
      .delete(weeklyDecisionInsights)
      .where(
        and(
          eq(weeklyDecisionInsights.tenantId, tenantId),
          eq(weeklyDecisionInsights.weekOf, weekOf),
        ),
      );
    if (rows.length > 0) await db.insert(weeklyDecisionInsights).values(rows);
  };

  // Source (a): resolved decisions — the T8 join through outcome_id.
  const decisions = await db
    .select({
      persona: outreachDecisions.persona,
      signal: outreachDecisions.signal,
      positivity: actionOutcomes.positivity,
    })
    .from(outreachDecisions)
    .innerJoin(actionOutcomes, eq(outreachDecisions.outcomeId, actionOutcomes.id))
    .where(
      and(
        eq(outreachDecisions.tenantId, tenantId),
        eq(actionOutcomes.status, "resolved"),
        gte(outreachDecisions.createdAt, windowStart),
      ),
    );

  // Compute FIRST, gate on what the aggregator actually LEARNED FROM
  // (review fix): `total` counts rows with numeric positivity — a future
  // resolver writing null positivity must not let a <10-learnable tenant
  // slip past the cold-start gate on raw row count.
  const { total, baseline, patterns } = computeInsights(decisions);

  // Under the minimum: ONE quantified cold-start row, NO insights (Done
  // criteria) — the anti-pattern source is deliberately held back too so a
  // near-zero tenant sees exactly one honest "not enough data yet" state.
  if (total < MIN_PATTERN_N) {
    await replaceWeek([
      {
        tenantId,
        weekOf,
        kind: "cold_start",
        pattern: null,
        n: total,
        lift: null,
        positivityAvg: null,
        baseline: null,
        summary: coldStartTemplate(total),
        status: "published",
        invalidatedReason: null,
      },
    ]);
    return { published: 1, invalidated: 0, coldStart: true };
  }

  // Source (b): founder rejections. status 'rejected' already excludes the
  // expiry ('expired') and gate ('set_aside') system writes, but the
  // reviewedBy filter is kept as the explicit rule: a system timeout is not
  // founder feedback.
  const rejectedRows = await db
    .select({
      reviewReason: sequenceDrafts.reviewReason,
      reviewedBy: sequenceDrafts.reviewedBy,
    })
    .from(sequenceDrafts)
    .where(
      and(
        eq(sequenceDrafts.tenantId, tenantId),
        eq(sequenceDrafts.status, "rejected"),
        isNotNull(sequenceDrafts.reviewReason),
        gte(sequenceDrafts.reviewedAt, windowStart),
      ),
    );
  const founderReasons = rejectedRows
    .filter((r) => r.reviewedBy !== "system" && r.reviewReason)
    .map((r) => classifyRejection(r.reviewReason as string));
  const anti = dominantInsight(aggregateRejections(founderReasons));

  // M12-R5: evaluate the tenant guard only when a positive-lift pattern is
  // about to publish (the only case the rule can invalidate). A guard
  // evaluation failure fails SOFT to "not tripped": the guard itself is
  // permissive below its min sample, and these insights only steer drafting
  // prompts — the actual send path keeps its own hard deliverability gates.
  let guardTripped = false;
  if (patterns.some((p) => p.lift > 0)) {
    try {
      guardTripped = await guardTrippedForTenant(tenantId);
    } catch (err) {
      logger.warn?.("decision-insights-weekly: guard check failed, treating as not tripped", {
        tenantId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const rows: InsightRow[] = [];
  for (const p of patterns) {
    // A bucket with every persona field null AND no signal type says nothing
    // actionable ("outreach to [signal=none] works") — publishing it would
    // conflate "persona unknown" with a real targeting insight (review fix).
    const b = p.pattern;
    const meaningless =
      !b.seniority && !b.function && !b.company_size && !b.sector && !b.signal_type;
    if (meaningless) continue;
    const invalidated = guardTripped && p.lift > 0;
    rows.push({
      tenantId,
      weekOf,
      kind: "pattern",
      pattern: p.pattern as unknown as Record<string, unknown>,
      n: p.n,
      lift: p.lift,
      positivityAvg: p.positivityAvg,
      baseline,
      summary: patternTemplate(p),
      status: invalidated ? "invalidated" : "published",
      invalidatedReason: invalidated ? GUARD_INVALIDATED_REASON : null,
    });
  }
  if (anti) {
    rows.push({
      tenantId,
      weekOf,
      kind: "anti_pattern",
      pattern: { rejection_category: anti.category },
      n: anti.count,
      lift: null,
      positivityAvg: null,
      baseline: null,
      summary: antiPatternTemplate(anti.category, anti.count),
      status: "published",
      invalidatedReason: null,
    });
  }

  // Phrase BEFORE touching the stored week: the delete+insert stay adjacent
  // so a mid-pass failure (LLM, query) leaves the prior batch standing. An
  // honestly-empty recompute still replaces the week with nothing.
  await phraseSummaries(tenantId, rows);
  await replaceWeek(rows);

  return {
    published: rows.filter((r) => r.status === "published").length,
    invalidated: rows.filter((r) => r.status === "invalidated").length,
    coldStart: false,
  };
}

// ── The cron ─────────────────────────────────────────────────────────────

export const decisionInsightsWeekly = inngest.createFunction(
  {
    id: "decision-insights-weekly",
    name: "Cron: weekly decision-level outreach insights (patterns + anti-patterns)",
    retries: 1,
    concurrency: [{ limit: 1 }],
    onFailure: async ({ error }: { error: unknown }) => {
      logger.error("decision-insights-weekly.dead_letter", {
        err: error instanceof Error ? error.message : String(error),
      });
    },
    triggers: [{ cron: "0 6 * * 1" }], // Monday 06:00 UTC (design §8)
  },
  async ({ step }: { step: { run<T>(id: string, fn: () => Promise<T> | T): Promise<T> } }) => {
    const weekOf = mondayOfWeekUtc();

    const allTenants = await step.run("fetch-tenants", async () =>
      db.select({ id: tenants.id }).from(tenants),
    );

    let published = 0;
    let invalidated = 0;
    let coldStarts = 0;
    let failures = 0;

    for (const t of allTenants) {
      const res = await step.run(`insights-${t.id}`, async () => {
        try {
          return await generateTenantInsights(t.id, weekOf);
        } catch (err) {
          // One tenant's failure must not block the rest of the fan-out —
          // fail-soft per tenant, same contract as the sibling crons.
          logger.warn?.("decision-insights-weekly: tenant pass failed (non-fatal)", {
            tenantId: t.id,
            err: err instanceof Error ? err.message : String(err),
          });
          return null;
        }
      });
      if (!res) {
        failures += 1;
        continue;
      }
      published += res.published;
      invalidated += res.invalidated;
      if (res.coldStart) coldStarts += 1;
    }

    return {
      weekOf,
      tenants: allTenants.length,
      published,
      invalidated,
      coldStarts,
      failures,
    };
  },
);
