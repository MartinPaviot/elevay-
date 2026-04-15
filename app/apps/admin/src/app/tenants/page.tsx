/**
 * WS-2.1 admin surface: view + edit tenants.quota_overrides.
 *
 * Per-tenant override shape lives in lib/pricing/tiers.ts:
 *   - null / missing key  = inherit plan default
 *   - finite number (0+)  = override (0 = hard block, legitimate pause)
 *
 * Saves go through a server action (tenants/actions.ts) which sanitises the
 * payload (rejects unknown keys, non-integer or negative values) before the
 * update, so a typo here doesn't leave garbage in the jsonb.
 */

import { desc, sql } from "drizzle-orm";
import { db, tenants, contacts } from "../../lib/db";
import {
  getTierForPlan,
  getLimitsForTenant,
  type TierLimits,
} from "@web/lib/pricing/tiers";
import { QuotaOverridesForm } from "./quota-overrides-form";
import type { QuotaOverrides } from "./actions";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  name: string;
  plan: string | null;
  quotaOverrides: QuotaOverrides;
  contactCount: number;
}

async function loadTenants(): Promise<Row[]> {
  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      plan: tenants.plan,
      quotaOverrides: tenants.quotaOverrides,
      contactCount: sql<number>`(SELECT count(*)::int FROM ${contacts} WHERE ${contacts.tenantId} = ${tenants.id})`,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt))
    .limit(200);

  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? r.id,
    plan: r.plan,
    quotaOverrides: (r.quotaOverrides ?? {}) as QuotaOverrides,
    contactCount: Number(r.contactCount ?? 0),
  }));
}

export default async function TenantsPage() {
  const rows = await loadTenants();
  const withOverrides = rows.filter((r) => Object.keys(r.quotaOverrides).length > 0).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[20px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Tenants &amp; quota overrides
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--color-text-tertiary)" }}>
          {rows.length} tenants · {withOverrides} with active overrides. Quota defaults come
          from the plan (lib/pricing/tiers.ts). Overrides merge on top — null means inherit,
          a number overrides, 0 is a legitimate hard block.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((t) => {
          const tier = getTierForPlan(t.plan);
          const effective: TierLimits = getLimitsForTenant(t.plan, t.quotaOverrides);
          return (
            <div key={t.id} className="space-y-2">
              <QuotaOverridesForm
                tenantId={t.id}
                tenantName={t.name}
                planLabel={tier.displayName}
                planLimits={tier.limits}
                initialOverrides={t.quotaOverrides}
              />
              <EffectivePreview
                contactCount={t.contactCount}
                effective={effective}
                planDefaults={tier.limits}
              />
            </div>
          );
        })}
      </div>

      {rows.length === 0 && (
        <div
          className="rounded-lg border p-6 text-center text-[13px]"
          style={{ borderColor: "var(--color-border-default)", color: "var(--color-text-tertiary)" }}
        >
          No tenants found.
        </div>
      )}
    </div>
  );
}

function EffectivePreview({
  contactCount,
  effective,
  planDefaults,
}: {
  contactCount: number;
  effective: TierLimits;
  planDefaults: TierLimits;
}) {
  const cells: { label: string; current: number | null; limit: number; def: number }[] = [
    { label: "Contacts", current: contactCount, limit: effective.contacts, def: planDefaults.contacts },
    { label: "Emails / period", current: null, limit: effective.emailsPerMonth, def: planDefaults.emailsPerMonth },
    { label: "AI queries / period", current: null, limit: effective.aiQueriesPerMonth, def: planDefaults.aiQueriesPerMonth },
  ];

  return (
    <div
      className="rounded-md border px-3 py-2 text-[11px]"
      style={{ borderColor: "var(--color-border-default)", background: "var(--color-bg-muted, rgba(0,0,0,0.03))" }}
    >
      <div className="mb-1 font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
        Effective limits
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cells.map((c) => {
          const changed = c.limit !== c.def;
          const unlimited = !Number.isFinite(c.limit);
          return (
            <div key={c.label}>
              <div style={{ color: "var(--color-text-tertiary)" }}>{c.label}</div>
              <div
                style={{
                  color: changed ? "var(--color-accent)" : "var(--color-text-primary)",
                  fontWeight: changed ? 600 : 400,
                }}
              >
                {c.current !== null ? `${c.current.toLocaleString()} / ` : ""}
                {unlimited ? "∞" : c.limit.toLocaleString()}
                {changed ? " *" : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
