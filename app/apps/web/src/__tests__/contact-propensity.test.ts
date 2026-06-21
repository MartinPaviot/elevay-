import { describe, it, expect } from "vitest";
import { assembleContactPropensity, reachScore } from "@/lib/scoring/contact-propensity";

describe("reachScore", () => {
  it("mirrors the accessibility weights with a capped network bonus", () => {
    expect(reachScore({})).toBe(0);
    expect(reachScore({ hasEmail: true })).toBeCloseTo(0.4, 5);
    expect(reachScore({ hasEmail: true, hasPhone: true })).toBeCloseTo(0.8, 5);
    expect(reachScore({ hasEmail: true, hasPhone: true, hasLinkedin: true })).toBe(1);
    expect(reachScore({ hasEmail: true, inNetwork: true })).toBeCloseTo(0.6, 5);
    expect(reachScore({ hasEmail: true, hasPhone: true, hasLinkedin: true, inNetwork: true })).toBe(1);
  });
});

describe("assembleContactPropensity", () => {
  it("builds the components from contact data and blends them", () => {
    const r = assembleContactPropensity({
      depth: 0.9,
      signalMultiplier: 2.5, // strong fresh signal → intent 1.0
      reach: { hasPhone: true, hasEmail: true },
      value: { employeeCount: 1000 }, // → 1.0
    });
    expect(r.components.intent).toBeCloseTo(1, 5);
    expect(r.components.value).toBeCloseTo(1, 5);
    expect(r.components.reach).toBeCloseTo(0.8, 5);
    expect(r.propensity).toBeGreaterThan(0.8);
  });

  it("defaults intent to 0 when there is no signal", () => {
    const r = assembleContactPropensity({ depth: 0.5, reach: {}, value: {} });
    expect(r.components.intent).toBe(0);
    expect(r.components.value).toBe(0);
    expect(r.components.reach).toBe(0);
  });
});
