/**
 * Intro-path resolution (_specs/CONNECTION-GRAPH).
 *
 * For a set of cold targets at priority accounts, fetch each target's
 * shared connections and compute the intro path. This is the EXPENSIVE,
 * Sales-Nav-gated half of the graph (one provider call per target,
 * rate-limited), so it runs only for high-priority targets under a strict
 * budget — never the whole TAM. IO injected (getSharedConnections) so the
 * orchestration is tested with a fake, no provider, no network.
 */

import { computeContactIntroPath } from "./warm-path";
import type { ConnectionEdge, WarmPath } from "./types";
import type { SharedConnections } from "./provider/types";

export interface IntroPathDeps {
  getSharedConnections: (
    targetExternalId: string,
  ) => Promise<SharedConnections>;
}

export interface ResolveIntroParams {
  /** Cold targets to probe, in priority order. */
  targets: Array<{ personExternalId: string }>;
  /** The founder's own first-degree edges (the connectors we can ask). */
  edges: ConnectionEdge[];
  /** Max provider calls this run (rate-limit budget). */
  budget: number;
}

export interface IntroPathResult {
  paths: Map<string, WarmPath>;
  /** Targets probed this run (≤ budget). */
  probed: number;
  /** True when targets remained beyond the budget — resume next run. */
  budgetExhausted: boolean;
}

export async function resolveIntroPaths(
  params: ResolveIntroParams,
  deps: IntroPathDeps,
): Promise<IntroPathResult> {
  const paths = new Map<string, WarmPath>();
  const budget = Math.max(0, params.budget);
  let probed = 0;

  for (const target of params.targets) {
    if (probed >= budget) {
      return { paths, probed, budgetExhausted: true };
    }
    const shared = await deps.getSharedConnections(target.personExternalId);
    probed += 1;
    const wp = computeContactIntroPath(params.edges, {
      connectorExternalIds: shared.connectorExternalIds,
      count: shared.count,
    });
    if (wp.kind !== "none") {
      paths.set(target.personExternalId, wp);
    }
  }

  return { paths, probed, budgetExhausted: false };
}
