/**
 * Learned propensity weights (Phase B3) — which component actually predicts
 * conversion for THIS tenant, from accumulated (components × outcome)
 * observations. Same spirit as signal-outcomes: a component's discriminative
 * power (converters' rate when the component is high vs low), shrunk toward the
 * priors by sample size, floored, and normalised to a valid weighting.
 *
 * Pure: the caller feeds the observations (a score_snapshot's stored propensity
 * components × whether that touch converted). Until enough data accrues per
 * component, the priors stand — never a guessed weight on thin evidence.
 */
import {
  DEFAULT_PROPENSITY_WEIGHTS,
  type PropensityComponents,
  type PropensityWeights,
} from "./propensity";

export interface PropensityObservation {
  components: PropensityComponents;
  converted: boolean;
}

const DEFAULT_MIN_SAMPLE = 20;

export function learnPropensityWeights(
  observations: PropensityObservation[],
  prior: PropensityWeights = DEFAULT_PROPENSITY_WEIGHTS,
  minSample: number = DEFAULT_MIN_SAMPLE,
): PropensityWeights {
  const keys = (Object.keys(prior) as Array<keyof PropensityWeights>).filter(
    (k) => typeof prior[k] === "number",
  );
  const raw: Partial<Record<keyof PropensityWeights, number>> = {};

  for (const k of keys) {
    const priorW = prior[k] as number;
    let hi = 0;
    let hiConv = 0;
    let lo = 0;
    let loConv = 0;
    for (const o of observations) {
      const c = o.components[k as keyof PropensityComponents];
      if (typeof c !== "number") continue;
      if (c >= 0.5) {
        hi++;
        if (o.converted) hiConv++;
      } else {
        lo++;
        if (o.converted) loConv++;
      }
    }
    const n = hi + lo;
    if (n < minSample || hi === 0 || lo === 0) {
      raw[k] = priorW; // not enough contrast → keep the prior
      continue;
    }
    const power = Math.max(0, hiConv / hi - loConv / lo); // discrimination [0,1]
    const conf = Math.min(1, n / (minSample * 5)); // full confidence at 5× minSample
    raw[k] = Math.max(0.01, priorW * (1 - conf) + power * conf);
  }

  const sum = keys.reduce((s, k) => s + (raw[k] ?? 0), 0) || 1;
  const out = {} as PropensityWeights;
  for (const k of keys) out[k] = (raw[k] as number) / sum;
  return out;
}
