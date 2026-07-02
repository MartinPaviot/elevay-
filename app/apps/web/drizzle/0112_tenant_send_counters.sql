-- INV-1 (outreach-autopilot M5-R1) — per-tenant daily outreach send counter.
-- The 100/day cap itself is a compiled constant (lib/guardrails/outreach-cap.ts),
-- deliberately NOT a column: this table only stores consumption.
CREATE TABLE IF NOT EXISTS "tenant_send_counters" (
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "day" text NOT NULL,
  "sent_count" integer NOT NULL DEFAULT 0,
  CONSTRAINT "tenant_send_counters_pk" PRIMARY KEY ("tenant_id", "day")
);
