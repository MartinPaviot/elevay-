import { describe, it, expect } from "vitest";
import { learnPropensityWeights, type PropensityObservation } from "@/lib/scoring/propensity-weights";
import { DEFAULT_PROPENSITY_WEIGHTS } from "@/lib/scoring/propensity";

function sum(w: { depth: number; intent: number; reach: number; value: number }) {
  return w.depth + w.intent + w.reach + w.value;
}

describe("learnPropensityWeights", () => {
  it("returns normalised priors when there is too little data", () => {
    const w = learnPropensityWeights([]);
    expect(sum(w)).toBeCloseTo(1, 5);
    expect(w.depth).toBeCloseTo(DEFAULT_PROPENSITY_WEIGHTS.depth, 5);
    expect(w.intent).toBeCloseTo(DEFAULT_PROPENSITY_WEIGHTS.intent, 5);
  });

  it("up-weights a component that discriminates converters", () => {
    // depth perfectly separates (high → converts, low → not); the rest are
    // constant 0.5 (no contrast, so they keep the prior).
    const obs: PropensityObservation[] = [];
    for (let i = 0; i < 120; i++) {
      const hiDepth = i % 2 === 0;
      obs.push({
        components: { depth: hiDepth ? 0.9 : 0.1, intent: 0.5, reach: 0.5, value: 0.5 },
        converted: hiDepth,
      });
    }
    const w = learnPropensityWeights(obs);
    expect(w.depth).toBeGreaterThan(w.intent);
    expect(w.depth).toBeGreaterThan(w.value);
    expect(w.depth).toBeGreaterThan(w.reach);
    expect(sum(w)).toBeCloseTo(1, 5);
  });

  it("keeps the prior for a component with no high/low contrast", () => {
    const obs: PropensityObservation[] = [];
    for (let i = 0; i < 120; i++) {
      const hiDepth = i % 2 === 0;
      obs.push({
        components: { depth: hiDepth ? 0.9 : 0.1, intent: 0.5, reach: 0.5, value: 0.5 },
        converted: hiDepth,
      });
    }
    const w = learnPropensityWeights(obs);
    // value/intent/reach had only a "high" cohort → no contrast → prior-driven,
    // so they stay well below the discriminating depth.
    expect(w.value).toBeLessThan(w.depth);
  });
});
