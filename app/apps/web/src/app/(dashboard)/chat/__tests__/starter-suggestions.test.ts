import { describe, it, expect } from "vitest";
import { starterSuggestions, FALLBACK_SUGGESTIONS } from "@/app/(dashboard)/chat/_starter-suggestions";

describe("starterSuggestions (P1 chat)", () => {
  it("returns null while loading so the caller shows skeletons (no canned->fetched swap)", () => {
    expect(starterSuggestions(false, [])).toBeNull();
    expect(starterSuggestions(false, ["x"])).toBeNull();
  });

  it("returns the fetched suggestions once loaded", () => {
    const fetched = ["a", "b", "c"];
    expect(starterSuggestions(true, fetched)).toEqual(fetched);
  });

  it("falls back to the generic prompts when loaded but the fetch returned nothing", () => {
    expect(starterSuggestions(true, [])).toEqual([...FALLBACK_SUGGESTIONS]);
  });

  it("caps at 4 rows", () => {
    expect(starterSuggestions(true, ["1", "2", "3", "4", "5", "6"])).toHaveLength(4);
  });
});
