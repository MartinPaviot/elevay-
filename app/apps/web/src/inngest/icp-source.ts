import { inngest } from "./client";
import { db } from "@/db";
import { icps, icpCriteria, companies } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { icpToStrategy } from "@/lib/icp/icp-to-tam";
import type { Criterion } from "@/lib/icp/criteria-engine";
import {
  searchOrganizations,
  isApolloAvailable,
} from "@/lib/integrations/apollo-client";
import { proposeTamChange } from "@/lib/tam/proposals";
import { orgToAddPayload, normalizeDomain } from "@/lib/tam/candidate";

/**
 * ICP → net-new add-proposals (living-TAM loop). Fired when an ICP is
 * activated (api/icps). Sources a bounded page from the ICP's criteria
 * and QUEUES `add` proposals for the net-new domains — it never inserts
 * or enriches directly. This is how the TAM grows when the founder
 * sharpens their ICP, under the approval-queue posture.
 */
const MAX_PROPOSALS = 50;

export const sourceIcpToProposals = inngest.createFunction(
  {
    id: "icp-source-to-proposals",
    name: "ICP → net-new add-proposals",
    retries: 1,
    triggers: [{ event: "icp/source-tenant" }],
  },
  async ({ event, step }: { event: { data: { tenantId: string; icpId: string } }; step: any }) => {
    const { tenantId, icpId } = event.data;
    if (!isApolloAvailable()) return { proposed: 0, reason: "apollo unavailable" };

    const strategy = await step.run("load-icp-strategy", async () => {
      const [icp] = await db
        .select({ id: icps.id, name: icps.name })
        .from(icps)
        .where(and(eq(icps.id, icpId), eq(icps.tenantId, tenantId)))
        .limit(1);
      if (!icp) return null;
      const crit = await db
        .select()
        .from(icpCriteria)
        .where(eq(icpCriteria.icpId, icp.id));
      const criteria: Criterion[] = crit.map((r) => ({
        id: r.id,
        fieldKey: r.fieldKey,
        operator: r.operator as Criterion["operator"],
        value: r.value,
        weight: r.weight,
        isRequired: r.isRequired,
      }));
      return icpToStrategy(icp.name, criteria);
    });

    if (!strategy) return { proposed: 0, reason: "no apollo-sourceable criteria" };

    return await step.run("search-and-propose", async () => {
      const search = await searchOrganizations({
        ...strategy.filters,
        page: 1,
        per_page: MAX_PROPOSALS,
      });

      // Dedup against everything already in the TAM (incl. excluded —
      // they stay as rows so we never re-propose what was rejected).
      const existing = await db
        .select({ domain: companies.domain })
        .from(companies)
        .where(and(eq(companies.tenantId, tenantId), isNull(companies.deletedAt)));
      const known = new Set(
        existing
          .map((c) => c.domain?.toLowerCase())
          .filter((d): d is string => Boolean(d)),
      );

      let proposed = 0;
      for (const org of search.organizations ?? []) {
        if (proposed >= MAX_PROPOSALS) break;
        const domain = normalizeDomain(org.primary_domain ?? org.website_url ?? null);
        if (!domain || known.has(domain)) continue;
        known.add(domain);
        const r = await proposeTamChange({
          tenantId,
          kind: "add",
          dedupKey: domain,
          payload: orgToAddPayload(org, domain),
          summary: `${org.name ?? domain}${org.industry ? ` — ${org.industry}` : ""}`,
          reason: strategy.label,
          source: "icp_source",
        });
        if (r.created) proposed++;
      }
      return { proposed };
    });
  },
);
