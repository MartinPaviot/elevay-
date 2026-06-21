/**
 * Contact → propensity bridge (Phase B). Turns a contact's real data into the
 * PropensityComponents and blends them. Pure: the recompute resolves the inputs
 * (depth from computeDepth, the signal lift, reachability flags, size/revenue)
 * and hands them here; the shadow-wiring stores the result alongside the fit
 * grade so we can prove propensity beats fit BEFORE flipping the grade.
 */
import {
  computePropensity,
  normalizeIntent,
  valueBand,
  type PropensityComponents,
  type PropensityWeights,
} from "./propensity";

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Reachability in [0,1] mirroring the accessibility weights (email .4, phone
 * .4, linkedin .2) with a warm-path bonus for a network connection, capped at 1.
 */
export function reachScore(r: {
  hasPhone?: boolean;
  hasEmail?: boolean;
  hasLinkedin?: boolean;
  inNetwork?: boolean;
}): number {
  let s = 0;
  if (r.hasEmail) s += 0.4;
  if (r.hasPhone) s += 0.4;
  if (r.hasLinkedin) s += 0.2;
  if (r.inNetwork) s += 0.2; // warm path
  return Math.min(1, s);
}

export interface ContactPropensityInput {
  /** computeDepth(...).depth01 — graded firmographic fit. */
  depth: number;
  /** signal-outcomes lift [0.5, 2.5]; default 1 (no positive signal). */
  signalMultiplier?: number;
  reach: { hasPhone?: boolean; hasEmail?: boolean; hasLinkedin?: boolean; inNetwork?: boolean };
  value: { employeeCount?: number | null; revenue?: number | null };
  penalties?: number;
  /** Learned per-tenant weights (B3); defaults to priors. */
  weights?: PropensityWeights;
}

export function assembleContactPropensity(input: ContactPropensityInput): {
  components: PropensityComponents;
  propensity: number;
} {
  const components: PropensityComponents = {
    depth: clamp01(input.depth),
    intent: normalizeIntent(input.signalMultiplier ?? 1),
    reach: reachScore(input.reach),
    value: valueBand(input.value),
  };
  return {
    components,
    propensity: computePropensity(components, input.weights, input.penalties ?? 0),
  };
}
