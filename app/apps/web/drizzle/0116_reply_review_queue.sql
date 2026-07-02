-- M8-R2/M11-R3 (outreach-autopilot T10) — reply_review_queue: one row per
-- reply classified below the confidence floor. Review OVERLAY (the reply
-- still routes); the founder's correction re-routes + persists the label.
-- Soft references on purpose (log/review table, never locks).
CREATE TABLE IF NOT EXISTS reply_review_queue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  outbound_email_id TEXT NOT NULL,
  enrollment_id TEXT,
  contact_id TEXT,
  classification JSONB NOT NULL,
  corrected JSONB,
  state TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reply_review_queue_tenant_state_idx
  ON reply_review_queue (tenant_id, state, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS reply_review_queue_outbound_email_idx
  ON reply_review_queue (outbound_email_id);
