-- M12-R1 (outreach-autopilot T7) — outreach_decisions: one row per OUTREACH
-- email send, the learning unit joining what-we-sent (persona, freshest
-- signal, message features, gate scores) to what-happened (outcome_id,
-- backfilled by T8). A REPLY-class send never records.
-- Log/learning table: SOFT references on purpose (plain text ids, no FK) —
-- it must never take locks on business tables, and prod role ownership must
-- never gate this migration.
CREATE TABLE IF NOT EXISTS outreach_decisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  contact_id TEXT,
  company_id TEXT,
  enrollment_id TEXT,
  step_index INTEGER,
  channel TEXT NOT NULL DEFAULT 'email',
  outbound_email_id TEXT,
  persona JSONB,
  signal JSONB,
  message_features JSONB,
  gate_scores JSONB,
  model TEXT,
  angle TEXT,
  alternatives JSONB,
  prompt_version TEXT,
  outcome_id TEXT,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_decisions_tenant_created_idx
  ON outreach_decisions (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS outreach_decisions_contact_idx
  ON outreach_decisions (contact_id);
CREATE INDEX IF NOT EXISTS outreach_decisions_enrollment_idx
  ON outreach_decisions (enrollment_id);
CREATE INDEX IF NOT EXISTS outreach_decisions_outcome_idx
  ON outreach_decisions (outcome_id);

-- Inngest-retry dedup key: a replayed send step re-runs the writer with the
-- same outbound row id; ON CONFLICT DO NOTHING against this partial unique
-- index keeps EXACTLY one record per outreach send. Partial: C5 (meeting
-- follow-up) queues no outbound row and writes NULL, which must not collide.
CREATE UNIQUE INDEX IF NOT EXISTS outreach_decisions_outbound_email_idx
  ON outreach_decisions (outbound_email_id)
  WHERE outbound_email_id IS NOT NULL;
