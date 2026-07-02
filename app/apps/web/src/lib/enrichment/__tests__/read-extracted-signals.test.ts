import { describe, it, expect } from "vitest";
import { readActivitySignals } from "../read-extracted-signals";

/** A metadata blob shaped exactly as email-extract-runner.ts persists it. */
const runnerWritten = {
  subject: "Re: proposal",
  llmExtraction: {
    sentiment: "positive",
    sentimentConfidence: "high",
    intent: ["objection"],
    objections: ["seat pricing is too high for this year"],
    competitorsMentioned: ["Outreach"],
    budgetMentioned: "$40k/year",
    timeframeMentioned: null,
    nextSteps: [
      { owner: "sender", action: "loop in the CFO", dueDate: "2026-07-10" },
      { owner: "recipient", action: "send the security docs", dueDate: null },
    ],
    championSignals: ["I'll push this internally"],
    blockerSignals: [],
    decisionMakerMentioned: "CFO",
    isAutomated: false,
    extractedAt: "2026-07-01T00:00:00Z",
    modelId: "haiku",
  },
};

describe("readActivitySignals — the key the extractor ACTUALLY writes", () => {
  it("surfaces objections/nextSteps/champion/budget/competitors from llmExtraction", () => {
    const s = readActivitySignals(runnerWritten);
    expect(s.objections).toEqual(["seat pricing is too high for this year"]);
    expect(s.competitorMentions).toEqual(["Outreach"]);
    expect(s.budgetMentions).toEqual(["$40k/year"]);
    expect(s.championSignals).toEqual(["I'll push this internally"]);
    expect(s.nextSteps).toEqual([
      { action: "loop in the CFO", owner: "sender", dueDate: "2026-07-10" },
      { action: "send the security docs", owner: "recipient", dueDate: null },
    ]);
  });

  it("skips an automated-skip marker row", () => {
    const s = readActivitySignals({ llmExtraction: { skipped: "automated", detectedAt: "x" } });
    expect(s.objections).toEqual([]);
    expect(s.nextSteps).toEqual([]);
  });

  it("still reads the legacy extractedSignals snake_case shape", () => {
    const s = readActivitySignals({
      extractedSignals: {
        objections: ["too expensive"],
        next_steps: ["book a follow-up"],
        champion_signals: ["loves it"],
        budget_mentions: ["5k"],
        competitor_mentions: ["Acme"],
      },
    });
    expect(s.objections).toEqual(["too expensive"]);
    expect(s.nextSteps).toEqual([{ action: "book a follow-up", owner: "unknown", dueDate: null }]);
    expect(s.championSignals).toEqual(["loves it"]);
    expect(s.budgetMentions).toEqual(["5k"]);
    expect(s.competitorMentions).toEqual(["Acme"]);
  });

  it("merges both keys and tolerates malformed entries", () => {
    const s = readActivitySignals({
      llmExtraction: { ...runnerWritten.llmExtraction, nextSteps: [{ owner: "weird", action: "call" }, { action: 42 }, null] },
      extractedSignals: { objections: ["legacy one", 7, ""] },
    });
    expect(s.objections).toEqual(["seat pricing is too high for this year", "legacy one"]);
    expect(s.nextSteps).toEqual([{ action: "call", owner: "unknown", dueDate: null }]);
  });

  it("empty on null/absent metadata", () => {
    expect(readActivitySignals(null).objections).toEqual([]);
    expect(readActivitySignals({}).budgetMentions).toEqual([]);
  });
});
