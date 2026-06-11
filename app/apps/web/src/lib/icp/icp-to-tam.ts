/**
 * Bridge an ICP's criteria into the TAM build inputs (P3,
 * _specs/multi-icp). Pure. Two outputs the /api/tam/build route needs
 * when sourcing for a specific ICP instead of the LLM planner:
 *
 *   1. icpToStrategy — one deterministic search strategy = the ICP's
 *      apollo_search criteria translated to OrgSearchParams. No LLM:
 *      the founder authored the criteria, we source exactly them.
 *   2. icpToSignalIcp — the { industries, sizeRange, geographies }
 *      shape the per-company signal scorer reads, extracted from the
 *      same criteria so signal scoring stays consistent with sourcing.
 */

import { criteriaToApolloParams } from "./to-apollo-params";
import { flatFiltersToHardApollo } from "./flat-filters-to-apollo";
import { parseUiState, parseSourcingFilters } from "./ui-state";
import { sizesToApolloRanges } from "@/lib/config/icp-constants";
import type { Criterion } from "./criteria-engine";
import type { OrgSearchParams } from "@/lib/integrations/apollo-client";

export type TamStrategy = {
  label: string;
  reasoning: string;
  filters: OrgSearchParams;
};

/**
 * Build the single deterministic strategy for an ICP. Returns null
 * when the ICP has NO apollo_search criteria (nothing to source on —
 * the caller should surface "this ICP has no sourceable criteria"
 * rather than firing an unfiltered Apollo search that returns the
 * whole database).
 *
 * Phase 1 (_specs/icp-unification R6.2/R6.3): when the profile carries
 * editor metadata, sourcing gets higher fidelity than the criteria —
 *   - exact size labels from uiState replace the between-ENVELOPE the
 *     scoring criteria use (selecting "11-50" + "501-1,000" sources
 *     those two bands, not everything from 11 to 1,000);
 *   - sourcingFilters (exclude geographies, funding recency) apply as
 *     hard Apollo params, computed live so the recency window never
 *     goes stale.
 */
export function icpToStrategy(
  icpName: string,
  criteria: Criterion[],
  metadata?: Record<string, unknown> | null,
): TamStrategy | null {
  const { params } = criteriaToApolloParams(criteria);

  const meta = metadata ?? {};
  const ui = meta.uiState != null ? parseUiState(meta.uiState) : null;
  if (ui?.ok && ui.value.companySizes.length > 0) {
    params.organization_num_employees_ranges = sizesToApolloRanges(ui.value.companySizes);
  }
  const sf = meta.sourcingFilters != null ? parseSourcingFilters(meta.sourcingFilters) : null;
  if (sf?.ok) {
    const hard = flatFiltersToHardApollo({
      excludeGeographies: sf.value.excludeGeographies,
      fundingRecencyDays: sf.value.fundingRecencyDays,
    });
    Object.assign(params, hard);
  }

  if (Object.keys(params).length === 0) return null;
  return {
    label: `ICP: ${icpName}`,
    reasoning: `Direct sourcing from the "${icpName}" ICP criteria.`,
    filters: params,
  };
}

const BIG = 1_000_000;

/**
 * Extract the signal-scorer ICP shape from criteria. Mirrors the
 * object the route builds from flat settings:
 *   { industries?: string[], sizeRange?: [number, number], geographies?: string[] }
 */
export function icpToSignalIcp(criteria: Criterion[]): {
  industries?: string[];
  sizeRange?: [number, number];
  geographies?: string[];
} {
  const out: {
    industries?: string[];
    sizeRange?: [number, number];
    geographies?: string[];
  } = {};

  for (const c of criteria) {
    if (c.fieldKey === "industry" && Array.isArray(c.value)) {
      out.industries = (c.value as unknown[]).map((v) => String(v));
    } else if (c.fieldKey === "geography" && Array.isArray(c.value)) {
      out.geographies = (c.value as unknown[]).map((v) => String(v));
    } else if (c.fieldKey === "employee_count") {
      if (c.operator === "between") {
        const v = (c.value as { min?: number; max?: number }) ?? {};
        out.sizeRange = [v.min ?? 0, v.max ?? BIG];
      } else if (c.operator === "gte" || c.operator === "gt") {
        const n = typeof c.value === "number" ? c.value : Number(c.value);
        if (Number.isFinite(n)) out.sizeRange = [n, BIG];
      } else if (c.operator === "lte" || c.operator === "lt") {
        const n = typeof c.value === "number" ? c.value : Number(c.value);
        if (Number.isFinite(n)) out.sizeRange = [0, n];
      }
    }
  }

  return out;
}
