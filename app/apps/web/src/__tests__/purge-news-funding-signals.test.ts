import { describe, it, expect } from "vitest";
import { isPurgeableFundingSignal } from "../../scripts/purge-news-funding-signals";

describe("isPurgeableFundingSignal — removes news garbage, keeps honest signals", () => {
  it("drops ALL funding_recent (news + apollo first-sight)", () => {
    expect(isPurgeableFundingSignal({ type: "funding_recent", detail: "Arcadia Biosciences Raises $4M", confidence: "high" })).toBe(true);
    expect(isPurgeableFundingSignal({ type: "funding_recent", source: "apollo", strength: "medium" })).toBe(true);
  });
  it("drops ALL acquisition (only the news detector wrote it)", () => {
    expect(isPurgeableFundingSignal({ type: "acquisition", detail: "BTG Pactual Acquires..." })).toBe(true);
  });
  it("drops news-sourced funding but KEEPS apollo steady-state funding", () => {
    expect(isPurgeableFundingSignal({ type: "funding", detail: "government funding" })).toBe(true);
    expect(isPurgeableFundingSignal({ type: "funding", source: "apollo", strength: "low" })).toBe(false);
  });
  it("keeps every non-funding signal untouched", () => {
    expect(isPurgeableFundingSignal({ type: "hiring_surge", detail: "5 roles" })).toBe(false);
    expect(isPurgeableFundingSignal({ type: "warm_connection" })).toBe(false);
    expect(isPurgeableFundingSignal({ type: "executive_hire" })).toBe(false);
    expect(isPurgeableFundingSignal({})).toBe(false);
  });
});
