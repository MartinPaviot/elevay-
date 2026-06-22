import { describe, it, expect } from "vitest";
import {
  evaluateAbTest,
  normalCdf,
  twoProportionZTest,
  DEFAULT_MIN_SAMPLE,
  type AbVariant,
} from "../index";

const v = (id: string, sent: number, replies: number, over: Partial<AbVariant> = {}): AbVariant => ({
  variantId: id,
  axis: "subject",
  axisValue: id,
  sent,
  replies,
  positiveReplies: over.positiveReplies ?? 0,
  ...over,
});

describe("normalCdf / twoProportionZTest", () => {
  it("normalCdf is calibrated", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 3);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 2);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 2);
  });
  it("identical proportions → z 0, p 1", () => {
    const r = twoProportionZTest({ conversions: 50, trials: 1000 }, { conversions: 50, trials: 1000 });
    expect(r.z).toBe(0);
    expect(r.pValue).toBe(1);
  });
  it("a large clear difference → small p-value", () => {
    const r = twoProportionZTest({ conversions: 100, trials: 1000 }, { conversions: 30, trials: 1000 });
    expect(r.pValue).toBeLessThan(0.001);
  });
});

describe("evaluateAbTest — AC2 minimum sample", () => {
  it("under-sample → insufficient_data, never a winner", () => {
    const r = evaluateAbTest([v("a", 50, 10), v("b", 50, 2)]); // 50 < 100
    expect(r.verdict).toBe("insufficient_data");
    expect(r.winnerId).toBeUndefined();
  });
  it("exactly the minimum sample is allowed to verdict", () => {
    const r = evaluateAbTest([v("a", DEFAULT_MIN_SAMPLE, 5), v("b", DEFAULT_MIN_SAMPLE, 5)]);
    expect(r.verdict).not.toBe("insufficient_data");
  });
});

describe("evaluateAbTest — AC3 winner vs no-difference", () => {
  it("a known-null dataset never returns a winner", () => {
    const r = evaluateAbTest([v("a", 1000, 50), v("b", 1000, 50)]);
    expect(r.verdict).toBe("no_significant_difference");
    expect(r.winnerId).toBeUndefined();
  });

  it("a clearly-different dataset declares the higher-rate winner", () => {
    const r = evaluateAbTest([v("a", 1000, 100), v("b", 1000, 30)]);
    expect(r.verdict).toBe("winner");
    expect(r.winnerId).toBe("a");
    expect(r.pValue!).toBeLessThan(0.05);
  });

  it("a small, noisy difference is not a winner", () => {
    const r = evaluateAbTest([v("a", 200, 11), v("b", 200, 10)]);
    expect(r.verdict).toBe("no_significant_difference");
  });

  it("respects the positive-reply metric", () => {
    const r = evaluateAbTest(
      [v("a", 1000, 200, { positiveReplies: 40 }), v("b", 1000, 200, { positiveReplies: 10 })],
      { metric: "positive" },
    );
    expect(r.metric).toBe("positive");
    expect(r.verdict).toBe("winner");
    expect(r.winnerId).toBe("a");
  });
});

describe("evaluateAbTest — AC4 one-axis + guards", () => {
  it("mixed axes → inconclusive with a reason", () => {
    const r = evaluateAbTest([v("a", 1000, 100, { axis: "subject" }), v("b", 1000, 30, { axis: "cta" })]);
    expect(r.verdict).toBe("inconclusive");
    expect(r.reason).toContain("mixed axes");
  });
  it("fewer than two variants → inconclusive", () => {
    expect(evaluateAbTest([v("a", 1000, 100)]).verdict).toBe("inconclusive");
  });
});

describe("evaluateAbTest — AC5 exposed result shape", () => {
  it("exposes verdict, pValue, and the comparison for the dashboard/agent", () => {
    const r = evaluateAbTest([v("a", 1000, 100), v("b", 1000, 30)]);
    expect(r.comparison).toMatchObject({ a: "a", b: "b" });
    expect(typeof r.comparison!.rateA).toBe("number");
    expect(typeof r.pValue).toBe("number");
  });
});
