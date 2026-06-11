/**
 * industry-style is the single source of truth for industry rendering
 * (icon + sector hue). These tests pin its contract:
 *  - the ENTIRE vocabulary the app can produce resolves to a curated style:
 *    Apollo crosswalk strings (what enrichment writes to companies.industry)
 *    and the ICP picker taxonomy (what users select), in either spelling;
 *  - unknown free-text labels (CSV imports) degrade to a stable fallback,
 *    never a crash, never a guess;
 *  - every icon reference is a real lucide-react export (a wrong name would
 *    otherwise only explode at build/render time).
 */
import { describe, it, expect } from "vitest";
import { industryStyle, industryIcon, INDUSTRY_VOCABULARY } from "@/lib/ui/industry-style";
import { A } from "@/lib/icp/naics-to-apollo-industry";
import { INDUSTRIES } from "@/lib/config/icp-constants";

// Highest-volume live values from the companies table (2026-06-11 tally) —
// the rows users actually see first.
const TOP_LIVE_VALUES = [
  "information technology & services",
  "venture capital & private equity",
  "nonprofit organization management",
  "staffing & recruiting",
  "higher education",
  "management consulting",
  "financial services",
  "hospital & health care",
  "professional training & coaching",
  "civic & social organization",
  "research",
  "individual & family services",
  "real estate",
  "government administration",
  "consumer goods",
  "other",
  "banking",
  "machinery",
  "construction",
  "medical devices",
  "investment management",
  "marketing & advertising",
  "primary/secondary education",
  "hospitality",
  "architecture & planning",
  "fund-raising",
  "think tanks",
  "luxury goods & jewelry",
  "market research",
  "nanotechnology",
  "public policy",
  "government relations",
  "investment banking",
  "defense & space",
  "military",
  "photography",
];

describe("curated coverage", () => {
  it("covers every Apollo crosswalk industry string", () => {
    const missing = Object.values(A).filter((v) => !industryStyle(v).explicit);
    expect(missing).toEqual([]);
  });

  it("covers every ICP picker industry (LinkedIn 'and' spelling included)", () => {
    const missing = INDUSTRIES.filter((v) => !industryStyle(v).explicit);
    expect(missing).toEqual([]);
  });

  it("covers every high-volume live industry value", () => {
    const missing = TOP_LIVE_VALUES.filter((v) => !industryStyle(v).explicit);
    expect(missing).toEqual([]);
  });

  it("every curated entry has a real icon component and theme tokens", () => {
    for (const v of INDUSTRY_VOCABULARY) {
      const s = industryStyle(v);
      expect(s.icon, `icon for "${v}"`).toBeTruthy();
      expect(s.color).toMatch(/^var\(--ind-/);
      expect(s.bg).toMatch(/^var\(--ind-.*-bg\)$/);
    }
  });

  it("spreads the vocabulary across the full family palette", () => {
    const families = new Set(Object.values(A).map((v) => industryStyle(v).family));
    expect(families.size).toBeGreaterThanOrEqual(12);
  });
});

describe("normalization", () => {
  it("is case- and whitespace-insensitive", () => {
    const lower = industryStyle("information technology & services");
    const title = industryStyle("  Information   Technology & Services ");
    expect(title.explicit).toBe(true);
    expect(title.family).toBe(lower.family);
    expect(title.icon).toBe(lower.icon);
  });

  it("treats 'and' and '&' spellings as the same taxonomy entry", () => {
    const amp = industryStyle("staffing & recruiting");
    const and = industryStyle("Staffing and Recruiting");
    expect(and.explicit).toBe(true);
    expect(and.family).toBe(amp.family);
    expect(and.icon).toBe(amp.icon);
  });
});

describe("fallback", () => {
  it("gives unknown labels a stable, styled, non-curated identity", () => {
    const a = industryStyle("fintech rocketry");
    const b = industryStyle("fintech rocketry");
    expect(a.explicit).toBe(false);
    expect(a.family).toBe(b.family);
    expect(a.icon).toBe(b.icon);
    expect(a.icon).toBeTruthy();
    expect(a.color).toMatch(/^var\(--ind-/);
  });

  it("never throws on null, undefined or empty input", () => {
    for (const v of [null, undefined, "", "   "]) {
      const s = industryStyle(v);
      expect(s.icon).toBeTruthy();
      expect(s.explicit).toBe(false);
    }
  });

  it("industryIcon returns a renderable component for any input", () => {
    expect(industryIcon("banking")).toBeTruthy();
    expect(industryIcon("no such industry")).toBeTruthy();
    expect(industryIcon(null)).toBeTruthy();
  });
});
