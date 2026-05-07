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
import { evalRuns, evalCaseRuns } from "@/db/schema";
import { logger } from "@/lib/observability/logger";

/** Cap on the per-case output snippet — long enough to recognise a
 *  failure mode, short enough that 4 weeks of weekly history doesn't
 *  blow up the row size. */
const OUTPUT_SNIPPET_MAX = 500;
const ERROR_MESSAGE_MAX = 500;

function snippetOf(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  let str: string;
  if (typeof value === "string") {
    str = value;
  } else {
    try {
      str = JSON.stringify(value);
    } catch {
      str = String(value);
    }
  }
  if (str.length === 0) return null;
  return str.length > OUTPUT_SNIPPET_MAX
    ? str.slice(0, OUTPUT_SNIPPET_MAX)
    : str;
}

function truncateError(err: string | undefined): string | null {
  if (!err) return null;
  return err.length > ERROR_MESSAGE_MAX ? err.slice(0, ERROR_MESSAGE_MAX) : err;
}

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
 * Run a suite and persist the aggregate + per-case detail. The
 * aggregate row in `eval_runs` is the long-lived analytics
 * surface ; the `eval_case_runs` rows let the dashboard drill
 * into "which 5 cases of 8 failed?" without re-running the suite
 * locally.
 *
 * Both writes are best-effort : if the DB is down, the run still
 * produced the in-memory summary the caller wanted.
 */
export async function runEvalSuite<TOut>(
  suite: EvalSuite<TOut>,
): Promise<EvalRunSummary> {
  const startedAt = Date.now();
  const perCase: EvalRunSummary["perCase"] = [];
  const successOutputs: Array<{ caseId: string; output: TOut; passed: boolean }> = [];
  // Hold each case's output (snippet form) so we can persist it
  // alongside the case row. Indexed by caseId — case ids are unique
  // within a suite by contract.
  const caseOutputs = new Map<string, unknown>();

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
      caseOutputs.set(c.id, output);
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

  // Persist aggregate FIRST, capture the run id for the per-case
  // FK. Fire-and-forget : if the DB is down, the run still produced
  // the in-memory summary the caller wanted.
  let runId: string | null = null;
  try {
    const [inserted] = await db
      .insert(evalRuns)
      .values({
        surfaceId: suite.surfaceId,
        promptId: suite.promptId,
        casesTotal: suite.cases.length,
        casesPassed,
        casesErrored,
        metrics,
        totalLatencyMs,
      })
      .returning({ id: evalRuns.id });
    runId = inserted?.id ?? null;
  } catch (err) {
    logger.warn("eval-harness: persist aggregate failed (non-blocking)", {
      surfaceId: suite.surfaceId,
      promptId: suite.promptId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // Persist per-case rows. Skipped when the aggregate write failed —
  // without a runId the FK constraint blocks. One bulk insert keeps
  // the round-trip count flat regardless of suite size.
  if (runId && perCase.length > 0) {
    try {
      await db.insert(evalCaseRuns).values(
        perCase.map((c) => ({
          runId,
          caseId: c.caseId,
          passed: c.passed,
          errored: c.errored,
          latencyMs: c.latencyMs,
          errorMessage: truncateError(c.error),
          outputSnippet: snippetOf(caseOutputs.get(c.caseId)),
        })),
      );
    } catch (err) {
      logger.warn("eval-harness: persist per-case failed (non-blocking)", {
        surfaceId: suite.surfaceId,
        runId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
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
