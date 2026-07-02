import { describe, it, expect } from "vitest";
import {
  computeProposalCandidates,
  cohortHashOf,
  cadenceSummaryFor,
  FAMILY_TO_TEMPLATE,
  MIN_COHORT,
  PROPOSALS_MAX,
  type CompanySignalRow,
  type CohortContactStats,
} from "@/lib/home/sequence-proposals";
import { PROVEN_TEMPLATES } from "@/lib/sequences/templates/catalog";

const NOW = new Date("2026-07-02T12:00:00Z");

function co(over: Partial<CompanySignalRow> & { companyId: string }): CompanySignalRow {
  return { name: `Co ${over.companyId}`, excludedReason: null, signals: [], ...over };
}
const sig = (type: string, detectedAt = "2026-06-30T07:00:00Z") => ({ type, detectedAt });
const stats = (entries: Array<[string, number]>): Map<string, CohortContactStats> =>
  new Map(entries.map(([id, contactable]) => [id, { contactable }]));

function run(
  companies: CompanySignalRow[],
  contactStats = stats(companies.map((c) => [c.companyId, 1])),
  multipliers: Record<string, number> = {},
) {
  return computeProposalCandidates({ companies, contactStats, multipliers, now: NOW });
}

describe("computeProposalCandidates — the fresh-signal → proposal engine", () => {
  it("bridges producer keys to the canonical family (funding_recent + funding = ONE cohort)", () => {
    const out = run([
      co({ companyId: "a", signals: [sig("funding_recent")] }),
      co({ companyId: "b", signals: [sig("funding")] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].signalFamily).toBe("funding");
    expect(out[0].templateId).toBe("post-funding");
    expect(out[0].companyCount).toBe(2);
    expect(out[0].title).toBe("Recent funding — 2 accounts");
  });

  it("dedupes signal entries per company (BTG Group ×2 in prod = 1 cohort member)", () => {
    const out = run([
      co({ companyId: "a", signals: [sig("funding_recent", "2026-06-15T12:00:00Z"), sig("funding_recent", "2026-06-16T12:00:00Z")] }),
      co({ companyId: "b", signals: [sig("funding_recent")] }),
    ]);
    expect(out[0].companyCount).toBe(2);
    // freshest across the cohort, not the duplicate entry count
    expect(out[0].freshestAt.toISOString()).toBe("2026-06-30T07:00:00.000Z");
  });

  it("drops stale signals per the type TTL (hiring_surge 30d)", () => {
    const out = run([
      co({ companyId: "a", signals: [sig("hiring_surge", "2026-05-01T00:00:00Z")] }), // 62d — stale
      co({ companyId: "b", signals: [sig("hiring_surge", "2026-06-17T00:00:00Z")] }), // fresh
      co({ companyId: "c", signals: [sig("hiring_surge", "2026-06-20T00:00:00Z")] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].signalFamily).toBe("hiring");
    expect(out[0].companyCount).toBe(2); // a excluded by staleness
  });

  it("skips families with no proven template (acquisition, warm_connection)", () => {
    const out = run([
      co({ companyId: "a", signals: [sig("acquisition")] }),
      co({ companyId: "b", signals: [sig("acquisition")] }),
      co({ companyId: "c", signals: [sig("warm_connection")] }),
      co({ companyId: "d", signals: [sig("warm_connection")] }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("drops excluded companies and enforces MIN_COHORT", () => {
    const out = run([
      co({ companyId: "a", signals: [sig("funding_recent")], excludedReason: "anti_icp" }),
      co({ companyId: "b", signals: [sig("funding_recent")] }),
    ]);
    expect(out).toHaveLength(0); // 1 survivor < MIN_COHORT(2)
    expect(MIN_COHORT).toBe(2);
  });

  it("requires ≥1 contactable contact across the cohort", () => {
    const companies = [
      co({ companyId: "a", signals: [sig("funding_recent")] }),
      co({ companyId: "b", signals: [sig("funding_recent")] }),
    ];
    expect(run(companies, stats([["a", 0], ["b", 0]]))).toHaveLength(0);
    const ok = run(companies, stats([["a", 0], ["b", 3]]));
    expect(ok).toHaveLength(1);
    expect(ok[0].contactableCount).toBe(3);
  });

  it("ranks by multiplier × cohort size and caps at PROPOSALS_MAX", () => {
    const companies = [
      // funding: 2 companies × prior 1.5 = 3.0
      co({ companyId: "f1", signals: [sig("funding_recent")] }),
      co({ companyId: "f2", signals: [sig("funding_recent")] }),
      // hiring: 3 companies × prior 1.4 = 4.2 → first
      co({ companyId: "h1", signals: [sig("hiring_surge")] }),
      co({ companyId: "h2", signals: [sig("hiring_surge")] }),
      co({ companyId: "h3", signals: [sig("hiring_surge")] }),
      // leadership: 2 × 1.3 = 2.6
      co({ companyId: "l1", signals: [sig("executive_hire")] }),
      co({ companyId: "l2", signals: [sig("executive_hire")] }),
      // website_visit: stale (7d TTL, detected Jun 20) — absent
      co({ companyId: "w1", signals: [sig("website_visit", "2026-06-20T00:00:00Z")] }),
      co({ companyId: "w2", signals: [sig("website_visit", "2026-06-20T00:00:00Z")] }),
      // tech: 2 × 1.3 = 2.6 — 4th, cut by the cap
      co({ companyId: "t1", signals: [sig("tech_stack_change")] }),
      co({ companyId: "t2", signals: [sig("tech_stack_change")] }),
    ];
    const out = run(companies);
    expect(out.length).toBe(PROPOSALS_MAX);
    expect(out[0].signalFamily).toBe("hiring");
    expect(out[1].signalFamily).toBe("funding");
    // tie 2.6 vs 2.6 → alphabetical: leadership_change before tech_stack_change
    expect(out[2].signalFamily).toBe("leadership_change");
  });

  it("a learned multiplier overrides the prior in ranking", () => {
    const companies = [
      co({ companyId: "f1", signals: [sig("funding_recent")] }),
      co({ companyId: "f2", signals: [sig("funding_recent")] }),
      co({ companyId: "h1", signals: [sig("hiring_surge")] }),
      co({ companyId: "h2", signals: [sig("hiring_surge")] }),
    ];
    // tenant learned hiring converts 2.5× — hiring outranks funding despite priors
    const out = run(companies, undefined, { hiring: 2.5, funding: 1.5 });
    expect(out[0].signalFamily).toBe("hiring");
  });

  it("handles malformed signal entries without throwing", () => {
    const out = run([
      co({ companyId: "a", signals: [{ type: 42 }, { detectedAt: "2026-06-30" }, sig("funding_recent")] }),
      co({ companyId: "b", signals: [sig("funding_recent", "not-a-date")] }), // undated → kept fresh
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].companyCount).toBe(2);
  });
});

describe("cohortHashOf — content-based dedupe key", () => {
  it("is order-insensitive and content-sensitive", () => {
    expect(cohortHashOf(["a", "b"])).toBe(cohortHashOf(["b", "a"]));
    expect(cohortHashOf(["a", "b"])).not.toBe(cohortHashOf(["a", "b", "c"]));
  });
});

describe("FAMILY_TO_TEMPLATE — every mapped template exists in the catalog", () => {
  it("maps only to real catalog ids", () => {
    const ids = new Set(PROVEN_TEMPLATES.map((t) => t.id));
    for (const [family, templateId] of Object.entries(FAMILY_TO_TEMPLATE)) {
      expect(ids.has(templateId), `${family} → ${templateId}`).toBe(true);
    }
  });
  it("cadenceSummaryFor renders the real cadence", () => {
    expect(cadenceSummaryFor("post-funding")).toBe("3 steps · email → LinkedIn → email");
    expect(cadenceSummaryFor("nope")).toBe("");
  });
});
