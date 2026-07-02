// M12-R1 (outreach-autopilot T7) — one row per OUTREACH email send: the
// learning unit joining what-we-sent (persona / freshest signal / message
// features / gate scores) to what-happened (outcome_id, backfilled by the T8
// outcome resolver). Written at TRANSPORT by lib/outreach/decision-record.ts
// immediately after the shared sending gate allows; a REPLY-class send never
// records (answering a prospect is not prospecting — INV-1).
//
// HOUSE RULE (quality-gates.ts precedent): SOFT references on purpose — plain
// text id columns + indexes, NO .references()/SQL REFERENCES. This is a
// log/learning table: it must never take FK locks on business tables, and
// prod role ownership must never gate its migration.
import {
  pgTable,
  text,
  jsonb,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const outreachDecisions = pgTable(
  "outreach_decisions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id").notNull(),
    /** Soft ref contacts.id — nullable: an interactive send (C4/C5) may have
     *  no contact in scope. */
    contactId: text("contact_id"),
    /** Soft ref companies.id — resolved from the contact when not supplied. */
    companyId: text("company_id"),
    /** Soft ref sequence_enrollments.id — sequence sends only (C1/C2/C3). */
    enrollmentId: text("enrollment_id"),
    /** Sequence step (outbound_emails.step_number) — sequence sends only. */
    stepIndex: integer("step_index"),
    /** "email" v1 — text on purpose (the vocabulary grows with LinkedIn). */
    channel: text("channel").notNull().default("email"),
    /** Soft ref outbound_emails.id — THE Inngest-retry dedup key (partial
     *  unique index below). NULL for C5 (meeting follow-up), which queues no
     *  outbound row: duplicate-risk is tolerated there and the route's own
     *  followUpSentAt 409 guard is the effective once-only rail. */
    outboundEmailId: text("outbound_email_id"),
    /** Snapshot at send: { seniority, function, company_size, sector,
     *  maturity } — maturity null v1 (no standard company field). */
    persona: jsonb("persona").$type<Record<string, unknown>>(),
    /** The FRESHEST company signal at send: { type, detected_at, source,
     *  freshness_days }; null when none is fresh. */
    signal: jsonb("signal").$type<Record<string, unknown>>(),
    /** v1: { length_words, cta_type, tone: null }
     *  (lib/emails/message-features.ts). */
    messageFeatures: jsonb("message_features").$type<Record<string, unknown>>(),
    /** { g2, g4 } verdicts logged against this outbound row (gate_decisions,
     *  subject_type 'draft'). The G5 'send'-row join is deferred — see
     *  lib/outreach/decision-record.ts. */
    gateScores: jsonb("gate_scores").$type<Record<string, unknown>>(),
    /** Null v1 — the drafting model is not knowable at transport time. */
    model: text("model"),
    /** Null v1 — angle / alternatives / prompt_version do not exist before
     *  T18 (angle selection). */
    angle: text("angle"),
    alternatives: jsonb("alternatives").$type<unknown[]>(),
    promptVersion: text("prompt_version"),
    /** Soft ref action_outcomes.id — NULL at write, backfilled by T8. */
    outcomeId: text("outcome_id"),
    /** Transport time (every chokepoint sends immediately in v1). */
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Reporting/learning scans: a tenant's decisions over a period.
    index("outreach_decisions_tenant_created_idx").on(
      table.tenantId,
      table.createdAt,
    ),
    index("outreach_decisions_contact_idx").on(table.contactId),
    index("outreach_decisions_enrollment_idx").on(table.enrollmentId),
    // T8 backfill: decision <-> outcome join.
    index("outreach_decisions_outcome_idx").on(table.outcomeId),
    // Inngest-retry dedup: a replayed send step re-writes the same outbound
    // row id; ON CONFLICT DO NOTHING against this keeps EXACTLY one record.
    // Partial so C5's NULL keys never collide with each other.
    uniqueIndex("outreach_decisions_outbound_email_idx")
      .on(table.outboundEmailId)
      .where(sql`outbound_email_id is not null`),
  ],
);
