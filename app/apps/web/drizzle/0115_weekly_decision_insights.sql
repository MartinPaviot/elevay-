-- T9 (outreach-autopilot) — weekly_decision_insights: one row per published
-- (or invalidated) weekly learning insight, written by the
-- decision-insights-weekly cron from outreach_decisions x action_outcomes
-- aggregates (patterns) and sequence_drafts founder-rejection reasons
-- (anti-patterns). Idempotency is delete-then-insert per (tenant_id,
-- week_of) inside the cron — no unique index on the jsonb pattern.
-- Log/learning table: SOFT references on purpose (plain text ids, no FK) —
-- it must never take locks on business tables, and prod role ownership must
-- never gate this migration.
CREATE TABLE IF NOT EXISTS weekly_decision_insights (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  week_of DATE NOT NULL,
  kind TEXT NOT NULL,
  pattern JSONB,
  n INTEGER NOT NULL,
  lift REAL,
  positivity_avg REAL,
  baseline REAL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  invalidated_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weekly_decision_insights_tenant_week_idx
  ON weekly_decision_insights (tenant_id, week_of);
CREATE INDEX IF NOT EXISTS weekly_decision_insights_tenant_status_idx
  ON weekly_decision_insights (tenant_id, status, created_at);
