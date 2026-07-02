-- home-proposed-lane — "Proposed by Elevay" sequence proposals on /home.
-- A daily cron (inngest/home-proposals-cron.ts) aggregates companies carrying
-- a FRESH signal of the same canonical family into one launch proposal
-- ("Recent funding — 7 accounts"). Nothing sends from this feature: Launch
-- instantiates the proven template as a DRAFT sequence and enrolls the cohort;
-- activation (the act that lets the send worker touch it) stays a separate
-- human step in /sequences/[id].
--
-- Dedupe is CONTENT-based: unique (tenant_id, signal_family, cohort_hash),
-- unconditional across statuses — a dismissed family only re-proposes when
-- the cohort itself changes (new company -> new hash -> new row).
-- Additive + idempotent so the custom runner (scripts/apply-migrations.ts)
-- can re-apply safely.

DO $$ BEGIN
  CREATE TYPE home_sequence_proposal_status AS ENUM ('pending_review', 'launched', 'dismissed', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS home_sequence_proposals (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  signal_family         TEXT NOT NULL,
  template_id           TEXT NOT NULL,
  title                 TEXT NOT NULL,
  company_ids           JSONB NOT NULL,
  company_names         JSONB NOT NULL,
  company_count         INTEGER NOT NULL,
  contactable_count     INTEGER NOT NULL,
  freshest_at           TIMESTAMPTZ NOT NULL,
  cohort_hash           TEXT NOT NULL,
  status                home_sequence_proposal_status NOT NULL DEFAULT 'pending_review',
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at           TIMESTAMPTZ,
  launched_at           TIMESTAMPTZ,
  dismissed_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ NOT NULL,
  launched_sequence_id  TEXT,
  launched_list_id      TEXT,
  version               INTEGER NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hsp_tenant_status_idx
  ON home_sequence_proposals (tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS hsp_dedupe_idx
  ON home_sequence_proposals (tenant_id, signal_family, cohort_hash);
