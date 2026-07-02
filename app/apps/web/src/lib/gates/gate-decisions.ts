/**
 * M13-R6/R7 (outreach-autopilot T6) — the single writer for `gate_decisions`.
 *
 * Every quality gate (G1 targeting, G2 factual, G4 copy quality, G5
 * deliverability content) records its verdict through here so reporting can
 * compute per-gate block rates (T11) and the review UI can show "why" (T11c).
 *
 * BEST-EFFORT BY CONTRACT: a verdict log must never block an enrollment or a
 * send. Both entry points swallow every error (including a mocked-out schema
 * in tests) and return the number of rows actually written. Callers never
 * await-and-branch on this.
 */
import { db } from "@/db";
import { gateDecisions } from "@/db/schema";

/** Rubrics are code (INV-8): bump when the gate's rule set changes. */
export const GATE_RUBRICS = {
  g1: "g1.enrollment.v1", // fresh signal + ICP threshold (enrollment-eligibility.ts)
  g2Deterministic: "g2.det.v1", // decideFabricationGate, deterministic layer
  g4Step: "g4.step.v1", // gradeGeneratedStep vs passThresholdFor
  g4Sequence: "g4.sequence.v1", // gradeSequenceQuality composite
  g5Transport: "g5.transport.v1", // runTransportContentQc
} as const;

export type GateSubjectType = "draft" | "step" | "manual" | "enrollment" | "send";
export type GateVerdict = "pass" | "blocked" | "reworked";

export interface GateDecisionInput {
  tenantId: string;
  subjectType: GateSubjectType;
  subjectId: string;
  /** 1=targeting, 2=factual, 3=interchangeability, 4=copy, 5=deliverability */
  gate: 1 | 2 | 3 | 4 | 5;
  rubricVersion: string;
  score?: number | null;
  verdict: GateVerdict;
  reasons?: Record<string, unknown>;
}

/** Postgres tolerates far more; kept small so a bulk enrollment's pass rows
 *  never turn into one giant statement. */
const CHUNK = 200;

export async function recordGateDecisions(
  rows: GateDecisionInput[],
  database: Pick<typeof db, "insert"> = db,
): Promise<number> {
  if (rows.length === 0) return 0;
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    try {
      await database.insert(gateDecisions).values(
        chunk.map((r) => ({
          tenantId: r.tenantId,
          subjectType: r.subjectType,
          subjectId: r.subjectId,
          gate: r.gate,
          rubricVersion: r.rubricVersion,
          score: r.score ?? null,
          verdict: r.verdict,
          reasons: r.reasons ?? {},
        })),
      );
      written += chunk.length;
    } catch {
      // Best-effort: the gate itself already enforced; losing the log line
      // must never fail the business action.
    }
  }
  return written;
}

export async function recordGateDecision(
  row: GateDecisionInput,
  database: Pick<typeof db, "insert"> = db,
): Promise<number> {
  return recordGateDecisions([row], database);
}

/** The two eligibility reasons that ARE the G1 gate (everything else —
 *  deleted/no_email/suppressed/excluded_company — fails before G1 runs). */
const G1_REASONS = new Set(["no_fresh_signal", "below_icp_threshold"]);

/**
 * Map one `checkContactEligibility` outcome to a G1 gate_decisions row.
 * Returns null when the outcome is not a G1 verdict (the contact failed an
 * earlier check, so the gate never evaluated). Shared by every enrollment
 * chokepoint so the vocabulary can't drift.
 */
export function g1DecisionRow(args: {
  tenantId: string;
  contactId: string;
  result: { eligible: true } | { eligible: false; reason: string };
  reasons?: Record<string, unknown>;
}): GateDecisionInput | null {
  if (!args.result.eligible && !G1_REASONS.has(args.result.reason)) return null;
  return {
    tenantId: args.tenantId,
    subjectType: "enrollment",
    subjectId: args.contactId,
    gate: 1,
    rubricVersion: GATE_RUBRICS.g1,
    verdict: args.result.eligible ? "pass" : "blocked",
    reasons: {
      ...(args.result.eligible ? {} : { reason: args.result.reason }),
      ...args.reasons,
    },
  };
}
