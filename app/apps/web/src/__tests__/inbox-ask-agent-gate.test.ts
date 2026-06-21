/**
 * C1 gate — inbox ask-agent DETERMINISTIC floor (locks B5 R2/R3 / R8).
 *
 * No LLM: proves the retrieval finds the gold thread (retrieval_recall >= 0.90),
 * the verifier rejects fabricated/out-of-range citations + collapses to
 * answered=false when nothing grounds the answer (the abstention spine), and that
 * a correct agent's output abstains on every negative case (abstention == 1.0).
 * The prose-quality grounded_answer_rate bar is the LLM tier (needs a key) — noted
 * here, asserted when ANTHROPIC_API_KEY is set in the agent run. Wired into eval:run.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { selectRelevantThreads, type InboxThread } from "@/lib/inbox/ask-inbox";
import { verifyAnswer, buildEvidence } from "@/lib/inbox/ask-agent-verify";
import { retrievalRecall, abstentionCorrectness, citationInRange } from "@/lib/evals/inbox-metrics";

interface GoldenLine {
  id: string;
  scenario: string;
  corpus: Array<{ key: string; subject: string; messages: Array<{ body: string }> }>;
  question: string;
  expected: { answered: boolean; relevantKeys: string[]; requiredFacts: string[] };
}

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "..", "lib", "evals", "fixtures", "inbox", "inbox-ask.golden.jsonl");

function loadGolden(): GoldenLine[] {
  return readFileSync(FIXTURE, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as GoldenLine);
}

function evidenceFor(g: GoldenLine) {
  return buildEvidence(g.corpus.map((t) => ({ key: t.key, subject: t.subject, messageCount: t.messages.length })));
}
function corpusRange(g: GoldenLine) {
  return {
    keys: new Set(g.corpus.map((t) => t.key)),
    msgCount: new Map(g.corpus.map((t) => [t.key, t.messages.length])),
  };
}

describe("inbox ask-agent golden — fixture integrity", () => {
  const golden = loadGolden();
  it("has >= 15 cases with >= 4 negatives", () => {
    expect(golden.length).toBeGreaterThanOrEqual(15);
    expect(golden.filter((g) => !g.expected.answered).length).toBeGreaterThanOrEqual(4);
  });
  it("unique ids; positives name a relevant key, negatives name none", () => {
    expect(new Set(golden.map((g) => g.id)).size).toBe(golden.length);
    for (const g of golden) {
      if (g.expected.answered) expect(g.expected.relevantKeys.length, g.id).toBeGreaterThan(0);
      else expect(g.expected.relevantKeys, g.id).toEqual([]);
    }
  });
});

describe("inbox ask-agent floor — retrieval", () => {
  const golden = loadGolden();
  const cases = golden.map((g) => ({
    relevantKeys: g.expected.relevantKeys,
    retrievedKeys: selectRelevantThreads(g.corpus as unknown as InboxThread[], g.question, 6).map((t) => t.key),
  }));
  const r = retrievalRecall(cases);

  it("report card", () => {
    // eslint-disable-next-line no-console
    console.log(`[inbox-ask] cases=${golden.length} retrieval_recall=${r.recall.toFixed(3)} (${r.hits}/${r.evaluated} positives)`);
    expect(golden.length).toBeGreaterThanOrEqual(15);
  });
  it("retrieval_recall >= 0.90", () => {
    expect(r.recall).toBeGreaterThanOrEqual(0.9);
  });
});

describe("inbox ask-agent floor — verifier spine + abstention", () => {
  const golden = loadGolden();

  it("a fabricated-key citation never passes (any case)", () => {
    for (const g of golden) {
      const v = verifyAnswer({ answered: true, answer: "fabricated", citations: [{ key: "__ghost__" }] }, evidenceFor(g));
      expect(v.answered, g.id).toBe(false);
    }
  });

  it("a grounded positive answer passes with in-range citations", () => {
    for (const g of golden.filter((x) => x.expected.answered)) {
      const v = verifyAnswer(
        { answered: true, answer: g.expected.requiredFacts.join(" ") || "answer", citations: g.expected.relevantKeys.map((k) => ({ key: k })) },
        evidenceFor(g),
      );
      expect(v.answered, g.id).toBe(true);
      expect(citationInRange(v.citations, corpusRange(g)), g.id).toBe(true);
    }
  });

  it("abstention_correctness == 1.0 (a correct agent abstains on every negative)", () => {
    const predictions = golden.map((g) => {
      const correctRaw = g.expected.answered
        ? { answered: true, answer: g.expected.requiredFacts.join(" ") || "answer", citations: g.expected.relevantKeys.map((k) => ({ key: k })) }
        : { answered: false, answer: "", citations: [] };
      return { expectedAnswered: g.expected.answered, predictedAnswered: verifyAnswer(correctRaw, evidenceFor(g)).answered };
    });
    const a = abstentionCorrectness(predictions);
    expect(a.correctness, `misses=${a.misses}`).toBe(1);
  });
});
