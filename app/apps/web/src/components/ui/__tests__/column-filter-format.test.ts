import { describe, it, expect } from "vitest";
import { formatColumnFilterValue } from "../column-filter";

describe("formatColumnFilterValue — summary chip value", () => {
  it("returns '' for undefined / inactive state", () => {
    expect(formatColumnFilterValue(undefined)).toBe("");
    expect(formatColumnFilterValue({})).toBe("");
    expect(formatColumnFilterValue({ text: "   " })).toBe("");
    expect(formatColumnFilterValue({ values: [] })).toBe("");
  });

  it("returns the trimmed text for a text filter", () => {
    expect(formatColumnFilterValue({ text: "  acme " })).toBe("acme");
  });

  it("maps presence to a human token", () => {
    expect(formatColumnFilterValue({ presence: "has" })).toBe("present");
    expect(formatColumnFilterValue({ presence: "empty" })).toBe("empty");
  });

  it("shows the lone value for a single-value enum", () => {
    expect(formatColumnFilterValue({ values: ["SaaS"] })).toBe("SaaS");
  });

  it("collapses a multi-value enum to 'first +N'", () => {
    expect(formatColumnFilterValue({ values: ["SaaS", "Fintech", "Health"] })).toBe("SaaS +2");
  });
});
