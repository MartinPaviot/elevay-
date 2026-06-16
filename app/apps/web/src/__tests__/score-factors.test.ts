import { describe, it, expect } from "vitest";
import { assembleScoreExplanation, criterionFactor } from "@/lib/scoring/score-factors";

describe("criterionFactor", () => {
  it("maps firmographic fields to fit and signal-ish fields to signal", () => {
    expect(criterionFactor("industry")).toEqual({ label: "secteur cœur", kind: "fit" });
    expect(criterionFactor("num_open_jobs")).toEqual({ label: "recrute activement", kind: "signal" });
    expect(criterionFactor("person_seniorities")?.kind).toBe("fit");
  });
  it("returns null for unknown / non-labellable fields", () => {
    expect(criterionFactor("hiring_job_titles")).toBeNull();
    expect(criterionFactor("whatever")).toBeNull();
  });
});

describe("assembleScoreExplanation", () => {
  it("builds an evidence-cited rationale, fresh signal first", () => {
    const out = assembleScoreExplanation({
      grade: "A+",
      matchedFieldKeys: ["industry", "employee_count"],
      freshSignals: [{ label: "recrute un RevOps", ageDays: 12 }],
      reachability: ["décideur joignable"],
      coverage: 1,
    });
    expect(out.grade).toBe("A+");
    expect(out.rationale.startsWith("A+ : recrute un RevOps (il y a")).toBe(true);
    expect(out.rationale).toContain("secteur cœur");
    expect(out.rationale).toContain("décideur joignable");
    expect(out.confidence).toBeGreaterThan(0.9);
  });

  it("dedups a fresh signal against the equivalent matched criterion label", () => {
    const out = assembleScoreExplanation({
      grade: "A",
      matchedFieldKeys: ["industry"],
      freshSignals: [{ label: "secteur cœur" }], // same label as the matched factor
      coverage: 0.8,
    });
    const labels = out.factors.map((f) => f.label);
    expect(labels.filter((l) => l === "secteur cœur")).toHaveLength(1);
  });

  it("skips unlabellable matched fields and survives an empty input", () => {
    const out = assembleScoreExplanation({ grade: "B", matchedFieldKeys: ["hiring_job_titles"], coverage: 0.5 });
    expect(out.factors).toHaveLength(0);
    expect(out.rationale).toBe("B : fit ICP, pas de signal récent");
  });

  it("propagates low confidence from thin coverage", () => {
    const out = assembleScoreExplanation({ grade: "A", matchedFieldKeys: ["industry"], coverage: 0.3 });
    expect(out.confidence).toBeCloseTo(0.3, 5);
  });
});
