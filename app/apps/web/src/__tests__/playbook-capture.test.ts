import { describe, expect, it } from "vitest";
import {
  MAX_CONTENT_LENGTH,
  MIN_CONTENT_LENGTH,
  PLAYBOOK_ENTRY_TYPES,
  isPlaybookEntryType,
  validatePlaybookBatch,
  validatePlaybookEntry,
} from "@/lib/playbook/capture";

describe("validatePlaybookEntry", () => {
  it("accepts a well-formed objection", () => {
    const result = validatePlaybookEntry({
      type: "objection",
      content: "We already have a vendor for this.",
    });
    expect(result).toEqual({
      ok: true,
      entry: {
        type: "objection",
        content: "We already have a vendor for this.",
        outcomeLabel: null,
        perfScore: null,
      },
    });
  });

  it("accepts a well-formed accroche with perfScore and outcome", () => {
    const result = validatePlaybookEntry({
      type: "accroche",
      content: "Saw you onboarded 3 SREs last quarter — what changed?",
      outcomeLabel: "led_to_deep_dive",
      perfScore: 0.8,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.outcomeLabel).toBe("led_to_deep_dive");
      expect(result.entry.perfScore).toBe(0.8);
    }
  });

  it("rejects an unknown type", () => {
    const result = validatePlaybookEntry({
      type: "advice",
      content: "Some content here.",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Invalid type/);
    }
  });

  it("rejects empty content", () => {
    const result = validatePlaybookEntry({
      type: "question",
      content: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/too short/);
    }
  });

  it("rejects whitespace-only content (would survive trim to empty)", () => {
    expect(
      validatePlaybookEntry({ type: "question", content: "    " }).ok,
    ).toBe(false);
  });

  it("rejects content at MIN_CONTENT_LENGTH - 1 (boundary)", () => {
    const short = "x".repeat(MIN_CONTENT_LENGTH - 1);
    expect(
      validatePlaybookEntry({ type: "objection", content: short }).ok,
    ).toBe(false);
  });

  it("accepts content at exactly MIN_CONTENT_LENGTH", () => {
    const ok = "x".repeat(MIN_CONTENT_LENGTH);
    expect(
      validatePlaybookEntry({ type: "objection", content: ok }).ok,
    ).toBe(true);
  });

  it("rejects content above MAX_CONTENT_LENGTH (would be a transcript dump)", () => {
    const long = "x".repeat(MAX_CONTENT_LENGTH + 1);
    const result = validatePlaybookEntry({
      type: "objection",
      content: long,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/too long/);
    }
  });

  it("accepts content at exactly MAX_CONTENT_LENGTH", () => {
    const ok = "x".repeat(MAX_CONTENT_LENGTH);
    expect(
      validatePlaybookEntry({ type: "question", content: ok }).ok,
    ).toBe(true);
  });

  it("rejects perfScore > 1 (LLM may emit 1.5)", () => {
    const result = validatePlaybookEntry({
      type: "accroche",
      content: "Something compelling.",
      perfScore: 1.5,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/perfScore/);
    }
  });

  it("rejects negative perfScore", () => {
    expect(
      validatePlaybookEntry({
        type: "accroche",
        content: "Something compelling.",
        perfScore: -0.1,
      }).ok,
    ).toBe(false);
  });

  it("rejects NaN perfScore", () => {
    expect(
      validatePlaybookEntry({
        type: "accroche",
        content: "Something compelling.",
        perfScore: NaN,
      }).ok,
    ).toBe(false);
  });

  it("accepts perfScore = 0 (legitimately tried and didn't land)", () => {
    expect(
      validatePlaybookEntry({
        type: "objection",
        content: "Their stalled-deal objection.",
        perfScore: 0,
      }).ok,
    ).toBe(true);
  });

  it("accepts perfScore = 1 (boundary, perfect score)", () => {
    expect(
      validatePlaybookEntry({
        type: "accroche",
        content: "Something compelling.",
        perfScore: 1,
      }).ok,
    ).toBe(true);
  });

  it("trims content before measuring length", () => {
    const result = validatePlaybookEntry({
      type: "objection",
      content: "  hello world  ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.content).toBe("hello world");
    }
  });

  it("normalises an empty outcomeLabel to null", () => {
    const result = validatePlaybookEntry({
      type: "question",
      content: "What's their timeline?",
      outcomeLabel: "   ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.outcomeLabel).toBeNull();
    }
  });
});

describe("isPlaybookEntryType", () => {
  it("recognises the three documented kinds", () => {
    expect(PLAYBOOK_ENTRY_TYPES).toEqual([
      "objection",
      "accroche",
      "question",
    ]);
    for (const t of PLAYBOOK_ENTRY_TYPES) {
      expect(isPlaybookEntryType(t)).toBe(true);
    }
  });

  it("rejects unknown / wrong-shape values", () => {
    expect(isPlaybookEntryType("nope")).toBe(false);
    expect(isPlaybookEntryType("OBJECTION")).toBe(false); // case-sensitive
    expect(isPlaybookEntryType(42)).toBe(false);
    expect(isPlaybookEntryType(null)).toBe(false);
    expect(isPlaybookEntryType(undefined)).toBe(false);
  });
});

describe("validatePlaybookBatch", () => {
  it("partitions a mixed batch into accepted + rejected", () => {
    const result = validatePlaybookBatch([
      { type: "objection", content: "We already have a vendor." },
      { type: "wrong", content: "..." },
      { type: "accroche", content: "ok" }, // too short
      { type: "question", content: "What's the timeline here?" },
    ]);
    expect(result.accepted).toHaveLength(2);
    expect(result.rejected).toHaveLength(2);
    expect(result.rejected[0].index).toBe(1);
    expect(result.rejected[1].index).toBe(2);
  });

  it("returns empty arrays for an empty batch", () => {
    expect(validatePlaybookBatch([])).toEqual({
      accepted: [],
      rejected: [],
    });
  });

  it("preserves index for the caller's observability map", () => {
    const result = validatePlaybookBatch([
      { type: "objection", content: "Real one." },
      { type: "wrong", content: "..." },
    ]);
    expect(result.rejected[0].index).toBe(1);
  });
});
