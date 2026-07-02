/**
 * home-proposed-lane — "Proposed by Elevay" daily cron.
 *
 * Loops per TENANT (like tam-refresh-cron.ts; unlike followup-nudge-cron.ts's
 * per-user fan-out — proposals are workspace-level, signals belong to the
 * tenant's companies, not to a mailbox owner). All logic lives in
 * lib/home/sequence-proposals-draft.ts (DB orchestration) on top of
 * lib/home/sequence-proposals.ts (pure, unit-tested engine); this file is
 * purely the fan-out.
 */

import { inngest } from "./client";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { isNull } from "drizzle-orm";
import { draftProposalsForTenant } from "@/lib/home/sequence-proposals-draft";
import { logger } from "@/lib/observability/logger";

export const homeProposalsDaily = inngest.createFunction(
  {
    id: "home-proposals-daily",
    name: "Daily sequence proposals (Proposed by Elevay)",
    retries: 1,
    triggers: [{ cron: "0 8 * * *" }], // 8am UTC daily — before the founder's morning
  },
  async ({ step }: { step: { run<T>(id: string, fn: () => Promise<T> | T): Promise<T> } }) => {
    const tenants: string[] = await step.run("list-tenants", async () => {
      const rows = await db
        .selectDistinct({ tenantId: companies.tenantId })
        .from(companies)
        .where(isNull(companies.deletedAt));
      return rows.map((r) => r.tenantId);
    });

    let totalDrafted = 0;
    let totalExpired = 0;
    let tenantsProcessed = 0;

    for (const tenantId of tenants) {
      const result = await step.run(`proposals-${tenantId}`, async () => {
        try {
          return await draftProposalsForTenant(tenantId);
        } catch (err) {
          // One tenant's failure must not block the fan-out (mold contract).
          logger.warn?.("home-proposals-daily: per-tenant pass failed (non-fatal)", {
            tenantId,
            err: err instanceof Error ? err.message : String(err),
          });
          return { drafted: 0, expired: 0, candidates: 0 };
        }
      });
      totalDrafted += result.drafted;
      totalExpired += result.expired;
      tenantsProcessed++;
    }

    return { tenantsProcessed, totalDrafted, totalExpired };
  },
);
