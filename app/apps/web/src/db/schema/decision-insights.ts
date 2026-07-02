// T9 (outreach-autopilot) — weekly_decision_insights: one row per published
// (or invalidated) weekly learning insight. Filled by the
// `decision-insights-weekly` cron from TWO sources: (a) outreach_decisions
// JOIN action_outcomes aggregates (persona x signal patterns, n >= 10, lift
// vs tenant baseline) and (b) sequence_drafts founder-rejection reasons
// (anti-patterns). Published rows are injected into drafting prompts via the
// applyLearnedContext seam (lib/decision-insights/get-decision-insights.ts).
//
// Idempotency: no unique index on the jsonb pattern (a jsonb unique key is
// brittle); instead the cron DELETEs the (tenant_id, week_of) batch before
// re-inserting, so a re-run replaces the week wholesale.
//
// HOUSE RULE (quality-gates.ts precedent): SOFT references on purpose —
// plain text id columns, NO .references()/SQL REFERENCES. This is a
// log/learning table: it must never take FK locks on business tables, and
// prod role ownership must never gate its migration.
import {
  pgTable,
  text,
  jsonb,
  timestamp,
  integer,
  real,
  date,
  index,
} from "drizzle-orm/pg-core";

export const weeklyDecisionInsights = pgTable(
  "weekly_decision_insights",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    /** Soft ref tenants.id. */
    tenantId: text("tenant_id").notNull(),
    /** Monday (UTC) of the week the cron ran — the batch key for the
     *  delete-then-insert idempotency rule. */
    weekOf: date("week_of").notNull(),
    /** 'pattern' | 'anti_pattern' | 'cold_start' — text on purpose (the
     *  vocabulary grows with new insight sources). */
    kind: text("kind").notNull(),
    /** The persona x signal bucket for 'pattern' rows
     *  ({ seniority, function, company_size, sector, signal_type }),
     *  { rejection_category } for 'anti_pattern' rows, null for cold_start. */
    pattern: jsonb("pattern").$type<Record<string, unknown>>(),
    /** Sample size: decisions in the bucket (pattern), founder rejections in
     *  the dominant category (anti_pattern), or total resolved decisions
     *  (cold_start — quantifies distance to the minimum). */
    n: integer("n").notNull(),
    /** positivity_avg - baseline. Null for anti_pattern / cold_start. */
    lift: real("lift"),
    positivityAvg: real("positivity_avg"),
    /** Tenant mean positivity across ALL resolved decisions in the window. */
    baseline: real("baseline"),
    summary: text("summary").notNull(),
    /** 'published' | 'invalidated'. M12-R5: a positive-lift pattern written
     *  while the tenant deliverability guard is tripped is 'invalidated'. */
    status: text("status").notNull().default("published"),
    invalidatedReason: text("invalidated_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // The cron's delete-then-insert batch scan + the reporting week view.
    index("weekly_decision_insights_tenant_week_idx").on(
      table.tenantId,
      table.weekOf,
    ),
    // The prompt-injection getter: latest published rows for a tenant.
    index("weekly_decision_insights_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
  ],
);
