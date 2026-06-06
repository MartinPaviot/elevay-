/**
 * Single source of truth: flat ICP filter fields → Apollo org-search
 * "hard" params. Used by every TAM path so a filter the user set can't
 * be silently dropped on one path and honored on another:
 *   - /api/tam/estimate  (live count)
 *   - /api/tam           (onboarding build, from the request body)
 *   - /api/tam/build     (legacy planner, from tenant settings)
 *
 * Returns ONLY the dimensions that are always hard constraints (the user
 * chose them explicitly): exclude-geo, technologies, revenue, funding
 * recency/total, hiring intent. Industries / company sizes / geographies
 * are intentionally NOT here — they come from the strategy or the
 * criteria and each caller merges them with its own semantics (keywords
 * union, size-range conversion). Keywords are likewise handled by the
 * caller because they UNION with a strategy's tags rather than overwrite.
 *
 * Pure: `now` is injectable so the relative funding-recency window is
 * deterministic in tests.
 */

import type { OrgSearchParams } from "@/lib/integrations/apollo-client";
import { toTechnologyUid } from "./apollo-technology-uids";

export interface FlatApolloFilters {
  excludeGeographies?: string[] | null;
  technologies?: string[] | null;
  revenueMin?: number | null;
  revenueMax?: number | null;
  /** "raised in the last N days" — converted to latest_funding_date_range.min. */
  fundingRecencyDays?: number | null;
  totalFundingMin?: number | null;
  totalFundingMax?: number | null;
  minJobOpenings?: number | null;
  hiringTitles?: string[] | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function flatFiltersToHardApollo(
  f: FlatApolloFilters,
  now: number = Date.now(),
): Partial<OrgSearchParams> {
  const out: Partial<OrgSearchParams> = {};

  if (f.excludeGeographies?.length) {
    out.organization_not_locations = f.excludeGeographies;
  }
  if (f.technologies?.length) {
    out.currently_using_any_of_technology_uids = f.technologies.map((t) =>
      toTechnologyUid(t),
    );
  }
  if (typeof f.revenueMin === "number" || typeof f.revenueMax === "number") {
    out.revenue_range = {
      ...(typeof f.revenueMin === "number" ? { min: f.revenueMin } : {}),
      ...(typeof f.revenueMax === "number" ? { max: f.revenueMax } : {}),
    };
  }
  if (typeof f.fundingRecencyDays === "number" && f.fundingRecencyDays > 0) {
    out.latest_funding_date_range = {
      min: new Date(now - f.fundingRecencyDays * DAY_MS).toISOString(),
    };
  }
  if (
    typeof f.totalFundingMin === "number" ||
    typeof f.totalFundingMax === "number"
  ) {
    out.total_funding_range = {
      ...(typeof f.totalFundingMin === "number" ? { min: f.totalFundingMin } : {}),
      ...(typeof f.totalFundingMax === "number" ? { max: f.totalFundingMax } : {}),
    };
  }
  if (typeof f.minJobOpenings === "number" && f.minJobOpenings > 0) {
    out.organization_num_jobs_range = { min: f.minJobOpenings };
  }
  if (f.hiringTitles?.length) {
    out.q_organization_job_titles = f.hiringTitles;
  }

  return out;
}

export interface StrategyFilters {
  label: string;
  reasoning: string;
  filters: OrgSearchParams;
}

/**
 * Layer hard filters + a keyword union onto every TAM search strategy.
 * Hard filters win over whatever the strategy/LLM produced for the same
 * key; keywords UNION with each strategy's existing tags (they narrow,
 * not replace). Returns the input array unchanged when there's nothing
 * to apply, so callers can use it unconditionally.
 *
 * Used by /api/tam/build's legacy planner to apply the tenant's
 * Settings → ICP filters onto every generated strategy.
 */
export function applyHardFiltersToStrategies(
  strategies: StrategyFilters[],
  hard: Partial<OrgSearchParams>,
  keywords: string[] = [],
): StrategyFilters[] {
  const hasHard = Object.keys(hard).length > 0;
  if (!hasHard && keywords.length === 0) return strategies;
  return strategies.map((s) => ({
    ...s,
    filters: {
      ...s.filters,
      ...hard,
      ...(keywords.length > 0
        ? {
            q_organization_keyword_tags: Array.from(
              new Set([
                ...(s.filters.q_organization_keyword_tags ?? []),
                ...keywords,
              ]),
            ),
          }
        : {}),
    },
  }));
}
