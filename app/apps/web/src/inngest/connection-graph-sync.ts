/**
 * Connection-graph ingestion job (_specs/CONNECTION-GRAPH).
 *
 * ⚠️ DORMANT — fully wired but deliberately NOT registered in
 * `app/api/inngest/route.ts`, given NO cron, and triggered by an event
 * NOTHING in live code emits. So it cannot fire in production. It also
 * hard-returns when `isConnectionGraphEnabled()` is false (prod default)
 * and when no provider resolves. To go live: register it in the route,
 * emit `linkedin/graph.sync.requested` from the connect flow + a daily
 * drip cron, and flip the flag. The orchestration (ingestRelations,
 * buildAccountWarmPaths) and persistence (repository) are already in
 * place and tested.
 */

import { inngest } from "./client";
import { isConnectionGraphEnabled } from "@/lib/connection-graph/config";
import { resolveGraphProvider } from "@/lib/connection-graph/provider";
import { ingestRelations } from "@/lib/connection-graph/ingest";
import { buildAccountWarmPaths } from "@/lib/connection-graph/build-warm-paths";
import { resolveCompany } from "@/lib/connection-graph/company-resolution";
import {
  getConnectedAccount,
  loadCompanyCandidates,
  loadOwnerEdges,
  saveAccountCursor,
  upsertConnectionEdges,
  upsertWarmPaths,
} from "@/lib/connection-graph/repository";
import { logger } from "@/lib/observability/logger";

type GraphSyncEvent = {
  data: {
    tenantId: string;
    ownerUserId: string;
    /** Pages to pull this run (rate-limit budget). */
    maxPages?: number;
  };
};

export const connectionGraphSync = inngest.createFunction(
  {
    id: "connection-graph-sync",
    name: "Connection graph: ingest relations (dormant)",
    retries: 2,
    // Event-only, never emitted by live code today. No cron.
    triggers: [{ event: "linkedin/graph.sync.requested" }],
  },
  async ({ event, step }: { event: GraphSyncEvent; step: any }) => {
    if (!isConnectionGraphEnabled()) {
      return { skipped: "feature_disabled" };
    }
    const provider = resolveGraphProvider();
    if (!provider) {
      return { skipped: "no_provider" };
    }

    const { tenantId, ownerUserId, maxPages } = event.data;

    const account = await step.run("load-account", async () =>
      getConnectedAccount(ownerUserId),
    );
    if (!account || account.status !== "connected") {
      return { skipped: "account_not_connected", ownerUserId };
    }

    // Candidate companies for in-run resolution (tenant-scoped).
    const candidates = await step.run("load-candidates", async () =>
      loadCompanyCandidates(tenantId),
    );

    // Drip ingest: paginate within the budget, stop on rate-limit, persist
    // the cursor each page so the next run resumes.
    const result = await ingestRelations(
      {
        ownerUserId,
        tenantId,
        source: provider.id,
        startCursor: account.syncCursor ?? null,
        maxPages: maxPages ?? 10,
      },
      {
        listRelations: (cursor) =>
          provider.listRelations(account.externalAccountId, cursor),
        resolveCompany: (raw) => resolveCompany(raw, candidates),
        upsertEdges: (edges) => upsertConnectionEdges(edges, account.id),
        saveCursor: (cursor) => saveAccountCursor(account.id, cursor),
      },
    );

    // Rebuild the insider warm paths from the (now-updated) edge set.
    const edges = await step.run("load-edges", async () =>
      loadOwnerEdges(ownerUserId, tenantId),
    );
    const accountPaths = buildAccountWarmPaths(edges);
    await step.run("persist-warm-paths", async () =>
      upsertWarmPaths(tenantId, ownerUserId, accountPaths),
    );

    logger.info("connection-graph-sync.run", {
      ownerUserId,
      pages: result.pages,
      edges: result.edges,
      resolved: result.resolved,
      warmAccounts: accountPaths.length,
      stoppedReason: result.stoppedReason,
    });

    return {
      ...result,
      warmAccounts: accountPaths.length,
      nextCursor: result.nextCursor,
    };
  },
);
