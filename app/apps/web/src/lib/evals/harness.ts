/**
 * Eval harness primitives (Sprint-1 audit follow-up).
 *
 * A surface registers an `EvalSuite` (a list of `EvalCase`s + a
 * predicate per case). The runner executes every case, aggregates
 * pass/fail counts and per-suite metrics, persists one row to
 * `eval_runs`, and returns the summary.
 *
 * The harness is provider-agnostic — it doesn't know about LLMs.
 * Cases just have a `run()` that produces an output, and a
 * `predicate()` that judges it. The cron caller wraps LLM-driven
 * cases through `llmCall`, so cost / latency land in `llm_calls`
 * automatically.
 *
 * Why a generic shape : 5 surfaces (signal-scanner, deal-briefing,
 * transcript-coaching, churn-risk, inbound-qualification) all need
 * eval but each measures a different thing — recall@k, citation
 * accuracy, classification F1, etc. The shared `metrics` jsonb
 * accommodates any number per surface.
 */

import { db } from "@/db";
import { evalRuns } from "@/db/schema";
import { logger } from "@/lib/observability/logger";

export interface EvalCase<TOut> {
  /** Stable id within the suite — used for case-level diffing
   *  across runs. e.g. "obj-budget-q1", "stall-30d". */
  id: string;
  /** Optional: free-form description for human review. */
  description?: string;
  /** Run the surface under test against this case. Returns the
   *  output for the predicate to judge. May throw — the harness
   *  catches and counts as `errored` (not pass, not fail). */
  run: () => Promise<TOut>;
  /** Returns true when the output meets the case's bar. Falsy →
   *  fail. Throwing → errored. */
  predicate: (output: TOut) => boolean | Promise<boolean>;
}

export interface EvalSuite<TOut> {
  /** Surface this suite tests — written to `eval_runs.surface_id`. */
  surfaceId: string;
  /** Versioned prompt being evaluated — written to `eval_runs.prompt_id`. */
  promptId: string;
  /** Cases. The harness runs them in declaration order. Keep ≤50
   *  per suite to bound cost / wall time. */
  cases: EvalCase<TOut>[];
  /** Optional: compute per-suite aggregates (recall@k, MRR, …) from
   *  the per-case outputs. Returned numbers go to `eval_runs.metrics`. */
  aggregateMetrics?: (
    results: Array<{ caseId: string; output: TOut; passed: boolean }>,
  ) => Record<string, number>;
}

export interface EvalRunSummary {
  surfaceId: string;
  promptId: string;
  casesTotal: number;
  casesPassed: number;
  casesErrored: number;
  metrics: Record<string, number>;
  totalLatencyMs: number;
  perCase: Array<{
    caseId: string;
    passed: boolean;
    errored: boolean;
    latencyMs: number;
    error?: string;
  }>;
}

/**
 * Run a suite and persist the aggregate. The per-case detail is
 * returned to the caller (useful for the eval dashboard) but only
 * the aggregate lands in the DB — case-level history would balloon
 * the table without much marginal value.
 */
export async function runEvalSuite<TOut>(
  suite: EvalSuite<TOut>,
): Promise<EvalRunSummary> {
  const startedAt = Date.now();
  const perCase: EvalRunSummary["perCase"] = [];
  const successOutputs: Array<{ caseId: string; output: TOut; passed: boolean }> = [];

  for (const c of suite.cases) {
    const caseStart = Date.now();
    try {
      const output = await c.run();
      let passed = false;
      try {
        passed = !!(await c.predicate(output));
      } catch {
        passed = false;
      }
      successOutputs.push({ caseId: c.id, output, passed });
      perCase.push({
        caseId: c.id,
        passed,
        errored: false,
        latencyMs: Date.now() - caseStart,
      });
    } catch (err) {
      perCase.push({
        caseId: c.id,
        passed: false,
        errored: true,
        latencyMs: Date.now() - caseStart,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const casesPassed = perCase.filter((c) => c.passed).length;
  const casesErrored = perCase.filter((c) => c.errored).length;
  const metrics = suite.aggregateMetrics
    ? suite.aggregateMetrics(successOutputs)
    : {};
  const totalLatencyMs = Date.now() - startedAt;

  // Persist aggregate. Fire-and-forget : if the DB is down, the
  // run still produced the in-memory summary the caller wanted.
  try {
    await db.insert(evalRuns).values({
      surfaceId: suite.surfaceId,
      promptId: suite.promptId,
      casesTotal: suite.cases.length,
      casesPassed,
      casesErrored,
      metrics,
      totalLatencyMs,
    });
  } catch (err) {
    logger.warn("eval-harness: persist failed (non-blocking)", {
      surfaceId: suite.surfaceId,
      promptId: suite.promptId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    surfaceId: suite.surfaceId,
    promptId: suite.promptId,
    casesTotal: suite.cases.length,
    casesPassed,
    casesErrored,
    metrics,
    totalLatencyMs,
    perCase,
  };
}

// ── Prompt-variant A/B framework (P0-4 follow-up) ─────────────────
//
// To safely roll new prompts, the team runs N variants in parallel
// for one or more weeks, then ships the winner. Each variant gets
// its own `eval_runs` row tagged with a distinct `prompt_id`, so the
// existing dashboard timeline + drill-down infra works unchanged.
//
// `EvalSuiteFamily` defines the variants ; the runner cross-products
// them : for each variant, build a suite (typically by threading the
// variant's prompt into the case `run()`), run it, persist. The
// returned `VariantComparison` ranks variants by pass rate so the
// caller can flip a flag once a clear winner emerges.

export interface EvalVariant {
  /** Stable id within the family — surfaces in dashboard labels.
   *  e.g. "control", "softer-tone", "v3". */
  id: string;
  /** Versioned prompt id for this variant — written to
   *  `eval_runs.prompt_id`. Must differ across variants in the same
   *  family or the dashboard will conflate the rows. */
  promptId: string;
  /** Optional human-readable label for the comparison report. */
  label?: string;
}

export interface EvalSuiteFamily<TOut> {
  /** Surface name shared by every variant — every eval_runs row has
   *  this surface_id, varying only by prompt_id. */
  surfaceId: string;
  /** Variants to evaluate. Two minimum (no point A/B'ing one), but
   *  the runner accepts any N >= 1 (single-variant degrades to the
   *  existing single-suite path). */
  variants: EvalVariant[];
  /** Build the per-variant suite. Same cases shape across variants
   *  by convention (apples-to-apples comparison) ; the variant's
   *  `promptId` flows into the suite's promptId field, and the
   *  variant context can also be threaded into each case's
   *  `run()` via closure. */
  buildSuite: (variant: EvalVariant) => EvalSuite<TOut>;
}

export interface VariantSummary {
  variantId: string;
  promptId: string;
  label: string;
  passRate: number;
  casesTotal: number;
  casesPassed: number;
  casesErrored: number;
  totalLatencyMs: number;
  metrics: Record<string, number>;
}

export interface VariantComparison {
  surfaceId: string;
  variants: VariantSummary[];
  /** Variant with the highest pass rate. Null on tie or empty. */
  winnerId: string | null;
  /** Pass-rate gap between the top variant and the runner-up.
   *  Useful threshold for "is this a real signal or noise?". 0
   *  when there's only one variant or a tie. */
  marginDelta: number;
}

/**
 * Pure : compute the comparison from a list of per-variant
 * summaries. Exported so the dashboard / report renderer can
 * reuse the ranking logic without re-running the suites.
 */
export function compareVariants(
  surfaceId: string,
  summaries: VariantSummary[],
): VariantComparison {
  if (summaries.length === 0) {
    return { surfaceId, variants: [], winnerId: null, marginDelta: 0 };
  }
  const sorted = [...summaries].sort((a, b) => b.passRate - a.passRate);
  const top = sorted[0];
  const runnerUp = sorted[1] ?? null;
  // Winner only when the top variant is strictly above the next.
  // Ties resolve to null so the caller doesn't ship on coin-flip.
  const winnerId =
    runnerUp && top.passRate === runnerUp.passRate ? null : top.variantId;
  const marginDelta = runnerUp
    ? Math.round((top.passRate - runnerUp.passRate) * 10000) / 10000
    : 0;
  return {
    surfaceId,
    variants: sorted,
    winnerId,
    marginDelta,
  };
}

/**
 * Run every variant in a family. Returns the per-variant summaries
 * + a comparison. Each variant persists its own eval_runs row via
 * the existing `runEvalSuite` path, so the dashboard timeline +
 * per-case drill-down work without further wiring.
 *
 * Sequential by design — variants typically share LLM rate-limit
 * envelopes, parallelism would just rate-limit. Cron caller has
 * `step.run` framing per variant for Inngest-level retry granularity.
 */
export async function runEvalSuiteFamily<TOut>(
  family: EvalSuiteFamily<TOut>,
): Promise<{
  summaries: Array<{ variantId: string; runSummary: EvalRunSummary }>;
  comparison: VariantComparison;
}> {
  if (family.variants.length === 0) {
    return {
      summaries: [],
      comparison: {
        surfaceId: family.surfaceId,
        variants: [],
        winnerId: null,
        marginDelta: 0,
      },
    };
  }

  const summaries: Array<{ variantId: string; runSummary: EvalRunSummary }> = [];
  const variantSummaries: VariantSummary[] = [];

  for (const variant of family.variants) {
    const suite = family.buildSuite(variant);
    // The family contract : suite.surfaceId must match family.surfaceId
    // and suite.promptId must match variant.promptId. We re-assert
    // here so a buggy buildSuite doesn't silently drift the dashboard.
    if (suite.surfaceId !== family.surfaceId) {
      logger.warn("eval-family: surface drift, overriding to family surfaceId", {
        familySurfaceId: family.surfaceId,
        suiteSurfaceId: suite.surfaceId,
        variantId: variant.id,
      });
    }
    if (suite.promptId !== variant.promptId) {
      logger.warn("eval-family: prompt drift, overriding to variant promptId", {
        variantId: variant.id,
        suitePromptId: suite.promptId,
        variantPromptId: variant.promptId,
      });
    }
    const runSummary = await runEvalSuite({
      ...suite,
      surfaceId: family.surfaceId,
      promptId: variant.promptId,
    });
    summaries.push({ variantId: variant.id, runSummary });
    const passRate =
      runSummary.casesTotal > 0
        ? runSummary.casesPassed / runSummary.casesTotal
        : 0;
    variantSummaries.push({
      variantId: variant.id,
      promptId: variant.promptId,
      label: variant.label ?? variant.id,
      passRate,
      casesTotal: runSummary.casesTotal,
      casesPassed: runSummary.casesPassed,
      casesErrored: runSummary.casesErrored,
      totalLatencyMs: runSummary.totalLatencyMs,
      metrics: runSummary.metrics,
    });
  }

  const comparison = compareVariants(family.surfaceId, variantSummaries);
  return { summaries, comparison };
}
