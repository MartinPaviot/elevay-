import { describe, it, expect } from "vitest";
import { filterMatches, foldExamples, type DeterministicFilter } from "@/lib/inbox/filter-match";

describe("filterMatches (INBOX-T02 deterministic core)", () => {
  const f: DeterministicFilter = {
    clauses: [{ field: "from", op: "contains", value: "billing@" }],
    join: "and",
    action: "label",
    labelId: "invoices",
  };

  it("fires on a deterministic criteria match", () => {
    expect(filterMatches({ from: "billing@acme.com" }, f)).toBe(true);
    expect(filterMatches({ from: "sales@acme.com" }, f)).toBe(false);
  });

  it("never fires with no criteria", () => {
    expect(filterMatches({ from: "x@y.com" }, { ...f, clauses: [] })).toBe(false);
  });
});

describe("foldExamples (correct/wrong preview loop)", () => {
  it("adds marks and dedupes by key with the latest winning", () => {
    const folded = foldExamples(
      [{ key: "a", correct: true }],
      [{ key: "b", correct: false }, { key: "a", correct: false }],
    );
    expect(folded).toHaveLength(2);
    expect(folded.find((e) => e.key === "a")!.correct).toBe(false); // re-marked wrong
    expect(folded.find((e) => e.key === "b")!.correct).toBe(false);
  });

  it("starts from nothing", () => {
    expect(foldExamples([], [{ key: "a", correct: true }])).toEqual([{ key: "a", correct: true }]);
  });
});
