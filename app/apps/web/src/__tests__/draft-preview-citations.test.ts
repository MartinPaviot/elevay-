import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toCitations, verdictColor } from "@/components/sequence-draft-preview";

/**
 * T11c — the citation + gate-verdict rendering logic. `toCitations`
 * normalizes the loosely-typed personalization_sources into chips (was a raw
 * JSON.stringify dump); `verdictColor` maps a gate verdict to a token. Plus a
 * drift guard that the raw dump is gone and the structured render is in.
 */

describe("toCitations", () => {
  it("keeps the AI-UI primitive fields and drops empties", () => {
    expect(
      toCitations([
        { kind: "linkedin_post", label: "Shipped X", href: "https://x.co/p", quote: "we shipped X" },
        { label: "Series A" },
        {}, // no usable field -> dropped
        null, // dropped
        "string", // dropped
      ]),
    ).toEqual([
      { kind: "linkedin_post", label: "Shipped X", href: "https://x.co/p", quote: "we shipped X" },
      { kind: undefined, label: "Series A", href: undefined, quote: undefined },
    ]);
  });

  it("non-array input -> []", () => {
    expect(toCitations(null)).toEqual([]);
    expect(toCitations({ label: "x" })).toEqual([]);
    expect(toCitations(undefined)).toEqual([]);
  });

  it("a quote-only source survives (it can still be cited)", () => {
    expect(toCitations([{ quote: "they mentioned scaling" }])).toEqual([
      { kind: undefined, label: undefined, href: undefined, quote: "they mentioned scaling" },
    ]);
  });

  it("ignores non-string field values (never crashes on a number/object)", () => {
    expect(toCitations([{ label: 42, href: {}, kind: "x" }])).toEqual([
      { kind: "x", label: undefined, href: undefined, quote: undefined },
    ]);
  });
});

describe("verdictColor", () => {
  it("maps the gate verdicts to their tokens", () => {
    expect(verdictColor("pass")).toBe("var(--color-success)");
    expect(verdictColor("blocked")).toBe("var(--color-error)");
    expect(verdictColor("reworked")).toBe("var(--color-warning)");
    expect(verdictColor("anything-else")).toBe("var(--color-text-tertiary)");
  });
});

describe("T11c render drift guard", () => {
  const src = readFileSync(
    join(__dirname, "..", "components", "sequence-draft-preview.tsx"),
    "utf8",
  );

  it("the raw JSON dump of the sources is gone", () => {
    expect(src).not.toContain("JSON.stringify(context.signalsAtTriggerTime");
  });

  it("renders citation chips and a quality-gates section", () => {
    expect(src).toContain("Sources cited");
    expect(src).toContain("Quality gates");
    expect(src).toContain("toCitations(context?.signalsAtTriggerTime)");
    // Gate verdict pills use the token mapping.
    expect(src).toContain("verdictColor(g.verdict)");
    // A cited source with an href is a link.
    expect(src).toMatch(/target="_blank"[\s\S]{0,80}rel="noopener/);
  });
});
