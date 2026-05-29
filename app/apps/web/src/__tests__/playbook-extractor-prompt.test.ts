import { describe, expect, it } from "vitest";
import {
  MAX_ENTRIES_PER_INTERACTION,
  buildExtractionPrompt,
  extractionResponseSchema,
} from "@/lib/playbook/extractor-prompt";
import { PLAYBOOK_ENTRY_TYPES } from "@/lib/playbook/capture";

describe("buildExtractionPrompt", () => {
  it("renders the three required playbook types in the rule list", () => {
    const prompt = buildExtractionPrompt({
      interactionType: "meeting_completed",
      direction: "outbound",
      content: "Some short content.",
    });
    for (const t of PLAYBOOK_ENTRY_TYPES) {
      expect(prompt).toContain(t);
    }
  });

  it("includes interaction type and direction in the context block", () => {
    const prompt = buildExtractionPrompt({
      interactionType: "call_completed",
      direction: "outbound",
      content: "x".repeat(200),
    });
    expect(prompt).toContain("Type: call_completed");
    expect(prompt).toContain("Direction: outbound");
  });

  it("includes deal stage when supplied", () => {
    const prompt = buildExtractionPrompt({
      interactionType: "meeting_completed",
      direction: "outbound",
      dealStage: "qualification",
      content: "x".repeat(200),
    });
    expect(prompt).toContain("Deal stage: qualification");
  });

  it("omits the deal stage line when not supplied (no 'Deal stage: undefined' leak)", () => {
    const prompt = buildExtractionPrompt({
      interactionType: "meeting_completed",
      direction: "outbound",
      content: "x".repeat(200),
    });
    expect(prompt).not.toContain("Deal stage:");
    expect(prompt).not.toContain("undefined");
  });

  it("includes contact title when supplied", () => {
    const prompt = buildExtractionPrompt({
      interactionType: "meeting_completed",
      direction: "outbound",
      contactTitle: "Head of Platform",
      content: "x".repeat(200),
    });
    expect(prompt).toContain("Contact title: Head of Platform");
  });

  it("does NOT truncate content under the 4000-char limit", () => {
    const content = "x".repeat(3000);
    const prompt = buildExtractionPrompt({
      interactionType: "meeting_completed",
      direction: "outbound",
      content,
    });
    expect(prompt).toContain(content);
    expect(prompt).not.toContain("transcript truncated");
  });

  it("truncates content above 4000 chars and tags it as truncated", () => {
    const content = "x".repeat(5000);
    const prompt = buildExtractionPrompt({
      interactionType: "meeting_completed",
      direction: "outbound",
      content,
    });
    expect(prompt).toContain("transcript truncated");
    // Body length capped to 4000 + the truncation marker
    expect(prompt.split("transcript truncated")[0].length).toBeGreaterThan(0);
  });

  it("documents the MAX_ENTRIES_PER_INTERACTION cap in the prompt", () => {
    const prompt = buildExtractionPrompt({
      interactionType: "meeting_completed",
      direction: "outbound",
      content: "x".repeat(200),
    });
    expect(prompt).toContain(String(MAX_ENTRIES_PER_INTERACTION));
    expect(MAX_ENTRIES_PER_INTERACTION).toBe(6);
  });

  it("instructs the model NOT to invent entries (refuses padding)", () => {
    const prompt = buildExtractionPrompt({
      interactionType: "meeting_completed",
      direction: "outbound",
      content: "x".repeat(200),
    });
    expect(prompt).toMatch(/Do NOT invent/i);
  });
});

describe("extractionResponseSchema", () => {
  it("accepts an empty entries array (no learnings from the call)", () => {
    expect(extractionResponseSchema.parse({ entries: [] })).toEqual({
      entries: [],
    });
  });

  it("accepts a well-formed batch of 3 entries", () => {
    const result = extractionResponseSchema.parse({
      entries: [
        { type: "objection", content: "We already have a vendor." },
        {
          type: "accroche",
          content: "Saw you hired 3 SREs last quarter.",
        },
        { type: "question", content: "What's the timeline?" },
      ],
    });
    expect(result.entries).toHaveLength(3);
  });

  it("rejects an entry with an unknown type", () => {
    expect(() =>
      extractionResponseSchema.parse({
        entries: [{ type: "advice", content: "Just be nicer." }],
      }),
    ).toThrow();
  });

  it("rejects content below MIN_CONTENT_LENGTH", () => {
    expect(() =>
      extractionResponseSchema.parse({
        entries: [{ type: "objection", content: "no" }],
      }),
    ).toThrow();
  });

  it("rejects content above MAX_CONTENT_LENGTH (transcript dump)", () => {
    expect(() =>
      extractionResponseSchema.parse({
        entries: [
          {
            type: "objection",
            content: "x".repeat(2001),
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects more than MAX_ENTRIES_PER_INTERACTION entries (padding refused)", () => {
    const tooMany = Array.from(
      { length: MAX_ENTRIES_PER_INTERACTION + 1 },
      (_, i) => ({
        type: "objection" as const,
        content: `Real objection number ${i + 1}.`,
      }),
    );
    expect(() =>
      extractionResponseSchema.parse({ entries: tooMany }),
    ).toThrow();
  });

  it("accepts exactly MAX_ENTRIES_PER_INTERACTION entries (boundary)", () => {
    const exact = Array.from(
      { length: MAX_ENTRIES_PER_INTERACTION },
      (_, i) => ({
        type: "objection" as const,
        content: `Real objection number ${i + 1}.`,
      }),
    );
    expect(
      extractionResponseSchema.parse({ entries: exact }).entries,
    ).toHaveLength(MAX_ENTRIES_PER_INTERACTION);
  });

  it("rejects perfScore out of [0,1]", () => {
    expect(() =>
      extractionResponseSchema.parse({
        entries: [
          {
            type: "accroche",
            content: "Solid hook here.",
            perfScore: 1.5,
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts null outcomeLabel and null perfScore (not set by the model)", () => {
    const result = extractionResponseSchema.parse({
      entries: [
        {
          type: "objection",
          content: "Vendor lock-in worry.",
          outcomeLabel: null,
          perfScore: null,
        },
      ],
    });
    expect(result.entries[0].outcomeLabel).toBeNull();
    expect(result.entries[0].perfScore).toBeNull();
  });
});
