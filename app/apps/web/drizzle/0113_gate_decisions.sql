-- M13-R6/R7 (outreach-autopilot T6) — gate_decisions: one row per quality-gate
-- verdict (G1 targeting, G2 factual, G4 copy quality, G5 deliverability).
-- Log table: text vocabulary on purpose (no enum), never a lock.
CREATE TABLE IF NOT EXISTS gate_decisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  gate SMALLINT NOT NULL,
  rubric_version TEXT NOT NULL,
  score REAL,
  verdict TEXT NOT NULL,
  reasons JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gate_decisions_tenant_gate_idx
  ON gate_decisions (tenant_id, gate, created_at);
CREATE INDEX IF NOT EXISTS gate_decisions_subject_idx
  ON gate_decisions (subject_type, subject_id);

-- T6 — extend the sequence_drafts lifecycle with the gate states
-- (design §5: draft -> gates_running -> pending_approval | blocked ->
-- reworking -> gates_running; blocked twice -> set_aside, never sent).
-- ADD VALUE appends; safe inside the runner's transaction on PG>=12
-- because no statement below USES the new values.
ALTER TYPE sequence_draft_status ADD VALUE IF NOT EXISTS 'gates_running';
ALTER TYPE sequence_draft_status ADD VALUE IF NOT EXISTS 'blocked';
ALTER TYPE sequence_draft_status ADD VALUE IF NOT EXISTS 'reworking';
ALTER TYPE sequence_draft_status ADD VALUE IF NOT EXISTS 'set_aside';
