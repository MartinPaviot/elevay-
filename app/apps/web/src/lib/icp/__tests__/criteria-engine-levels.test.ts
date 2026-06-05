import { describe, it, expect } from "vitest";
import { computeIcpFitLevels, type Criterion } from "../criteria-engine";

// A signal-heavy ICP: cheap identity criteria + a heavy `technologies`
// weight + a `keywords` signal — the shape that makes clean registry
// companies score < 0.5 today.
const ICP: Criterion[] = [
  { id: "geo", fieldKey: "geography", operator: "eq", value: "France", weight: 1, isRequired: false },
  { id: "ind", fieldKey: "industry", operator: "contains", value: "software", weight: 1, isRequired: false },
  { id: "emp", fieldKey: "employee_count", operator: "between", value: { min: 50, max: 200 }, weight: 1, isRequired: false },
  { id: "tech", fieldKey: "technologies", operator: "in", value: ["react", "aws"], weight: 3, isRequired: false },
  { id: "kw", fieldKey: "keywords", operator: "contains", value: "saas", weight: 2, isRequired: false },
];

describe("computeIcpFitLevels", () => {
  it("a clean registry company (no signals) qualifies on identity though combined < 0.5", () => {
    const ctx = { geography: "France", industry: "Software", employee_count: 120 };
    const r = computeIcpFitLevels(ICP, ctx);
    expect(r.identityFit).toBe(1); // sector + geo + size all match
    expect(r.signalFit).toBe(0); // no tech/keywords data → not counted, not penalised
    expect(r.fitScore).toBeCloseTo(3 / 8); // the legacy penalising score: 0.375 < 0.5
    expect(r.coverage).toBeCloseTo(3 / 8); // only 3 of 8 soft weight was evaluable
  });

  it("a fully enriched matching company scores 1 on both levels", () => {
    const ctx = {
      geography: "France", industry: "Software", employee_count: 120,
      technologies: ["react"], keywords: ["B2B SaaS platform"],
    };
    const r = computeIcpFitLevels(ICP, ctx);
    expect(r.identityFit).toBe(1);
    expect(r.signalFit).toBe(1);
    expect(r.coverage).toBe(1);
    expect(r.fitScore).toBe(1);
  });

  it("a present-but-mismatched signal lowers signalFit, not identityFit", () => {
    const ctx = { geography: "France", industry: "Software", employee_count: 120, technologies: ["php"] };
    const r = computeIcpFitLevels(ICP, ctx);
    expect(r.identityFit).toBe(1);
    expect(r.signalFit).toBe(0); // tech evaluated (data present) but no overlap
    expect(r.coverage).toBeCloseTo(6 / 8); // identity(3) + tech(3) evaluable, keywords absent
  });

  it("a partial-identity match scores proportionally", () => {
    // matches geo + industry but employee_count out of range
    const ctx = { geography: "France", industry: "Software", employee_count: 5 };
    const r = computeIcpFitLevels(ICP, ctx);
    expect(r.identityFit).toBeCloseTo(2 / 3); // 2 of 3 identity weights
    expect(r.signalFit).toBe(0);
  });

  it("an unmatched REQUIRED criterion still zeroes everything (hard filter preserved)", () => {
    const required: Criterion[] = [
      { id: "geoReq", fieldKey: "geography", operator: "eq", value: "Switzerland", weight: 1, isRequired: true },
      ...ICP.slice(1),
    ];
    const ctx = { geography: "France", industry: "Software", employee_count: 120 };
    const r = computeIcpFitLevels(required, ctx);
    expect(r.excludedBy).toBe("geoReq");
    expect(r.fitScore).toBe(0);
    expect(r.identityFit).toBe(0);
    expect(r.signalFit).toBe(0);
  });
});
