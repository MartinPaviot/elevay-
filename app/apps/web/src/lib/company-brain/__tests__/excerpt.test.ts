import { describe, it, expect } from "vitest";
import { activityExcerpt, ACTIVITY_EXCERPT_MAX } from "../excerpt";

describe("activityExcerpt", () => {
  it("returns null for empty/whitespace/null/undefined bodies", () => {
    expect(activityExcerpt(null)).toBeNull();
    expect(activityExcerpt(undefined)).toBeNull();
    expect(activityExcerpt("")).toBeNull();
    expect(activityExcerpt("   \n\t ")).toBeNull();
  });

  it("collapses runs of whitespace/newlines to single spaces", () => {
    expect(activityExcerpt("Yes,\n\n we are   good\tto go")).toBe(
      "Yes, we are good to go",
    );
  });

  it("passes a short body through, trimmed", () => {
    expect(activityExcerpt("  Send the contract.  ")).toBe("Send the contract.");
  });

  it("caps at ACTIVITY_EXCERPT_MAX and appends a single ellipsis", () => {
    const long = "x".repeat(ACTIVITY_EXCERPT_MAX + 50);
    const out = activityExcerpt(long)!;
    expect((out.match(/x/g) || []).length).toBe(ACTIVITY_EXCERPT_MAX);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBe(ACTIVITY_EXCERPT_MAX + 1);
  });

  it("does not append an ellipsis when exactly at the cap", () => {
    const exact = "y".repeat(ACTIVITY_EXCERPT_MAX);
    expect(activityExcerpt(exact)).toBe(exact);
  });
});
