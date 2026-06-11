/**
 * Account lifecycle stage — single source of truth.
 *
 * The effective stage is DERIVED AT READ TIME from the deals table, not
 * synced at write time: deals are mutated from ~35 call sites (kanban drag,
 * chat tools, call analysis, imports, undo, account-cascade delete/restore…),
 * so any write-time sync would drift. Deriving keeps the stage correct
 * through every mutation path, retroactively, with no backfill.
 *
 * Precedence (one rule): manual override > deal-derived > 'new'.
 *  - properties->>'lifecycleStage' is the MANUAL override slot — set via the
 *    chat tool updateAccountLifecycle or POST /api/accounts/[id]/lifecycle;
 *    absent by default. Setting it to "auto" clears the override.
 *  - otherwise the account follows its deals: any won deal → customer; any
 *    open deal → opportunity; only lost deals → nurture.
 *  - no override, no deals → 'new'.
 */

export const LIFECYCLE_STAGES = [
  "new",
  "prospecting",
  "opportunity",
  "customer",
  "disqualified",
  "inbound",
  "nurture",
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

/** Sentinel accepted by the writers to clear the manual override. */
export const LIFECYCLE_AUTO = "auto";

/**
 * Normalize free-form input ("Customer", " NURTURE ") to a canonical stage.
 * Returns "auto" for the clear-override sentinel, null for anything invalid.
 */
export function normalizeLifecycleStage(
  input: string,
): LifecycleStage | typeof LIFECYCLE_AUTO | null {
  const v = input.trim().toLowerCase();
  if (v === LIFECYCLE_AUTO) return LIFECYCLE_AUTO;
  return (LIFECYCLE_STAGES as readonly string[]).includes(v)
    ? (v as LifecycleStage)
    : null;
}

/**
 * Pure mirror of EFFECTIVE_LIFECYCLE_STAGE_SQL, for unit tests and
 * single-account consumers that already know the deal facts.
 */
export function deriveLifecycleStage(opts: {
  manual?: string | null;
  hasWonDeal: boolean;
  hasOpenDeal: boolean;
  hasLostDeal: boolean;
}): string {
  const manual = opts.manual?.trim().toLowerCase();
  if (manual) return manual;
  if (opts.hasWonDeal) return "customer";
  if (opts.hasOpenDeal) return "opportunity";
  if (opts.hasLostDeal) return "nurture";
  return "new";
}

/**
 * SQL for the effective stage of a "companies" row. A plain string with no
 * bound params so it embeds via sql.raw() in drizzle queries and interpolates
 * into raw facet queries alike. Columns are literally qualified
 * ("companies"."id") — ${table.col} inside a correlated subquery renders
 * unqualified and silently binds to the inner table (the drizzle subquery
 * footgun), so never rebuild this with drizzle column refs.
 */
export const EFFECTIVE_LIFECYCLE_STAGE_SQL = `COALESCE(
  lower(NULLIF(btrim("companies"."properties"->>'lifecycleStage'), '')),
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "deals"
      WHERE "deals"."tenant_id" = "companies"."tenant_id"
        AND "deals"."company_id" = "companies"."id"
        AND "deals"."deleted_at" IS NULL
        AND "deals"."stage" = 'won'
    ) THEN 'customer'
    WHEN EXISTS (
      SELECT 1 FROM "deals"
      WHERE "deals"."tenant_id" = "companies"."tenant_id"
        AND "deals"."company_id" = "companies"."id"
        AND "deals"."deleted_at" IS NULL
        AND "deals"."stage" IS DISTINCT FROM 'won'
        AND "deals"."stage" IS DISTINCT FROM 'lost'
    ) THEN 'opportunity'
    WHEN EXISTS (
      SELECT 1 FROM "deals"
      WHERE "deals"."tenant_id" = "companies"."tenant_id"
        AND "deals"."company_id" = "companies"."id"
        AND "deals"."deleted_at" IS NULL
        AND "deals"."stage" = 'lost'
    ) THEN 'nurture'
    ELSE 'new'
  END
)`;
