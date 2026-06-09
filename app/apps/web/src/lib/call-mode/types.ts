/**
 * Shared types for the Living Script Engine (_specs/call-script-living).
 *
 * The engine assembles a per-prospect cold-call script from grounded evidence
 * via deterministic rules + ONE constrained, citation-checked LLM step. These
 * types are the contract between the four pure modules (evidence → assemble →
 * levers, with insight as the only I/O step). No React, no I/O here.
 */

import type { ScriptFields } from "./call-scripts";

// ── Evidence (grounding) ────────────────────────────────────────

/** Where a fact came from — every spoken line traces to one of these. */
export type EvidenceKind = "signal" | "dossier" | "activity" | "knowledge" | "callIntel";

export interface EvidenceSource {
  kind: EvidenceKind;
  /** The concrete origin: signal type, dossier field name, activity id, … */
  ref: string;
  /** ISO timestamp, when known — drives freshness gating. */
  observedAt?: string | null;
}

export interface EvidenceItem {
  /** Stable id within one evidence set ("reason", "trigger", "E1"…). The LLM
   *  cites these; the assembler validates citations against them. */
  id: string;
  /** The human fact, ready to be phrased. */
  value: string;
  source: EvidenceSource;
  /** 0..1. Below the consuming bloc's threshold ⇒ treated as absent. */
  confidence: number;
}

/** Everything grounded we hold on a prospect, typed and sourced. */
export interface ProspectEvidence {
  /** Strongest "why now" (live-script priority: signal → angle → hiring → funding). */
  reason: EvidenceItem | null;
  /** The fact that selects the ONE Tier-1 problem (e.g. detected tooling). */
  problemTrigger: EvidenceItem | null;
  /** The prospect's sector — combined with the tenant's own client list
   *  (a TEMPLATE concern, not prospect evidence) to enable heard-the-name. */
  sector: string | null;
  persona: { title?: string | null };
  /** The ONLY facts the insight LLM step may phrase from. */
  insightInputs: EvidenceItem[];
  history: { lastTouchAt?: string | null; meddpicc?: Record<string, string> };
}

// ── Assembly ────────────────────────────────────────────────────

export type BlocKind =
  | "opener"
  | "reason"
  | "insight"
  | "problemTier1"
  | "microCTA"
  | "ask"
  | "objections"
  | "voicemail"
  | "gatekeeper";

/** The 9 methodology levers (cold-call-exchange-top01, Part 9). Compile-time
 *  validation checks the script-checkable ones; the Phase-2 scorer reuses the
 *  same ids on the transcript so coaching and scoring cannot drift. */
export type LeverId =
  | "opener_permission"
  | "reason_stated"
  | "single_tier1_problem"
  | "insight_present"
  | "ask_derisked"
  | "guidance_over_defer"
  | "booking_live"
  | "objection_ready"
  | "talk_ratio";

export interface BlocProvenance {
  /** Human source label shown on the chip ("Signal temps réel"…). */
  label: string;
  /** The EvidenceItem.id this bloc was grounded on. */
  sourceRef: string;
}

export interface AssembledBloc {
  kind: BlocKind;
  text: string;
  /** True iff the text traces to a real evidence item (not a template default). */
  grounded: boolean;
  provenance?: BlocProvenance;
  /** Which levers this bloc carries (drives the gap markers + Phase-2 scoring). */
  leverIds: LeverId[];
}

export interface GapReport {
  failedLevers: { id: LeverId; why: string }[];
}

export interface AssembledScript {
  blocs: AssembledBloc[];
  gaps: GapReport;
}

// ── Template ────────────────────────────────────────────────────

/**
 * The per-tenant template the engine fills. Extends the persisted `ScriptFields`
 * with the engine's structured extensions (the future `blocs` jsonb on
 * callScripts). Every extension is optional, so a legacy `ScriptFields` is a
 * valid template — it just degrades to template-only (ungrounded) blocs.
 */
export interface ScriptTemplate extends ScriptFields {
  /** Fallback insight when no grounded one can be produced. */
  insightStub?: string | null;
  /** Interest trial-close said before the ask (distinct from permissionCheck). */
  microCTA?: string | null;
  /** The tenant's own clients the prospect might recognise (heard-the-name). */
  peerReferences?: string[] | null;
  /** Heard-the-name opener template, with a {peer} placeholder. */
  openerHeardName?: string | null;
  /** Per-sector objection bank (Phase 2 learns this; Phase 1 generates it). */
  sectorObjections?: Array<{ objection: string; response: string }> | null;
  /** Explicit reversibility clause for the ask (satisfies ask_derisked). */
  askReversibility?: string | null;
  /** Product/register context handed to the constrained insight step. */
  product?: string | null;
  /**
   * Conversation posture for the segment. "consultative" (sober, non-pression —
   * the safe default; fits foundations / parapublic / santé, where the
   * methodology says never sur-vendre) suppresses the Challenger insight
   * reframe. "challenger" enables an insight reframe for segments that reward it
   * (SaaS / tech / finance execs). Founder-set per the per-industry matrix —
   * never auto-classified (no hardcoded sector→posture map).
   */
  posture?: "consultative" | "challenger";
}

/** A grounded claim the LLM step may return — kept only if its evidenceRef is valid. */
export interface GroundedClaim {
  text: string;
  evidenceRef: string;
}

/** Human labels for provenance chips, keyed by evidence kind. */
export const SOURCE_LABEL: Record<EvidenceKind, string> = {
  signal: "Signal temps réel",
  dossier: "Recherche société",
  activity: "Historique",
  knowledge: "Base de connaissances",
  callIntel: "Intel d'appel",
};
