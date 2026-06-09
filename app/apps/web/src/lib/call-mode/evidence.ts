/**
 * Build typed, sourced `ProspectEvidence` from the prospect's brain — the
 * grounding layer of the Living Script Engine. Pure: the brain is passed in as
 * a narrow input shape (decoupled from the page's client `ContactBrainJSON`),
 * so this unit-tests without I/O and the API route adapts the real brain to it.
 *
 * Grounding rules enforced here (requirements R1):
 *  - every item carries { value, source, confidence };
 *  - items below MIN_CONFIDENCE (or stale past their freshness window) are
 *    dropped — they never reach a spoken line;
 *  - inferred/unsourced context-graph edges or memories are NOT consumed.
 *
 * The reason-to-call reuses the shipped `deriveOpeningReason` priority
 * (signal → angle → hiring → funding), so the one source of truth for "why
 * now" is shared between the panel and the engine.
 */

import type { EvidenceItem, EvidenceKind, ProspectEvidence } from "./types";
import { deriveOpeningReason } from "./live-script";

/** Per-source confidence priors. Tuned to the methodology's trust order: a
 *  live signal is the strongest "why now"; research facts are softer. */
const CONF = { signal: 0.9, hiring: 0.6, funding: 0.6, dossierFact: 0.6 } as const;
const MIN_CONFIDENCE = 0.5;
/** Drop an item whose observedAt is older than this (ms) — never present a
 *  stale trigger as "right now". Items without a date are kept (not datable). */
const FRESHNESS_MS = 1000 * 60 * 60 * 24 * 120; // 120 days

/** The narrow brain shape the evidence builder needs (a subset of the page's
 *  ContactBrainJSON + the queue's latestSignal). Keeps this module decoupled. */
export interface EvidenceBrainInput {
  signal?: { type: string; label: string; observedAt?: string | null } | null;
  sector?: string | null;
  persona?: { title?: string | null } | null;
  dossier?: {
    recommendedApproach?: { messagingAngle?: string | null } | null;
    hiringSignals?: Array<{ role: string }> | null;
    funding?: { lastRound?: string | null; date?: string | null } | null;
    techStack?: string[] | null;
    competitiveLandscape?: string | null;
  } | null;
  history?: { lastTouchAt?: string | null } | null;
  /** MEDDPICC / call-intel already captured by post-call-crm.ts. */
  callIntel?: Record<string, string> | null;
}

function fresh(observedAt?: string | null): boolean {
  if (!observedAt) return true;
  const t = new Date(observedAt).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() - t <= FRESHNESS_MS;
}

function keep(item: EvidenceItem): boolean {
  return item.confidence >= MIN_CONFIDENCE && fresh(item.source.observedAt);
}

export function buildProspectEvidence(input: EvidenceBrainInput): ProspectEvidence {
  const dossier = input.dossier ?? null;
  const hiringRoles = (dossier?.hiringSignals ?? []).map((h) => h.role).filter(Boolean);
  const techStack = (dossier?.techStack ?? []).filter(Boolean);

  // ── reason (why now) — reuse the shipped priority, wrap as evidence ──
  let reason: EvidenceItem | null = null;
  const r = deriveOpeningReason({
    signal: input.signal ?? null,
    hiringRole: hiringRoles[0],
    fundingLastRound: dossier?.funding?.lastRound,
  });
  if (r) {
    const confidence = r.source === "signal" ? CONF.signal : r.source === "hiring" ? CONF.hiring : CONF.funding;
    const kind: EvidenceKind = r.source === "signal" ? "signal" : "dossier";
    const ref = r.source === "signal" ? input.signal?.type ?? "signal" : r.source;
    const candidate: EvidenceItem = {
      id: "reason",
      value: r.fact,
      source: { kind, ref, observedAt: r.source === "signal" ? input.signal?.observedAt ?? null : null },
      confidence,
    };
    reason = keep(candidate) ? candidate : null;
  }

  // ── problemTrigger — the fact that selects the ONE Tier-1 enjeu ──
  let problemTrigger: EvidenceItem | null = null;
  if (techStack.length > 0) {
    problemTrigger = {
      id: "trigger",
      value: `Outils en place : ${techStack.join(", ")}`,
      source: { kind: "dossier", ref: "techStack" },
      confidence: CONF.dossierFact,
    };
  } else if (hiringRoles.length > 0) {
    problemTrigger = {
      id: "trigger",
      value: `Recrute ${hiringRoles.join(", ")}`,
      source: { kind: "dossier", ref: "hiringSignals" },
      confidence: CONF.hiring,
    };
  }
  if (problemTrigger && !keep(problemTrigger)) problemTrigger = null;

  // ── insightInputs — the ONLY facts the LLM step may phrase from ──
  const insightInputs: EvidenceItem[] = [];
  let n = 0;
  const pushInput = (value: string, ref: string, confidence: number) => {
    const item: EvidenceItem = { id: `E${++n}`, value, source: { kind: "dossier", ref }, confidence };
    if (keep(item)) insightInputs.push(item);
  };
  if (dossier?.funding?.lastRound) {
    const d = dossier.funding.date && dossier.funding.date !== "Unknown" ? ` (${dossier.funding.date})` : "";
    pushInput(`${dossier.funding.lastRound}${d}`, "funding", CONF.funding);
  }
  for (const role of hiringRoles) pushInput(`Recrute ${role}`, "hiringSignals", CONF.hiring);
  if (techStack.length > 0) pushInput(`Stack : ${techStack.join(", ")}`, "techStack", CONF.dossierFact);
  if (dossier?.competitiveLandscape?.trim()) {
    pushInput(dossier.competitiveLandscape.trim(), "competitiveLandscape", CONF.dossierFact);
  }

  return {
    reason,
    problemTrigger,
    sector: input.sector?.trim() || null,
    persona: { title: input.persona?.title ?? null },
    insightInputs,
    history: {
      lastTouchAt: input.history?.lastTouchAt ?? null,
      meddpicc: input.callIntel ?? undefined,
    },
  };
}
