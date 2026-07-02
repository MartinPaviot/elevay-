// M8-R2/M11-R3 (outreach-autopilot T10) — reply_review_queue: one row per
// reply whose LIVE classification landed below the confidence floor. The
// queue is a review OVERLAY, not a gate: the reply still routes normally
// (a hot lead must never wait on a human), and the founder's 1-click
// correction re-routes it + persists the label for learning.
//
// Soft references + text columns on purpose (quality-gates/outreach-learning
// precedent): review/learning tables never lock business tables.
import {
  pgTable,
  text,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const replyReviewQueue = pgTable(
  "reply_review_queue",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id").notNull(),
    /** The classified OUTBOUND row (where reply_classification + the reply
     *  snippet live — replies are detected by thread-match on the email we
     *  sent; there is no inbound_emails table). */
    outboundEmailId: text("outbound_email_id").notNull(),
    enrollmentId: text("enrollment_id"),
    contactId: text("contact_id"),
    /** { classification, confidence, reason } as the model emitted them. */
    classification: jsonb("classification")
      .$type<Record<string, unknown>>()
      .notNull(),
    /** { classification } the founder chose; null until corrected. */
    corrected: jsonb("corrected").$type<Record<string, unknown>>(),
    /** pending -> corrected (founder changed it) | confirmed (AI was right). */
    state: text("state").notNull().default("pending"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // The review lane: pending items per tenant, newest first.
    index("reply_review_queue_tenant_state_idx").on(
      table.tenantId,
      table.state,
      table.createdAt,
    ),
    // One PENDING review entry per classified reply — Inngest-retry dedup.
    // Partial (review fix): a SECOND low-confidence reply on the same thread
    // after the first was resolved must queue again, not vanish forever.
    uniqueIndex("reply_review_queue_outbound_pending_idx")
      .on(table.outboundEmailId)
      .where(sql`state = 'pending'`),
  ],
);
