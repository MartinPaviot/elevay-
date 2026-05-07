import { describe, it, expect } from "vitest";
import {
  locateCitations,
  citationAccuracy,
  extractQuotedSpans,
  verifyQuotes,
  verbatimScore,
  refusalDetected,
  detectUngroundedClaims,
  scoreGrounding,
} from "@/lib/coaching/grounded-eval";
import type { RetrievedChunk } from "@/lib/coaching/retrieve-transcript-chunks";

function chunk(
  startSec: number,
  text: string,
  meetingId: string = "m1",
  speaker: string | null = "Sarah",
): RetrievedChunk {
  return {
    meetingId,
    speaker,
    startSec,
    endSec: startSec + 8,
    text,
    similarity: 0.9,
    source: "recall_bot",
    promptLine: `[${Math.floor(startSec / 60)}:${String(startSec % 60).padStart(2, "0")}${
      speaker ? `, ${speaker}` : ""
    }]: "${text}"`,
  };
}

describe("locateCitations", () => {
  const chunks = [
    chunk(60, "We don't have budget for $50K right now."),
    chunk(180, "Let's revisit in Q4 once we close the round."),
    chunk(300, "Acme Tools is the competitor we're evaluating."),
  ];

  it("matches a citation pointing at exactly a chunk's startSec", () => {
    const out = `Sarah said [1:00] "We don't have budget for $50K right now."`;
    const findings = locateCitations(out, chunks);
    expect(findings).toHaveLength(1);
    expect(findings[0].matchesChunk).toBe(true);
    expect(findings[0].matchedChunk?.startSec).toBe(60);
  });

  it("tolerates ±30s drift between citation and chunk", () => {
    const out = `She said [3:10] "revisit in Q4"`;
    const findings = locateCitations(out, chunks);
    // 190s vs chunk[1].startSec=180 → 10s delta, within tolerance.
    expect(findings[0].matchesChunk).toBe(true);
  });

  it("flags citations >30s from any chunk as unmatched", () => {
    const out = `He said [10:00] "made-up quote"`;
    const findings = locateCitations(out, chunks);
    expect(findings[0].matchesChunk).toBe(false);
  });

  it("returns empty when no citations in output", () => {
    expect(locateCitations("Plain prose with no markers.", chunks)).toHaveLength(0);
  });

  it("handles multiple citations independently", () => {
    // 1:00 → matches chunk[0] (60s, ±30 tolerance)
    // 3:00 → matches chunk[1] (180s)
    // 15:00 → 900s, no chunk within tolerance → unmatched
    const out = `[1:00] then [3:00] then [15:00]`;
    const findings = locateCitations(out, chunks);
    expect(findings).toHaveLength(3);
    expect(findings[0].matchesChunk).toBe(true);
    expect(findings[1].matchesChunk).toBe(true);
    expect(findings[2].matchesChunk).toBe(false);
  });
});

describe("citationAccuracy", () => {
  const chunks = [
    chunk(60, "Hello."),
    chunk(180, "World."),
  ];

  it("returns 1.0 when no citations exist (vacuous truth)", () => {
    expect(citationAccuracy("plain text", chunks)).toEqual({
      score: 1,
      total: 0,
      correct: 0,
    });
  });

  it("returns 1.0 when all citations match", () => {
    expect(citationAccuracy("[1:00] [3:00]", chunks).score).toBe(1);
  });

  it("returns 0.5 when half match", () => {
    // [1:00] → chunk[0] (60s, match) ; [15:00] → 900s, no chunk
    // within tolerance → unmatched.
    expect(citationAccuracy("[1:00] [15:00]", chunks).score).toBe(0.5);
  });

  it("returns 0.0 when none match", () => {
    // 600s, 1200s, 1800s — none within ±30s of chunk starts (60, 180).
    expect(citationAccuracy("[10:00] [20:00] [30:00]", chunks).score).toBe(0);
  });
});

describe("extractQuotedSpans", () => {
  it("extracts straight double-quoted spans", () => {
    const text = `She said "we don't have budget" and "let's revisit Q4".`;
    const spans = extractQuotedSpans(text);
    expect(spans).toEqual(["we don't have budget", "let's revisit Q4"]);
  });

  it("extracts smart quotes too", () => {
    const text = `He said “hello there”.`;
    const spans = extractQuotedSpans(text);
    expect(spans).toEqual(["hello there"]);
  });

  it("ignores spans shorter than 4 chars (skip [a:b] markers)", () => {
    expect(extractQuotedSpans(`"hi" "yo"`)).toHaveLength(0);
  });

  it("ignores spans longer than 400 chars (likely garbage)", () => {
    const huge = "x".repeat(401);
    expect(extractQuotedSpans(`"${huge}"`)).toHaveLength(0);
  });
});

describe("verifyQuotes / verbatimScore", () => {
  const chunks = [
    chunk(60, "We don't have budget for $50K right now."),
    chunk(180, "Let's revisit in Q4 once we close the round."),
  ];

  it("flags verbatim quotes as such", () => {
    const out = `She said "we don't have budget for $50K right now."`;
    expect(verifyQuotes(out, chunks)[0].verbatim).toBe(true);
    expect(verbatimScore(out, chunks).score).toBe(1);
  });

  it("flags paraphrased quotes as non-verbatim", () => {
    const out = `She said "we lack the funds for fifty thousand dollars."`;
    expect(verifyQuotes(out, chunks)[0].verbatim).toBe(false);
    expect(verbatimScore(out, chunks).score).toBe(0);
  });

  it("returns 1.0 score when no quotes (vacuous)", () => {
    expect(verbatimScore("no quotes here", chunks).score).toBe(1);
  });

  it("is case-insensitive on the verbatim match", () => {
    const out = `"WE DON'T HAVE BUDGET for $50K right now."`;
    expect(verifyQuotes(out, chunks)[0].verbatim).toBe(true);
  });
});

describe("refusalDetected", () => {
  it("matches the canonical refusal templates", () => {
    expect(refusalDetected("I don't have evidence in the transcript.")).toBe(true);
    expect(refusalDetected("No evidence in the transcript for this question.")).toBe(true);
    expect(refusalDetected("No relevant transcript chunks were retrieved.")).toBe(true);
    expect(refusalDetected("The transcript doesn't cover this topic.")).toBe(true);
    expect(refusalDetected("I don't have enough context in the transcript.")).toBe(true);
  });

  it("returns false on confident answers", () => {
    expect(refusalDetected("Sarah said the budget is $50K.")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(refusalDetected("I DON'T HAVE EVIDENCE IN THE TRANSCRIPT")).toBe(true);
  });
});

describe("detectUngroundedClaims", () => {
  const chunks = [
    chunk(60, "Budget is $50K and we close in Q4 2026."),
    chunk(180, "Acme Tools is the competitor we're evaluating."),
  ];

  it("flags dollar amounts not in chunks", () => {
    const out = "The deal is worth $200K total.";
    const ungrounded = detectUngroundedClaims(out, chunks);
    expect(ungrounded).toContain("$200K");
  });

  it("does not flag amounts that ARE in chunks", () => {
    const out = "Budget is $50K.";
    expect(detectUngroundedClaims(out, chunks)).not.toContain("$50K");
  });

  it("flags percentages not in chunks", () => {
    const out = "Win rate dropped to 32%.";
    expect(detectUngroundedClaims(out, chunks)).toContain("32%");
  });

  it("flags years not present in chunks", () => {
    const out = "They're targeting 2030.";
    expect(detectUngroundedClaims(out, chunks)).toContain("2030");
  });

  it("does not flag years that ARE in chunks", () => {
    const out = "Closing Q4 2026.";
    expect(detectUngroundedClaims(out, chunks)).not.toContain("2026");
  });

  it("flags named-entity tokens absent from chunks", () => {
    const out = "John Stevenson is the decision-maker.";
    expect(detectUngroundedClaims(out, chunks)).toContain("John Stevenson");
  });

  it("does not flag entities present in chunks", () => {
    const out = "Acme Tools is mentioned.";
    expect(detectUngroundedClaims(out, chunks)).not.toContain("Acme Tools");
  });

  it("dedupes repeated suspicious tokens", () => {
    const out = "$200K is the ask. The $200K deal expires soon.";
    const ungrounded = detectUngroundedClaims(out, chunks);
    expect(ungrounded.filter((s) => s === "$200K")).toHaveLength(1);
  });
});

describe("scoreGrounding aggregate", () => {
  const chunks = [
    chunk(60, "Budget is $50K and we close in Q4 2026."),
    chunk(180, "Acme Tools is the competitor."),
  ];

  it("perfect output gets a near-1.0 overall score", () => {
    const out = `[1:00] "Budget is $50K and we close in Q4 2026." So budget is fixed.`;
    const score = scoreGrounding(out, chunks);
    expect(score.overall).toBeGreaterThan(0.85);
    expect(score.citationAccuracy).toBe(1);
    expect(score.verbatim).toBe(1);
  });

  it("hallucinated content drives overall score down", () => {
    const out = `[1:00] Budget is $200K and they're using Salesforce.`;
    const score = scoreGrounding(out, chunks);
    expect(score.overall).toBeLessThan(0.85);
    expect(score.ungroundedClaims.length).toBeGreaterThan(0);
  });

  it("wrong citation timestamp tanks citationAccuracy", () => {
    const out = `[10:00] something happened.`;
    expect(scoreGrounding(out, chunks).citationAccuracy).toBe(0);
  });

  it("non-verbatim quote drops verbatim sub-score", () => {
    const out = `[1:00] "We have no money for fifty K right now."`;
    expect(scoreGrounding(out, chunks).verbatim).toBe(0);
  });

  it("output without claims (empty / refusal) gets 1.0 grounded rate", () => {
    expect(scoreGrounding("", chunks).groundedClaimsRate).toBe(1);
    expect(
      scoreGrounding(
        "I don't have evidence in the transcript.",
        chunks,
      ).groundedClaimsRate,
    ).toBeCloseTo(1, 5);
  });
});
