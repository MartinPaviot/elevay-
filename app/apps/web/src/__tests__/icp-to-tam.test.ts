import { describe, expect, it } from "vitest";
import { icpToStrategy, icpToSignalIcp } from "@/lib/icp/icp-to-tam";
import type { Criterion } from "@/lib/icp/criteria-engine";

function crit(p: Partial<Criterion> & Pick<Criterion, "fieldKey" | "operator">): Criterion {
  return { id: p.id ?? `${p.fieldKey}`, value: p.value ?? null, weight: p.weight ?? 1, isRequired: p.isRequired ?? false, ...p };
}

describe("icpToStrategy", () => {
  it("builds a strategy from apollo_search criteria", () => {
    const s = icpToStrategy("SaaS / Tech", [
      crit({ fieldKey: "industry", operator: "in", value: ["Computer Software"] }),
      crit({ fieldKey: "employee_count", operator: "between", value: { min: 51, max: 200 } }),
      crit({ fieldKey: "geography", operator: "in", value: ["France"] }),
    ]);
    expect(s).not.toBeNull();
    expect(s?.label).toBe("ICP: SaaS / Tech");
    expect(s?.filters.q_organization_keyword_tags).toEqual(["Computer Software"]);
    expect(s?.filters.organization_num_employees_ranges).toEqual(["51,200"]);
    expect(s?.filters.organization_locations).toEqual(["France"]);
  });

  it("translates the full Apollo filter surface, incl. geography_exclude → organization_not_locations", () => {
    const s = icpToStrategy("Full surface", [
      crit({ fieldKey: "keywords", operator: "in", value: ["developer tools"] }),
      crit({ fieldKey: "technologies", operator: "in", value: ["Kubernetes"] }),
      crit({ fieldKey: "geography_exclude", operator: "in", value: ["India", "China"] }),
      crit({ fieldKey: "revenue", operator: "between", value: { min: 1_000_000, max: 50_000_000 } }),
      crit({ fieldKey: "total_funding", operator: "between", value: { min: 5_000_000 } }),
      crit({ fieldKey: "num_open_jobs", operator: "gte", value: 1 }),
      crit({ fieldKey: "hiring_job_titles", operator: "in", value: ["Account Executive"] }),
    ]);
    expect(s).not.toBeNull();
    const f = s!.filters;
    expect(f.q_organization_keyword_tags).toEqual(["developer tools"]);
    expect(f.currently_using_any_of_technology_uids).toEqual(["kubernetes"]);
    // The fix: geography_exclude now reaches Apollo (was silently dropped).
    expect(f.organization_not_locations).toEqual(["India", "China"]);
    expect(f.revenue_range).toEqual({ min: 1_000_000, max: 50_000_000 });
    expect(f.total_funding_range).toEqual({ min: 5_000_000 });
    expect(f.organization_num_jobs_range).toEqual({ min: 1 });
    expect(f.q_organization_job_titles).toEqual(["Account Executive"]);
  });

  it("returns null when the ICP has no apollo_search criteria (avoid unfiltered search)", () => {
    const s = icpToStrategy("Custom-only", [
      crit({ fieldKey: "founded_year", operator: "gte", value: 2018 }), // apollo_enrich
      crit({ fieldKey: "properties.nb_avocats", operator: "gte", value: 5 }), // custom
    ]);
    expect(s).toBeNull();
  });

  it("returns null for an empty criteria list", () => {
    expect(icpToStrategy("Empty", [])).toBeNull();
  });
});

describe("icpToSignalIcp", () => {
  it("extracts industries / sizeRange / geographies from criteria", () => {
    const ctx = icpToSignalIcp([
      crit({ fieldKey: "industry", operator: "in", value: ["SaaS", "Fintech"] }),
      crit({ fieldKey: "employee_count", operator: "between", value: { min: 50, max: 500 } }),
      crit({ fieldKey: "geography", operator: "in", value: ["France", "Switzerland"] }),
    ]);
    expect(ctx.industries).toEqual(["SaaS", "Fintech"]);
    expect(ctx.sizeRange).toEqual([50, 500]);
    expect(ctx.geographies).toEqual(["France", "Switzerland"]);
  });

  it("open-ended employee_count between → [min, BIG]", () => {
    const ctx = icpToSignalIcp([
      crit({ fieldKey: "employee_count", operator: "between", value: { min: 1000 } }),
    ]);
    expect(ctx.sizeRange?.[0]).toBe(1000);
    expect(ctx.sizeRange?.[1]).toBeGreaterThan(100000);
  });

  it("gte employee_count → [n, BIG]", () => {
    const ctx = icpToSignalIcp([
      crit({ fieldKey: "employee_count", operator: "gte", value: 200 }),
    ]);
    expect(ctx.sizeRange?.[0]).toBe(200);
  });

  it("lte employee_count → [0, n]", () => {
    const ctx = icpToSignalIcp([
      crit({ fieldKey: "employee_count", operator: "lte", value: 50 }),
    ]);
    expect(ctx.sizeRange).toEqual([0, 50]);
  });

  it("omits fields the ICP doesn't constrain", () => {
    const ctx = icpToSignalIcp([
      crit({ fieldKey: "industry", operator: "in", value: ["SaaS"] }),
    ]);
    expect(ctx.industries).toEqual(["SaaS"]);
    expect(ctx.sizeRange).toBeUndefined();
    expect(ctx.geographies).toBeUndefined();
  });

  it("returns an empty object for criteria with no firmographic fields", () => {
    expect(icpToSignalIcp([crit({ fieldKey: "founded_year", operator: "gte", value: 2018 })])).toEqual({});
  });
});
