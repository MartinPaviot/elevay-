import { describe, it, expect } from "vitest";
import { verifyAnswer, buildEvidence, NOT_FOUND_ANSWER } from "@/lib/inbox/ask-agent-verify";

const evidence = buildEvidence([
  { key: "t1", subject: "Acme", messageCount: 3 },
  { key: "t2", subject: "Beta", messageCount: 1 },
]);

describe("verifyAnswer", () => {
  it("keeps a grounded answer with valid citations", () => {
    const v = verifyAnswer({ answered: true, answer: "The value is 40k.", citations: [{ key: "t1", messageIdx: 0 }] }, evidence);
    expect(v.answered).toBe(true);
    expect(v.citations).toEqual([{ key: "t1", messageIdx: 0, subject: "Acme" }]);
  });
  it("drops a fabricated key and collapses to abstention", () => {
    const v = verifyAnswer({ answered: true, answer: "made up", citations: [{ key: "ghost" }] }, evidence);
    expect(v.answered).toBe(false);
    expect(v.answer).toBe(NOT_FOUND_ANSWER);
    expect(v.citations).toEqual([]);
  });
  it("drops an out-of-range message index (the clamp)", () => {
    const v = verifyAnswer({ answered: true, answer: "x", citations: [{ key: "t2", messageIdx: 5 }] }, evidence);
    expect(v.answered).toBe(false); // only citation was out of range → no valid citation
  });
  it("keeps an in-range index, drops an out-of-range one", () => {
    const v = verifyAnswer({ answered: true, answer: "x", citations: [{ key: "t1", messageIdx: 2 }, { key: "t1", messageIdx: 9 }] }, evidence);
    expect(v.answered).toBe(true);
    expect(v.citations).toEqual([{ key: "t1", messageIdx: 2, subject: "Acme" }]);
  });
  it("collapses an empty-citation answer to abstention", () => {
    expect(verifyAnswer({ answered: true, answer: "I think so", citations: [] }, evidence).answered).toBe(false);
  });
  it("honors an explicit abstention", () => {
    expect(verifyAnswer({ answered: false, answer: "", citations: [] }, evidence).answered).toBe(false);
  });
  it("de-dupes citations by key+idx", () => {
    const v = verifyAnswer({ answered: true, answer: "x", citations: [{ key: "t1" }, { key: "t1" }] }, evidence);
    expect(v.citations).toEqual([{ key: "t1", subject: "Acme" }]);
  });
  it("fail-closed on malformed input", () => {
    expect(verifyAnswer({ answered: true, answer: 42 as unknown as string, citations: "nope" as unknown as [] }, evidence).answered).toBe(false);
  });
});
