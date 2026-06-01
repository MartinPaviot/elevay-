/**
 * Resolve the effective field catalog for a tenant (P2, _specs/multi-icp).
 *
 * The catalog is the union of:
 *   - global standard rows (tenant_id IS NULL) — the Apollo vocabulary
 *   - this tenant's custom rows (tenant_id = X) — custom props / signals
 *
 * On a fieldKey collision the tenant row wins (a tenant can override a
 * standard field's label/operators). Returned shape feeds
 * `validateIcpInput`'s CatalogEntry[] contract.
 */

import { db } from "@/db";
import { icpFieldCatalog } from "@/db/schema";
import { eq, isNull, or } from "drizzle-orm";
import type { CatalogEntry } from "./validation";
import type { CriterionOperator } from "./field-catalog";

export type ResolvedCatalogRow = {
  fieldKey: string;
  label: string;
  source: string;
  valueType: string;
  operators: CriterionOperator[];
  apolloParam: string | null;
  isCustom: boolean;
};

export async function resolveCatalogRows(
  tenantId: string,
): Promise<ResolvedCatalogRow[]> {
  const rows = await db
    .select()
    .from(icpFieldCatalog)
    .where(
      or(isNull(icpFieldCatalog.tenantId), eq(icpFieldCatalog.tenantId, tenantId)),
    );

  // Tenant row wins on collision.
  const byKey = new Map<string, ResolvedCatalogRow>();
  for (const r of rows) {
    const resolved: ResolvedCatalogRow = {
      fieldKey: r.fieldKey,
      label: r.label,
      source: r.source,
      valueType: r.valueType,
      operators: (r.operators as CriterionOperator[]) ?? [],
      apolloParam: r.apolloParam ?? null,
      isCustom: r.tenantId !== null,
    };
    const existing = byKey.get(r.fieldKey);
    if (!existing || resolved.isCustom) byKey.set(r.fieldKey, resolved);
  }
  return Array.from(byKey.values());
}

/** Catalog in the shape validateIcpInput expects. */
export async function resolveCatalogForValidation(
  tenantId: string,
): Promise<CatalogEntry[]> {
  const rows = await resolveCatalogRows(tenantId);
  return rows.map((r) => ({
    fieldKey: r.fieldKey,
    operators: r.operators,
    valueType: r.valueType,
  }));
}
