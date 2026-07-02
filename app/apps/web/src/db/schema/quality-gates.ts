// M13-R6/R7 (outreach-autopilot T6) — one row per quality-gate VERDICT, the
// audit trail behind "why was this blocked/sent" and the per-gate block-rate
// metric (reporting T11). Distinct from ./gates.ts (approval_gate = the HITL
// workflow gate a run blocks on); this table is a log, never a lock.
//
// Columns are text + smallint on purpose (no pgEnum): a log table's
// vocabulary grows with the gates and must never need an ALTER TYPE.
import {
  pgTable,
  text,
  jsonb,
  timestamp,
  smallint,
  real,
  index,
} from "drizzle-orm/pg-core";

export const gateDecisions = pgTable(
  "gate_decisions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id").notNull(),
    /** What the verdict is about:
     *  - "draft"      → sequence_drafts.id (G4 at draft generation)
     *  - "step"       → a sequence-generation run (G2/G4 in sequence-generator)
     *  - "manual"     → a composer pregate check (G2/G5, subject = contactId or address)
     *  - "enrollment" → an enrollment attempt (G1, subject = contactId)
     *  - "send"       → a transport-time check (G5 in evaluateSend) */
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    /** 1=targeting, 2=factual, 3=interchangeability, 4=copy quality, 5=deliverability */
    gate: smallint("gate").notNull(),
    /** Versioned rubric identifier (e.g. "g4.step.v1") — rubrics are code (INV-8). */
    rubricVersion: text("rubric_version").notNull(),
    /** 0-1 where the gate scores (G4); null for boolean gates (G1/G2/G5). */
    score: real("score"),
    /** "pass" | "blocked" | "reworked" (blocked then auto-corrected in the same run). */
    verdict: text("verdict").notNull(),
    /** Machine-readable context: failure codes, thresholds, ids (sequenceId…). */
    reasons: jsonb("reasons").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Reporting: block rate per gate over a period (T11).
    index("gate_decisions_tenant_gate_idx").on(
      table.tenantId,
      table.gate,
      table.createdAt,
    ),
    // Review UI: all verdicts for one draft/enrollment (T11c).
    index("gate_decisions_subject_idx").on(table.subjectType, table.subjectId),
  ],
);
