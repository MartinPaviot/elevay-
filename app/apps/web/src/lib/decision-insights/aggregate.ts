/**
 * T9 (outreach-autopilot) — pure aggregation for weekly decision-level
 * insights. Buckets resolved outreach decisions by persona x signal and
 * scores each bucket's average outcome positivity against the tenant
 * baseline (the mean across ALL resolved decisions in the window).
 *
 * Bucket key v1: { seniority, function, company_size, sector, signal_type }.
 * `maturity` is dropped (null v1 — no standard company field, see
 * db/schema/outreach-learning.ts) and the signal contributes its TYPE only:
 * detected_at / source / freshness_days would explode the bucket space and
 * starve every bucket of the n >= 10 minimum.
 *
 * Window: the cron runs weekly but aggregates a ROLLING 90-day window — a
 * 7-day window would never reach n = 10 per bucket at the 100-sends/day cap
 * with outcome windows of 168h, so the cadence (weekly) and the evidence
 * window (90 days) are deliberately decoupled.
 *
 * Pure module: no db, no clock — the cron feeds it rows, tests feed it
 * synthetic datasets.
 */

/** Minimum decisions per bucket (and per tenant total) before anything
 *  publishes — below this a "pattern" is founder-mood noise. */
export const MIN_PATTERN_N = 10;

/** Minimum |lift| for a bucket to publish. A bucket that performs within
 *  0.1 of the baseline is the baseline; injecting it would only pay tokens
 *  to say "average is average". */
export const LIFT_FLOOR = 0.1;

/** Rolling evidence window in days (see the module comment). */
export const WINDOW_DAYS = 90;

/** One resolved decision as the cron loads it: the T7 snapshot jsonb
 *  columns + the T8-joined outcome positivity. */
export interface DecisionForInsights {
  persona: Record<string, unknown> | null;
  signal: Record<string, unknown> | null;
  positivity: number | null;
}

/** The persona x signal bucket key. Every field nullable — a decision with
 *  no fresh signal still buckets (signal_type null = "no signal"). */
export interface PatternBucket {
  seniority: string | null;
  function: string | null;
  company_size: string | null;
  sector: string | null;
  signal_type: string | null;
}

export interface PatternInsight {
  pattern: PatternBucket;
  /** Decisions in the bucket. */
  n: number;
  /** Mean outcome positivity inside the bucket. */
  positivityAvg: number;
  /** Tenant mean across ALL resolved decisions in the window. */
  baseline: number;
  /** positivityAvg - baseline. */
  lift: number;
}

export interface ComputedInsights {
  /** Resolved decisions considered (rows with a numeric positivity). */
  total: number;
  /** Null when total is 0 (nothing to average). */
  baseline: number | null;
  /** Buckets passing n >= MIN_PATTERN_N and |lift| >= LIFT_FLOOR. */
  patterns: PatternInsight[];
}

/** Normalize a snapshot field to a non-empty string or null (sizes may be
 *  stored numeric; empty strings mean "unknown", same as null). */
function normalizeField(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * The bucket key for one decision. Pure projection of the T7 snapshot:
 * persona { seniority, function, company_size, sector } + signal { type }.
 */
export function bucketKey(
  persona: Record<string, unknown> | null,
  signal: Record<string, unknown> | null,
): PatternBucket {
  return {
    seniority: normalizeField(persona?.seniority),
    function: normalizeField(persona?.function),
    company_size: normalizeField(persona?.company_size),
    sector: normalizeField(persona?.sector),
    signal_type: normalizeField(signal?.type),
  };
}

/** Stable string form of a bucket — the Map key. Fixed field order, so two
 *  identical buckets always collide. */
function bucketId(bucket: PatternBucket): string {
  return JSON.stringify([
    bucket.seniority,
    bucket.function,
    bucket.company_size,
    bucket.sector,
    bucket.signal_type,
  ]);
}

/**
 * Aggregate resolved decisions into publishable pattern insights.
 * Decisions without a numeric positivity are skipped (nothing resolved =
 * nothing learned); the baseline is the mean over every counted decision,
 * so lift is always "this bucket vs everything this tenant sent".
 */
export function computeInsights(
  decisions: DecisionForInsights[],
): ComputedInsights {
  const buckets = new Map<
    string,
    { bucket: PatternBucket; n: number; sum: number }
  >();
  let total = 0;
  let sum = 0;

  for (const d of decisions) {
    if (typeof d.positivity !== "number" || !Number.isFinite(d.positivity)) {
      continue;
    }
    total += 1;
    sum += d.positivity;

    const bucket = bucketKey(d.persona, d.signal);
    const id = bucketId(bucket);
    const entry = buckets.get(id) ?? { bucket, n: 0, sum: 0 };
    entry.n += 1;
    entry.sum += d.positivity;
    buckets.set(id, entry);
  }

  if (total === 0) return { total: 0, baseline: null, patterns: [] };

  const baseline = sum / total;
  const patterns: PatternInsight[] = [];
  for (const { bucket, n, sum: bucketSum } of buckets.values()) {
    if (n < MIN_PATTERN_N) continue;
    const positivityAvg = bucketSum / n;
    const lift = positivityAvg - baseline;
    if (Math.abs(lift) < LIFT_FLOOR) continue;
    patterns.push({ pattern: bucket, n, positivityAvg, baseline, lift });
  }

  // Strongest evidence first — the getter caps injection at a few rows.
  patterns.sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));

  return { total, baseline, patterns };
}

/** Human-readable bucket descriptor for summaries: only the known fields,
 *  "any" for the rest omitted. e.g. "seniority=senior, sector=SaaS,
 *  signal=funding". */
export function describeBucket(bucket: PatternBucket): string {
  const parts: string[] = [];
  if (bucket.seniority) parts.push(`seniority=${bucket.seniority}`);
  if (bucket.function) parts.push(`function=${bucket.function}`);
  if (bucket.company_size) parts.push(`company_size=${bucket.company_size}`);
  if (bucket.sector) parts.push(`sector=${bucket.sector}`);
  parts.push(`signal=${bucket.signal_type ?? "none"}`);
  return parts.join(", ");
}
