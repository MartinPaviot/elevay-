import { describe, it, expect } from "vitest";
import {
  flatFiltersToHardApollo,
  applyHardFiltersToStrategies,
} from "@/lib/icp/flat-filters-to-apollo";
import type { OrgSearchParams } from "@/lib/integrations/apollo-client";

describe("flatFiltersToHardApollo", () => {
  it("returns an empty object when nothing is set", () => {
    expect(flatFiltersToHardApollo({})).toEqual({});
  });

  it("maps every hard filter to its OrgSearchParams key", () => {
    const now = Date.UTC(2026, 5, 1); // fixed clock
    const out = flatFiltersToHardApollo(
      {
        excludeGeographies: ["India", "China"],
        technologies: ["Kubernetes", "AWS"],
        revenueMin: 1_000_000,
        revenueMax: 50_000_000,
        fundingRecencyDays: 180,
        totalFundingMin: 5_000_000,
        minJobOpenings: 3,
        hiringTitles: ["Account Executive"],
      },
      now,
    );
    expect(out.organization_not_locations).toEqual(["India", "China"]);
    // toTechnologyUid: known map (aws → amazon_aws) + slug fallback (kubernetes).
    expect(out.currently_using_any_of_technology_uids).toEqual([
      "kubernetes",
      "amazon_aws",
    ]);
    expect(out.revenue_range).toEqual({ min: 1_000_000, max: 50_000_000 });
    expect(out.total_funding_range).toEqual({ min: 5_000_000 }); // one-sided
    expect(out.organization_num_jobs_range).toEqual({ min: 3 });
    expect(out.q_organization_job_titles).toEqual(["Account Executive"]);
    expect(out.latest_funding_date_range?.min).toBe(
      new Date(now - 180 * 86_400_000).toISOString(),
    );
  });

  it("omits range params when no bound is provided, and ignores non-positive funding/jobs", () => {
    const out = flatFiltersToHardApollo({
      fundingRecencyDays: 0,
      minJobOpenings: 0,
    });
    expect(out.revenue_range).toBeUndefined();
    expect(out.total_funding_range).toBeUndefined();
    expect(out.latest_funding_date_range).toBeUndefined();
    expect(out.organization_num_jobs_range).toBeUndefined();
  });

  it("accepts a one-sided revenue bound", () => {
    expect(flatFiltersToHardApollo({ revenueMin: 2_000_000 }).revenue_range).toEqual({
      min: 2_000_000,
    });
    expect(flatFiltersToHardApollo({ revenueMax: 9_000_000 }).revenue_range).toEqual({
      max: 9_000_000,
    });
  });
});

describe("applyHardFiltersToStrategies", () => {
  const strat = (filters: OrgSearchParams) => ({
    label: "s",
    reasoning: "r",
    filters,
  });

  it("returns the same array when there's nothing to apply", () => {
    const strategies = [strat({ organization_locations: ["France"] })];
    expect(applyHardFiltersToStrategies(strategies, {}, [])).toBe(strategies);
  });

  it("layers hard filters onto every strategy (hard wins)", () => {
    const strategies = [
      strat({ q_organization_keyword_tags: ["saas"], revenue_range: { min: 1 } }),
      strat({ organization_locations: ["France"] }),
    ];
    const out = applyHardFiltersToStrategies(
      strategies,
      { organization_not_locations: ["India"], revenue_range: { min: 5_000_000 } },
      [],
    );
    // hard revenue_range overrides the strategy's own.
    expect(out[0].filters.revenue_range).toEqual({ min: 5_000_000 });
    expect(out[0].filters.organization_not_locations).toEqual(["India"]);
    expect(out[1].filters.organization_not_locations).toEqual(["India"]);
    // original objects are not mutated.
    expect(strategies[0].filters.revenue_range).toEqual({ min: 1 });
  });

  it("unions keywords with each strategy's existing tags (dedup)", () => {
    const out = applyHardFiltersToStrategies(
      [strat({ q_organization_keyword_tags: ["saas", "b2b"] })],
      {},
      ["b2b", "fintech"],
    );
    expect(out[0].filters.q_organization_keyword_tags).toEqual([
      "saas",
      "b2b",
      "fintech",
    ]);
  });
});
