/**
 * Server-side profile upsert from a uiState (Phase 1,
 * _specs/icp-unification R5.3/R5.4).
 *
 * The two non-editor writers of targeting — the persona-search apply
 * (/api/icp/apply) and onboarding — no longer write the flat
 * tenants.settings keys directly. They build a uiState and route it
 * here: the RANK-1 ACTIVE profile is updated (or a "Default" profile
 * is created when the tenant has none), criteria are regenerated
 * through the exact same path the editor uses, and the flats mirror
 * follows via syncRankOneMirror. One writer model, no split-brain.
 *
 * Guided-slot criteria on the existing profile are REPLACED (applying
 * a persona means "this is my targeting now"); criteria outside the
 * guided slots — custom properties, signals, funding stages — are
 * preserved untouched.
 */

import { db } from "@/db";
import { icps, icpCriteria } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import {
  uiStateToCriteria,
  splitCriteria,
  EMPTY_SOURCING_FILTERS,
  type IcpUiState,
  type SourcingFilters,
} from "./ui-state";
import { syncRankOneMirror } from "./mirror";

export async function upsertRankOneProfileFromUiState(opts: {
  tenantId: string;
  /** users.id (APP id) for created_by on create; null when unknown. */
  appUserId: string | null;
  /** Name used only when creating a fresh profile. */
  name?: string;
  uiState: IcpUiState;
  sourcingFilters?: SourcingFilters;
}): Promise<{ icpId: string; created: boolean }> {
  const { tenantId, appUserId, uiState } = opts;
  const sourcingFilters = opts.sourcingFilters ?? EMPTY_SOURCING_FILTERS;
  const generated = uiStateToCriteria(uiState);

  const [top] = await db
    .select({ id: icps.id, metadata: icps.metadata })
    .from(icps)
    .where(and(eq(icps.tenantId, tenantId), eq(icps.status, "active"), isNull(icps.deletedAt)))
    .orderBy(icps.priority, icps.createdAt)
    .limit(1);

  let icpId: string;
  let created = false;

  if (top) {
    icpId = top.id;
    const existingRows = await db
      .select()
      .from(icpCriteria)
      .where(eq(icpCriteria.icpId, top.id));
    // Guided slots are replaceable regardless of how the profile was
    // authored; everything else is preserved.
    const { advanced } = splitCriteria(
      existingRows.map((r) => ({
        fieldKey: r.fieldKey,
        operator: r.operator,
        value: r.value,
        weight: r.weight,
        isRequired: r.isRequired,
      })),
      true,
    );
    const meta = {
      ...((top.metadata ?? {}) as Record<string, unknown>),
      uiState,
      sourcingFilters,
    };
    const criteria = [...generated, ...advanced];
    await db.transaction(async (tx) => {
      await tx
        .update(icps)
        .set({ metadata: meta, updatedAt: new Date() })
        .where(eq(icps.id, top.id));
      await tx.delete(icpCriteria).where(eq(icpCriteria.icpId, top.id));
      if (criteria.length > 0) {
        await tx.insert(icpCriteria).values(
          criteria.map((c) => ({
            icpId: top.id,
            fieldKey: c.fieldKey,
            operator: c.operator,
            value: c.value as object,
            weight: c.weight,
            isRequired: c.isRequired,
          })),
        );
      }
    });
  } else {
    // No active profile (e.g. fresh tenant): create one. Guard parity
    // with validateIcpInput — an active profile needs >= 1 criterion,
    // so an empty uiState creates a DRAFT the user can finish later.
    icpId = crypto.randomUUID();
    created = true;
    const status = generated.length > 0 ? "active" : "draft";
    await db.transaction(async (tx) => {
      await tx.insert(icps).values({
        id: icpId,
        tenantId,
        name: opts.name ?? "Default",
        description: null,
        status,
        priority: 0,
        metadata: { uiState, sourcingFilters },
        createdByUserId: appUserId,
      });
      if (generated.length > 0) {
        await tx.insert(icpCriteria).values(
          generated.map((c) => ({
            icpId,
            fieldKey: c.fieldKey,
            operator: c.operator,
            value: c.value as object,
            weight: c.weight,
            isRequired: c.isRequired,
          })),
        );
      }
    });
    if (status === "active") {
      // Parity with POST /api/icps: a new active profile proposes
      // net-new accounts through the approval queue.
      inngest
        .send({ name: "icp/source-tenant", data: { tenantId, icpId } })
        .catch(() => {});
    }
  }

  await syncRankOneMirror(tenantId);
  inngest
    .send({ name: "icp/recompute-tenant", data: { tenantId } })
    .catch(() => {});

  return { icpId, created };
}
