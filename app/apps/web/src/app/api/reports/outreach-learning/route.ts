/**
 * GET /api/reports/outreach-learning — the outcomes-first read behind the
 * Reports results screen (outreach-autopilot T11, M11-R1).
 *
 * Read-only, tenant-scoped, NO migration. Dynamic per request (no cache
 * primitives — every query carries an explicit `tenant_id` filter). One
 * fetch feeds the whole screen: the outcomes strip, the per-gate block-rate
 * section, and the persona x signal decisions table.
 *
 * Three aggregates over a rolling window (default 30 days):
 *  1. OUTCOMES — resolved action_outcomes by outcomeType (the funnel top:
 *     meetings held > booked > positive replies), plus `sends` (outreach
 *     decisions in the window) as the de-emphasized volume number.
 *  2. GATES — block rate per gate. G2 is written by BOTH the sequence
 *     generator (reasons.path 'sequence_step_v2') and the copy engine
 *     (reasons.path 'copy_engine') under the SAME (gate 2, g2.det.v1) tuple,
 *     so the group key is (gate, rubricVersion, reasons->>'path'): a naive
 *     GROUP BY gate would conflate two distinct producers into one rate.
 *  3. DECISIONS — persona x signal buckets with n + lift vs the tenant
 *     baseline, computed by the SAME pure aggregator the weekly cron uses
 *     (lib/decision-insights/aggregate.ts, computeInsights) so the results
 *     screen and the drafting-injection path never disagree on what a
 *     "pattern" is. angle is NULL until T18 — the aggregator does not bucket
 *     on it, so nothing to handle here.
 *
 * Every section fails SOFT to its empty default: one missing/erroring table
 * must render an honest zero, never blank the whole screen (mirrors the
 * table-tolerance in billing/usage + deliverability).
 */
import { getAuthContext } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { actionOutcomes, outreachDecisions, gateDecisions } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import {
  computeInsights,
  type DecisionForInsights,
} from "@/lib/decision-insights/aggregate";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 30;
const MIN_WINDOW_DAYS = 1;
const MAX_WINDOW_DAYS = 365;

/** The outcomeTypes that read as the funnel top on the results screen, in
 *  the POSITIVITY hierarchy order (lib/outcomes/resolve.ts). */
type OutcomeCounts = {
  meetingsHeld: number;
  meetingsBooked: number;
  positiveReplies: number;
  dealsAdvanced: number;
  sends: number;
};

const EMPTY_OUTCOMES: OutcomeCounts = {
  meetingsHeld: 0,
  meetingsBooked: 0,
  positiveReplies: 0,
  dealsAdvanced: 0,
  sends: 0,
};

interface GateBlockRate {
  gate: number;
  rubricVersion: string;
  /** reasons->>'path' — the ONLY discriminator between the two G2 producers;
   *  null for gates that write no path (G1/G4/G5). */
  path: string | null;
  n: number;
  blocked: number;
  blockRate: number;
}

interface DecisionBucket {
  persona: string;
  signal: string;
  n: number;
  lift: number;
  positivityAvg: number;
}

/** postgres.js returns bigint aggregates as strings; neon may not — coerce. */
function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Resolved-outcome counts by type, tenant-scoped, in the window. */
async function loadOutcomes(
  tenantId: string,
  since: Date,
): Promise<Omit<OutcomeCounts, "sends">> {
  try {
    const rows = await db
      .select({
        outcomeType: actionOutcomes.outcomeType,
        n: sql<number>`count(*)::int`,
      })
      .from(actionOutcomes)
      .where(
        and(
          eq(actionOutcomes.tenantId, tenantId),
          eq(actionOutcomes.status, "resolved"),
          gte(actionOutcomes.resolvedAt, since),
        ),
      )
      .groupBy(actionOutcomes.outcomeType);

    const byType = new Map<string, number>();
    for (const r of rows) byType.set(String(r.outcomeType ?? ""), num(r.n));
    return {
      meetingsHeld: byType.get("meeting_held") ?? 0,
      meetingsBooked: byType.get("meeting_booked") ?? 0,
      positiveReplies: byType.get("replied_positive") ?? 0,
      dealsAdvanced: byType.get("deal_advanced") ?? 0,
    };
  } catch {
    return {
      meetingsHeld: 0,
      meetingsBooked: 0,
      positiveReplies: 0,
      dealsAdvanced: 0,
    };
  }
}

/** Volume denominator: outreach decisions (prospecting sends; a reply-class
 *  send never records — INV-1) in the window. The grayed bottom metric. */
async function loadSends(tenantId: string, since: Date): Promise<number> {
  try {
    const [row] = await db
      .select({ sends: sql<number>`count(*)::int` })
      .from(outreachDecisions)
      .where(
        and(
          eq(outreachDecisions.tenantId, tenantId),
          gte(outreachDecisions.createdAt, since),
        ),
      );
    return num(row?.sends);
  } catch {
    return 0;
  }
}

/** Block rate per gate, grouped by (gate, rubricVersion, reasons.path). The
 *  path term is what keeps the two g2.det.v1 producers separate. */
async function loadGates(
  tenantId: string,
  since: Date,
): Promise<GateBlockRate[]> {
  try {
    // reasons->>'path' — the discriminator. Grouped ALONGSIDE gate +
    // rubricVersion so gate 2 / g2.det.v1 splits into its copy_engine and
    // sequence_step_v2 producers instead of one conflated rate.
    const pathExpr = sql<string | null>`${gateDecisions.reasons}->>'path'`;
    const rows = await db
      .select({
        gate: gateDecisions.gate,
        rubricVersion: gateDecisions.rubricVersion,
        path: pathExpr,
        n: sql<number>`count(*)::int`,
        blocked: sql<number>`sum(case when ${gateDecisions.verdict} = 'blocked' then 1 else 0 end)::int`,
      })
      .from(gateDecisions)
      .where(
        and(
          eq(gateDecisions.tenantId, tenantId),
          gte(gateDecisions.createdAt, since),
        ),
      )
      .groupBy(gateDecisions.gate, gateDecisions.rubricVersion, pathExpr);

    return rows
      .map((r) => {
        const n = num(r.n);
        const blocked = num(r.blocked);
        return {
          gate: num(r.gate),
          rubricVersion: String(r.rubricVersion),
          path: r.path ?? null,
          n,
          blocked,
          blockRate: n > 0 ? blocked / n : 0,
        };
      })
      // Stable read: gate asc, then the worse block rate first within a gate.
      .sort(
        (a, b) =>
          a.gate - b.gate ||
          b.blockRate - a.blockRate ||
          (a.path ?? "").localeCompare(b.path ?? ""),
      );
  } catch {
    return [];
  }
}

/** persona x signal buckets, resolved decisions joined to their outcome
 *  positivity, run through the canonical aggregator. */
async function loadDecisions(
  tenantId: string,
  since: Date,
): Promise<{ buckets: DecisionBucket[]; total: number; baseline: number | null }> {
  try {
    // Same join the weekly cron uses (inngest/decision-insights-weekly.ts):
    // outreach_decisions -> action_outcomes via outcome_id, status resolved.
    const rows: DecisionForInsights[] = await db
      .select({
        persona: outreachDecisions.persona,
        signal: outreachDecisions.signal,
        positivity: actionOutcomes.positivity,
      })
      .from(outreachDecisions)
      .innerJoin(
        actionOutcomes,
        eq(outreachDecisions.outcomeId, actionOutcomes.id),
      )
      .where(
        and(
          eq(outreachDecisions.tenantId, tenantId),
          eq(actionOutcomes.status, "resolved"),
          gte(outreachDecisions.createdAt, since),
        ),
      );

    const insights = computeInsights(rows);
    const buckets: DecisionBucket[] = insights.patterns.map((p) => {
      // Persona descriptor without the signal term (signal is its own column).
      const personaParts: string[] = [];
      if (p.pattern.seniority) personaParts.push(p.pattern.seniority);
      if (p.pattern.function) personaParts.push(p.pattern.function);
      if (p.pattern.company_size) personaParts.push(p.pattern.company_size);
      if (p.pattern.sector) personaParts.push(p.pattern.sector);
      return {
        persona: personaParts.length ? personaParts.join(" / ") : "Any persona",
        signal: p.pattern.signal_type ?? "no signal",
        n: p.n,
        lift: p.lift,
        positivityAvg: p.positivityAvg,
      };
    });
    return { buckets, total: insights.total, baseline: insights.baseline };
  } catch {
    return { buckets: [], total: 0, baseline: null };
  }
}

export async function GET(req: Request): Promise<Response> {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { tenantId } = authCtx;

  // Missing / empty / non-numeric / < 1 all fall back to the default window
  // (Number(null) === 0 is finite, so an explicit >= 1 check is required).
  const param = new URL(req.url).searchParams.get("days");
  const parsed = param != null ? Number(param) : NaN;
  const days =
    Number.isFinite(parsed) && parsed >= MIN_WINDOW_DAYS
      ? Math.min(Math.trunc(parsed), MAX_WINDOW_DAYS)
      : DEFAULT_WINDOW_DAYS;
  const since = new Date(Date.now() - days * DAY_MS);

  // Ordered so a call-ordered db mock reads: outcomes, sends, gates, decisions.
  const outcomeCounts = await loadOutcomes(tenantId, since);
  const sends = await loadSends(tenantId, since);
  const gates = await loadGates(tenantId, since);
  const decisions = await loadDecisions(tenantId, since);

  const outcomes: OutcomeCounts = { ...EMPTY_OUTCOMES, ...outcomeCounts, sends };

  return Response.json({
    window: { days, since: since.toISOString() },
    outcomes,
    gates,
    decisions: decisions.buckets,
    decisionsSummary: { total: decisions.total, baseline: decisions.baseline },
  });
}
