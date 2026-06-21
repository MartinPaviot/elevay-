/**
 * C1 gate — inbox Splits selectivity (locks B3 R1 / R7).
 *
 * Deterministic, no LLM: runs the pure resolveSplit over the hand-labeled golden
 * and asserts needs_reply precision/recall >= 0.90 with zero false-negatives (a
 * missed needs_reply is the cardinal sin — the founder loses a reply thread to a
 * lesser lane). Plus the PARITY invariant locking needs_reply ⊆ replyWorthy so
 * the B3 split and the B1 draft-offer can never diverge. Wired into `pnpm eval:run`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveSplit, BUILT_IN_SPLITS, type SplitInput, type BuiltInSplit } from "@/lib/inbox/splits";
import { splitPR, type LabelEvalCase } from "@/lib/evals/inbox-metrics";

interface GoldenLine {
  id: string;
  scenario: string;
  input: SplitInput;
  expected: BuiltInSplit;
}

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "..", "lib", "evals", "fixtures", "inbox", "inbox-splits.golden.jsonl");
const VALID = new Set<string>(BUILT_IN_SPLITS.map((b) => b.id));

function loadGolden(): GoldenLine[] {
  return readFileSync(FIXTURE, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as GoldenLine);
}

describe("inbox splits golden — fixture integrity", () => {
  const golden = loadGolden();
  it("has >= 30 cases with >= 8 needs_reply and >= 8 non-needs_reply", () => {
    expect(golden.length).toBeGreaterThanOrEqual(30);
    const pos = golden.filter((g) => g.expected === "needs_reply").length;
    expect(pos).toBeGreaterThanOrEqual(8);
    expect(golden.length - pos).toBeGreaterThanOrEqual(8);
  });
  it("unique ids, valid expected split, well-formed input", () => {
    const ids = golden.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of golden) {
      expect(VALID.has(g.expected), `${g.id}: ${g.expected}`).toBe(true);
      expect(typeof g.input.replyWorthy, g.id).toBe("boolean");
      expect(["attention", "snoozed", "done", "handled"], g.id).toContain(g.input.lane);
    }
  });
});

describe("inbox splits golden — needs_reply gate + parity", () => {
  const golden = loadGolden();
  const scored: Array<LabelEvalCase & { id: string; input: SplitInput }> = golden.map((g) => ({
    id: g.id,
    input: g.input,
    predicted: resolveSplit(g.input).split,
    expected: g.expected,
  }));
  const pr = splitPR(scored, "needs_reply");

  it("report card", () => {
    const misses = scored.filter((s) => s.predicted !== s.expected).map((s) => s.id);
    // eslint-disable-next-line no-console
    console.log(
      `[inbox-splits] support=${pr.support} needs_reply precision=${pr.precision.toFixed(3)} ` +
        `recall=${pr.recall.toFixed(3)} tp=${pr.tp} fp=${pr.fp} fn=${pr.fn}` +
        (misses.length ? ` misses=${misses.join(",")}` : " misses=none"),
    );
    expect(pr.support).toBeGreaterThanOrEqual(30);
  });

  it("needs_reply precision >= 0.90", () => {
    expect(pr.precision).toBeGreaterThanOrEqual(0.9);
  });
  it("needs_reply recall >= 0.90 with zero false-negatives (cardinal sin)", () => {
    expect(pr.recall).toBeGreaterThanOrEqual(0.9);
    expect(pr.fn, "missed needs_reply").toBe(0);
  });
  it("every built-in label resolves correctly across the fixture", () => {
    for (const s of scored) {
      expect(s.predicted, `${s.id} expected ${s.expected}`).toBe(s.expected);
    }
  });

  it("PARITY: every needs_reply case is replyWorthy (B3 ⊆ B1)", () => {
    for (const g of golden) {
      if (g.expected === "needs_reply") {
        expect(g.input.replyWorthy, `${g.id} labeled needs_reply but not replyWorthy`).toBe(true);
      }
    }
    // and the resolver itself never emits needs_reply without replyWorthy
    for (const s of scored) {
      if (s.predicted === "needs_reply") expect(s.input.replyWorthy, s.id).toBe(true);
    }
  });
});
