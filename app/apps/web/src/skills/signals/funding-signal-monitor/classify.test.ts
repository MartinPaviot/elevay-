import { describe, it, expect } from "vitest";
import { classifyFundingSignal } from "./classify";

const base = {
  minFundingAmount: 500_000,
  targetFundingStages: ["Seed", "Series A", "Series B", "Series C"],
};

describe("classifyFundingSignal — first sight is NOT new funding", () => {
  it("first sight (no prior baseline) records steady-state `funding`, never `funding_recent`", () => {
    // The wmo.int bug: Apollo returns a total_funding, we've never seen it
    // before → the old code called it 'new funding, reach out this week'.
    const out = classifyFundingSignal({
      ...base,
      currentFunding: 5_000_000,
      currentStage: null, // a UN agency has no funding stage
      previousFunding: null,
      previousStage: null,
    });
    expect(out.qualifies).toBe(true);
    expect(out.isNewFunding).toBe(false);
    expect(out.signalType).toBe("funding");
    expect(out.signalStrength).toBe("low"); // not new, not a target stage
  });

  it("first sight of a target-stage company is a 'well-funded target' (medium, funding)", () => {
    const out = classifyFundingSignal({
      ...base,
      currentFunding: 8_000_000,
      currentStage: "Series A",
      previousFunding: null,
      previousStage: null,
    });
    expect(out.isNewFunding).toBe(false);
    expect(out.isTargetStage).toBe(true);
    expect(out.signalType).toBe("funding");
    expect(out.signalStrength).toBe("medium");
  });

  it("a real 10%+ increase against a baseline IS new funding (funding_recent)", () => {
    const out = classifyFundingSignal({
      ...base,
      currentFunding: 12_000_000,
      currentStage: "Series B",
      previousFunding: 8_000_000, // observed baseline
      previousStage: "Series A",
    });
    expect(out.isNewFunding).toBe(true);
    expect(out.signalType).toBe("funding_recent");
    expect(out.signalStrength).toBe("high"); // new + target stage
  });

  it("a stage change against a baseline is new funding even without a big amount jump", () => {
    const out = classifyFundingSignal({
      ...base,
      currentFunding: 8_100_000,
      currentStage: "Series B",
      previousFunding: 8_000_000, // <10% jump
      previousStage: "Series A", // but the stage moved
    });
    expect(out.isNewFunding).toBe(true);
    expect(out.signalType).toBe("funding_recent");
  });

  it("a flat re-observation (same funding, same stage) is not new", () => {
    const out = classifyFundingSignal({
      ...base,
      currentFunding: 8_000_000,
      currentStage: "Series A",
      previousFunding: 8_000_000,
      previousStage: "Series A",
    });
    expect(out.isNewFunding).toBe(false);
    expect(out.signalType).toBe("funding");
    expect(out.signalStrength).toBe("medium"); // still a target stage
  });

  it("below the minimum amount does not qualify at all", () => {
    const out = classifyFundingSignal({
      ...base,
      currentFunding: 100_000,
      currentStage: "Seed",
      previousFunding: null,
      previousStage: null,
    });
    expect(out.qualifies).toBe(false);
  });

  it("null current funding does not qualify", () => {
    const out = classifyFundingSignal({
      ...base,
      currentFunding: null,
      currentStage: null,
      previousFunding: 5_000_000,
      previousStage: "Series A",
    });
    expect(out.qualifies).toBe(false);
    expect(out.isNewFunding).toBe(false);
  });
});
