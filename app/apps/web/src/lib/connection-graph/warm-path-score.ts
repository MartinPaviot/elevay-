/**
 * Warm-path → priority-score contribution (_specs/CONNECTION-GRAPH).
 *
 * A warm path is an accessibility lever: an account you can reach warm
 * should rank above an equal-fit cold one. This returns a MULTIPLIER in
 * [1, 1.5] to fold into `priorityScore` (signal lift × ICP fit ×
 * accessibility) — never below 1, so a warm path only ever boosts, never
 * penalises. Pure; the wiring into `lib/scoring/priority-score.ts` is the
 * integration step (gated), this is the ready-to-plug function.
 */

import type { WarmPath } from "./types";

/** Insider paths get the full weight; intro paths are discounted. */
const INSIDER_WEIGHT = 1.0;
const INTRO_WEIGHT = 0.6;
/** Hard cap on the boost so a warm path tilts ranking, not dominates it. */
const MAX_BOOST = 0.5;

export interface WarmScoreContribution {
  /** Multiplier ≥ 1 to apply to the accessibility term. */
  factor: number;
  /** Human reason for the "why this account" tooltip, or null when none. */
  reason: string | null;
}

export function warmPathScoreContribution(
  warmPath: WarmPath | null | undefined,
): WarmScoreContribution {
  if (!warmPath || warmPath.kind === "none" || warmPath.strength <= 0) {
    return { factor: 1, reason: null };
  }

  const weight = warmPath.kind === "insider" ? INSIDER_WEIGHT : INTRO_WEIGHT;
  const boost = Math.min(MAX_BOOST, warmPath.strength * weight);
  const factor = Number((1 + boost).toFixed(4));

  const n = warmPath.connectors.length;
  const reason =
    warmPath.kind === "insider"
      ? n > 0
        ? `Warm: ${n} connection${n > 1 ? "s" : ""} working here`
        : "Warm: insider connection"
      : n > 0
        ? `Warm: ${n} mutual connection${n > 1 ? "s" : ""} for an intro`
        : "Warm: intro path available";

  return { factor, reason };
}
