/**
 * Build insider warm paths from edges (_specs/CONNECTION-GRAPH).
 *
 * Groups the founder's first-degree, company-resolved edges by account and
 * computes the insider warm path for each. This is what gets materialised
 * into `warm_paths` after an ingestion run (cheap — derived from the
 * relations we already have, no extra provider calls). Intro paths are NOT
 * built here (they need per-target provider calls — see intro-paths.ts).
 * Pure.
 */

import { computeAccountWarmPath } from "./warm-path";
import type { ConnectionEdge, WarmPath } from "./types";

export interface AccountWarmPath {
  companyId: string;
  warmPath: WarmPath;
}

export function buildAccountWarmPaths(
  edges: ConnectionEdge[],
): AccountWarmPath[] {
  const companyIds = new Set<string>();
  for (const e of edges) {
    if (e.networkDistance === "first" && e.resolvedCompanyId) {
      companyIds.add(e.resolvedCompanyId);
    }
  }

  const out: AccountWarmPath[] = [];
  for (const companyId of companyIds) {
    const warmPath = computeAccountWarmPath(companyId, edges);
    if (warmPath.kind !== "none") out.push({ companyId, warmPath });
  }
  // Strongest first — stable, useful for capped persistence/display.
  out.sort((a, b) => b.warmPath.strength - a.warmPath.strength);
  return out;
}
