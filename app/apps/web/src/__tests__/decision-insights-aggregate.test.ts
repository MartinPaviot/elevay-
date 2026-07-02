import { describe, it, expect } from "vitest";

/**
 * T9 (outreach-autopilot) — pure aggregation over the T7 snapshots + T8
 * positivity. The synthetic 30-decision dataset below is the Done-criteria
 * dataset: exactly one bucket reaches both floors (n >= 10 AND |lift| >=
 * 0.1), a 9-decision bucket never publishes even with a huge lift, and a
 * within-floor bucket never publishes even with n >= 10.
 */

import {
  bucketKey,
  computeInsights,
  describeBucket,
  MIN_PATTERN_N,
  LIFT_FLOOR,
  type DecisionForInsights,
} from "@/lib/decision-insights/aggregate";

/** One decision with the standard T7 snapshot shape. */
function decision(
  persona: Record<string, unknown> | null,
  signalType: string | null,
  positivity: number | null,
): DecisionForInsights {
  return {
    persona,
    signal:
      signalType === null
        ? null
        : { type: signalType, detected_at: "2026-06-01", source: "test", freshness_days: 3 },
    positivity,
  };
}

const CTO_FUNDING = {
  seniority: "senior",
  function: "CTO",
  company_size: "51-200",
  sector: "SaaS",
  maturity: null,
};
const OPS_NONE = {
  seniority: "mid",
  function: "Head of Ops",
  company_size: "11-50",
  sector: "Logistics",
  maturity: null,
};
const CEO_HIRING = {
  seniority: "exec",
  function: "CEO",
  company_size: "1-10",
  sector: "Fintech",
  maturity: null,
};

/**
 * The 30-decision synthetic dataset. Hand-computed expectations:
 *   bucket A (CTO x funding):  12 decisions @ 0.9 -> sum 10.8
 *   bucket B (Ops  x none):     9 decisions @ 0.1 -> sum  0.9
 *   bucket C (CEO  x hiring):   9 decisions @ 0.5 -> sum  4.5
 *   baseline = (10.8 + 0.9 + 4.5) / 30 = 16.2 / 30 = 0.54
 *   lift A   = 0.9 - 0.54 = +0.36  -> published (n=12 >= 10, |lift| >= 0.1)
 *   lift B   = 0.1 - 0.54 = -0.44  -> NOT published (n=9 < 10)
 *   lift C   = 0.5 - 0.54 = -0.04  -> NOT published (n=9 AND |lift| < 0.1)
 */
function thirtyDecisions(): DecisionForInsights[] {
  return [
    ...Array.from({ length: 12 }, () => decision(CTO_FUNDING, "funding", 0.9)),
    ...Array.from({ length: 9 }, () => decision(OPS_NONE, null, 0.1)),
    ...Array.from({ length: 9 }, () => decision(CEO_HIRING, "hiring", 0.5)),
  ];
}

describe("bucketKey", () => {
  it("projects persona + signal TYPE into the five-field bucket (maturity and signal freshness dropped)", () => {
    const key = bucketKey(CTO_FUNDING, {
      type: "funding",
      detected_at: "2026-06-01",
      source: "apollo",
      freshness_days: 3,
    });
    expect(key).toEqual({
      seniority: "senior",
      function: "CTO",
      company_size: "51-200",
      sector: "SaaS",
      signal_type: "funding",
    });
  });

  it("null persona / null signal degrade to an all-null bucket, never throw", () => {
    expect(bucketKey(null, null)).toEqual({
      seniority: null,
      function: null,
      company_size: null,
      sector: null,
      signal_type: null,
    });
  });

  it("normalizes numeric sizes and blank strings", () => {
    const key = bucketKey({ company_size: 120, sector: "  " }, { type: "" });
    expect(key.company_size).toBe("120");
    expect(key.sector).toBeNull();
    expect(key.signal_type).toBeNull();
  });
});

describe("computeInsights — the 30-decision Done dataset", () => {
  it("publishes exactly the one bucket passing both floors, with correct n / baseline / lift", () => {
    const { total, baseline, patterns } = computeInsights(thirtyDecisions());

    expect(total).toBe(30);
    expect(baseline).toBeCloseTo(0.54, 10);

    expect(patterns).toHaveLength(1);
    const [p] = patterns;
    expect(p.pattern).toEqual({
      seniority: "senior",
      function: "CTO",
      company_size: "51-200",
      sector: "SaaS",
      signal_type: "funding",
    });
    expect(p.n).toBe(12);
    expect(p.positivityAvg).toBeCloseTo(0.9, 10);
    expect(p.baseline).toBeCloseTo(0.54, 10);
    expect(p.lift).toBeCloseTo(0.36, 10);
  });

  it("an n=9 bucket is NOT published even with the largest |lift| in the set", () => {
    const { patterns } = computeInsights(thirtyDecisions());
    // Bucket B (|lift| = 0.44, the largest) is absent: n = 9 < MIN_PATTERN_N.
    expect(MIN_PATTERN_N).toBe(10);
    expect(
      patterns.find((p) => p.pattern.function === "Head of Ops"),
    ).toBeUndefined();
  });

  it("a bucket inside the lift floor is NOT published even with n >= 10", () => {
    // Two 10-decision buckets straddling the mean by 0.025 each:
    // baseline = 0.525, lifts = -0.025 / +0.025, both < LIFT_FLOOR.
    const decisions = [
      ...Array.from({ length: 10 }, () => decision(CTO_FUNDING, "funding", 0.5)),
      ...Array.from({ length: 10 }, () => decision(OPS_NONE, null, 0.55)),
    ];
    const { baseline, patterns } = computeInsights(decisions);
    expect(LIFT_FLOOR).toBe(0.1);
    expect(baseline).toBeCloseTo(0.525, 10);
    expect(patterns).toHaveLength(0);
  });

  it("a NEGATIVE-lift bucket passing both floors publishes (it reduces volume)", () => {
    // 20 @ 0.9 + 10 @ 0.1: baseline = 19/30 = 0.6333...,
    // lift(A) = +0.2667 (n=20), lift(B) = -0.5333 (n=10) -> both publish.
    const decisions = [
      ...Array.from({ length: 20 }, () => decision(CTO_FUNDING, "funding", 0.9)),
      ...Array.from({ length: 10 }, () => decision(OPS_NONE, null, 0.1)),
    ];
    const { patterns } = computeInsights(decisions);
    expect(patterns).toHaveLength(2);
    const neg = patterns.find((p) => p.lift < 0)!;
    expect(neg.n).toBe(10);
    expect(neg.lift).toBeCloseTo(0.1 - 19 / 30, 10);
  });

  it("rows without a numeric positivity are skipped from both bucket and baseline", () => {
    const decisions = [
      ...Array.from({ length: 12 }, () => decision(CTO_FUNDING, "funding", 0.9)),
      ...Array.from({ length: 12 }, () => decision(OPS_NONE, null, 0.3)),
      decision(CTO_FUNDING, "funding", null),
      decision(CTO_FUNDING, "funding", Number.NaN),
    ];
    const { total, baseline } = computeInsights(decisions);
    expect(total).toBe(24);
    expect(baseline).toBeCloseTo(0.6, 10);
  });

  it("an empty dataset yields no baseline and no patterns", () => {
    expect(computeInsights([])).toEqual({ total: 0, baseline: null, patterns: [] });
  });

  it("orders published patterns by |lift| descending (strongest evidence first)", () => {
    const decisions = [
      ...Array.from({ length: 10 }, () => decision(CTO_FUNDING, "funding", 0.95)),
      ...Array.from({ length: 10 }, () => decision(OPS_NONE, null, 0.05)),
      ...Array.from({ length: 10 }, () => decision(CEO_HIRING, "hiring", 0.55)),
    ];
    const { patterns } = computeInsights(decisions);
    const lifts = patterns.map((p) => Math.abs(p.lift));
    expect(lifts).toEqual([...lifts].sort((a, b) => b - a));
  });
});

describe("describeBucket", () => {
  it("renders known fields and an explicit signal=none", () => {
    expect(
      describeBucket({
        seniority: "senior",
        function: null,
        company_size: null,
        sector: "SaaS",
        signal_type: null,
      }),
    ).toBe("seniority=senior, sector=SaaS, signal=none");
  });
});
