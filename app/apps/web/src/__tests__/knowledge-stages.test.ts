/**
 * Knowledge stages SSOT — sanitation, derivation (legacy/uncurated
 * entries must still flow to sensible consumers), effective resolution
 * and stage matching (global = everywhere).
 */
import { describe, it, expect } from "vitest";
import {
  KNOWLEDGE_STAGES,
  STAGE_KEYS,
  sanitizeStages,
  deriveDefaultStages,
  effectiveStages,
  entryMatchesStage,
  isKnowledgeStage,
} from "@/lib/knowledge/stages";

describe("taxonomy shape", () => {
  it("has 6 unique stages in pipeline order, global last", () => {
    expect(STAGE_KEYS).toEqual(["sourcing", "cold_call", "outreach", "objections", "meetings", "global"]);
    expect(new Set(STAGE_KEYS).size).toBe(KNOWLEDGE_STAGES.length);
  });
});

describe("sanitizeStages", () => {
  it("filters junk, dedupes, handles non-arrays", () => {
    expect(sanitizeStages(["cold_call", "nope", "cold_call", 3, "global"])).toEqual(["cold_call", "global"]);
    expect(sanitizeStages("cold_call")).toEqual([]);
    expect(sanitizeStages(undefined)).toEqual([]);
  });
});

describe("deriveDefaultStages", () => {
  it("routes cold-call titles to cold_call (and lists to sourcing too)", () => {
    expect(deriveDefaultStages("process", "Cold call — Posture fondateur")).toEqual(["cold_call"]);
    expect(deriveDefaultStages("process", "Cold call — Règles de liste et de session")).toEqual([
      "cold_call",
      "sourcing",
    ]);
    expect(deriveDefaultStages("objections", "cold-call something")).toEqual(["cold_call"]);
  });

  it("routes by category otherwise", () => {
    expect(deriveDefaultStages("icp", "Ideal Customer Profile")).toEqual(["sourcing"]);
    expect(deriveDefaultStages("objections", "Bank")).toEqual(["objections", "cold_call"]);
    expect(deriveDefaultStages("competitors", "Alternatives")).toEqual(["objections", "outreach"]);
    for (const cat of ["product", "process", "context", "custom", "whatever"]) {
      expect(deriveDefaultStages(cat, "Anything")).toEqual(["global"]);
    }
  });
});

describe("effectiveStages", () => {
  it("prefers curated stages, falls back to derived when empty or junk-only", () => {
    expect(effectiveStages(["meetings"], "icp", "x")).toEqual(["meetings"]);
    expect(effectiveStages([], "icp", "x")).toEqual(["sourcing"]);
    expect(effectiveStages(["bogus"], "icp", "x")).toEqual(["sourcing"]);
  });
});

describe("entryMatchesStage", () => {
  it("matches direct stage and includes global everywhere by default", () => {
    expect(entryMatchesStage(["cold_call"], "cold_call")).toBe(true);
    expect(entryMatchesStage(["global"], "cold_call")).toBe(true);
    expect(entryMatchesStage(["global"], "cold_call", { includeGlobal: false })).toBe(false);
    expect(entryMatchesStage(["outreach"], "cold_call")).toBe(false);
  });

  it("the global pull itself only takes global entries", () => {
    expect(entryMatchesStage(["cold_call"], "global")).toBe(false);
    expect(entryMatchesStage(["global"], "global")).toBe(true);
  });
});

describe("isKnowledgeStage", () => {
  it("accepts only taxonomy keys", () => {
    expect(isKnowledgeStage("sourcing")).toBe(true);
    expect(isKnowledgeStage("Sourcing")).toBe(false);
    expect(isKnowledgeStage(null)).toBe(false);
  });
});
