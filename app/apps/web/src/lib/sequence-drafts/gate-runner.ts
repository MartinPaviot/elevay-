/**
 * M13 T6 — G4 copy-quality gate on a freshly inserted sequence draft.
 *
 * Drives the draft through the gate lifecycle STRICTLY via `canTransition`
 * (the walk below is legal by construction — every persisted status comes
 * out of the state machine):
 *
 *   gates_running ──pass──→ pending_approval
 *   gates_running ──fail──→ blocked ──rework──→ reworking ──gates_rerun──→
 *   gates_running ──pass──→ pending_approval | ──fail──→ blocked ──→ set_aside
 *
 * One rework attempt only: `personalizeStepEmail` has no feedback channel
 * (unlike the sequence-generator's evaluator-optimizer loop), so a rework is
 * a fresh roll, not a guided fix. Two rolls below the bar = set_aside with
 * the grader's issues as the explanation — never sent, never auto-retried.
 *
 * FAIL-OPEN on infrastructure failures (missing prospect context, grader
 * crash): the draft lands in `pending_approval` with a logged pass verdict
 * carrying the failOpen reason. Rationale: every draft still faces the HUMAN
 * review gate downstream; an ungraded draft in review beats a bricked
 * autopilot. The gate VERDICT itself (low score) always fails closed.
 *
 * Threshold = `passThresholdFor(methodology)` — the existing central pass
 * bar (0.7, 0.8 for tier-1 BASHO), NOT a new knob. (Deviation from design.md
 * §5 "0.75 configurable": the brownfield already owns this constant.)
 *
 * Idempotency: the runner never READS draft status — it replays the same
 * walk from gates_running. An Inngest retry mid-walk rewrites the same
 * statuses (converges); duplicate gate_decisions rows on a crash-retry are
 * acceptable for a log table.
 */

import { canTransition, type DraftStatus } from "./state-machine";
import { checkSpamSignals } from "@/lib/emails/email-spam-check";
import {
  GATE_RUBRICS,
  recordGateDecisions,
  type GateDecisionInput,
} from "@/lib/gates/gate-decisions";
import type { EmailGradeResult } from "@/lib/evals/email-quality-grader";

export interface DraftContent {
  subject: string;
  body: string;
}

export interface GateRunnerInput {
  tenantId: string;
  draftId: string;
  contactId: string;
  enrollmentId: string;
  stepNumber: number;
  content: DraftContent;
}

export interface GateRunnerDeps {
  /** Persist a partial draft update (status walks, content rework, score). */
  updateDraft: (fields: Record<string, unknown>) => Promise<void>;
  /** Grade one step's content; throws = fail-open. Returns score 0-1. */
  grade: (content: DraftContent) => Promise<Pick<EmailGradeResult, "score" | "issues">>;
  /** The pass bar (passThresholdFor(methodology) at the call site). */
  threshold: number;
  /** Fresh personalization roll for the rework attempt; throws = no roll. */
  regenerate: () => Promise<DraftContent>;
  /** Verdict writer — defaults to the real one; injectable for tests. */
  record?: typeof recordGateDecisions;
}

export interface GateRunnerResult {
  finalStatus: Extract<DraftStatus, "pending_approval" | "set_aside">;
  score: number | null;
  attempts: number;
}

const MAX_ATTEMPTS = 2;

export async function runDraftG4Gate(
  input: GateRunnerInput,
  deps: GateRunnerDeps,
): Promise<GateRunnerResult> {
  const record = deps.record ?? recordGateDecisions;
  let status: DraftStatus = "gates_running";

  const walk = async (action: Parameters<typeof canTransition>[1], extra?: Record<string, unknown>) => {
    const t = canTransition(status, action);
    if (!t.allowed) {
      // By construction this never fires; if it does, the walk has a bug —
      // surface it instead of writing an illegal status.
      throw new Error(`gate-runner illegal transition ${status} + ${action}: ${t.reason}`);
    }
    status = t.nextStatus;
    await deps.updateDraft({ status, updatedAt: new Date(), ...extra });
  };

  const verdictRow = (
    verdict: GateDecisionInput["verdict"],
    score: number | null,
    reasons: Record<string, unknown>,
  ): GateDecisionInput => ({
    tenantId: input.tenantId,
    subjectType: "draft",
    subjectId: input.draftId,
    gate: 4,
    rubricVersion: GATE_RUBRICS.g4Step,
    score,
    verdict,
    reasons: { enrollmentId: input.enrollmentId, stepNumber: input.stepNumber, ...reasons },
  });

  let content = input.content;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let graded: Pick<EmailGradeResult, "score" | "issues">;
    try {
      graded = await deps.grade(content);
    } catch (err) {
      // Fail-open: grader infrastructure failed, not the copy.
      await walk("gates_pass");
      await record([
        verdictRow("pass", null, {
          failOpen: "grader_error",
          error: err instanceof Error ? err.message : String(err),
          attempt,
        }),
      ]);
      return { finalStatus: "pending_approval", score: null, attempts: attempt };
    }

    if (graded.score >= deps.threshold) {
      await walk("gates_pass", { qualityScore: graded.score });
      await record([
        verdictRow(attempt === 1 ? "pass" : "reworked", graded.score, {
          threshold: deps.threshold,
          attempt,
        }),
      ]);
      return { finalStatus: "pending_approval", score: graded.score, attempts: attempt };
    }

    // Below the bar.
    await walk("gate_block");
    await record([
      verdictRow("blocked", graded.score, {
        threshold: deps.threshold,
        attempt,
        issues: graded.issues.slice(0, 8),
      }),
    ]);

    if (attempt >= MAX_ATTEMPTS) {
      await walk("set_aside", {
        reviewedAt: new Date(),
        reviewedBy: "system",
        reviewReason:
          `Set aside by the copy-quality gate (G4): scored ${graded.score.toFixed(2)} ` +
          `< ${deps.threshold} on ${MAX_ATTEMPTS} attempts. ` +
          `Top issues: ${graded.issues.slice(0, 3).join("; ") || "none reported"}`,
        qualityScore: graded.score,
      });
      return { finalStatus: "set_aside", score: graded.score, attempts: attempt };
    }

    // One fresh roll. A failed roll keeps attempt-1 content and lets the
    // NEXT grade pass re-judge it — it will fail again and set_aside with
    // the regeneration failure on record.
    await walk("rework");
    let rolled: DraftContent | null = null;
    try {
      rolled = await deps.regenerate();
    } catch {
      rolled = null;
    }
    if (rolled) {
      content = rolled;
      const spam = checkSpamSignals(content.subject, content.body);
      await deps.updateDraft({
        subject: content.subject,
        bodyText: content.body,
        bodyHtml: content.body, // mirrors the router's insert (text-first personaliser)
        spamScore: spam.score,
        spamSeverity: spam.severity,
        spamWarnings: spam.warnings,
        updatedAt: new Date(),
      });
    }
    await walk("gates_rerun");
  }

  // Unreachable: the loop always returns on pass, fail-open, or set_aside.
  throw new Error("gate-runner fell through its attempt loop");
}
