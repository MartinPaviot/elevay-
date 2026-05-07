-- P0-1 task 1.10 — backfill `tenants.settings.approvalMode = 'manual'`
-- for every existing tenant that doesn't yet have the key set.
--
-- The router (`lib/sequence-drafts/router.ts`) defaults to "manual"
-- when the key is absent, so this backfill is functionally a no-op
-- against the current code path. It exists for two reasons :
--   1. Make the default explicit — ops sanity-checking a tenant row
--      can read the value directly instead of inferring it from
--      code defaults.
--   2. Make the future "promote tenant to auto" UX a single-key
--      flip from "manual" → "auto" rather than a "set the key for
--      the first time" insert.
--
-- Idempotent : the COALESCE guard means re-running this migration
-- against rows that already have an approvalMode preserves their
-- value. Auto-mode tenants stay auto-mode.
--
-- A dedicated column is the proper home for this once it stabilises
-- (P1) ; for now it lives in the existing `settings` jsonb so we
-- don't pay a schema migration on every config dimension we add
-- during the queue's rollout.

UPDATE tenants
SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{approvalMode}',
    to_jsonb(COALESCE(settings ->> 'approvalMode', 'manual'))
  ),
  updated_at = NOW()
WHERE
  -- Only touch rows that don't already have the key — keeps the
  -- migration trivially re-runnable.
  (settings ->> 'approvalMode') IS NULL;

-- Diagnostic view for ops : how many tenants on each mode ?
-- Lets the team see "47 tenants on manual, 3 on auto" at a glance.
CREATE OR REPLACE VIEW tenant_approval_modes AS
SELECT
  COALESCE(settings ->> 'approvalMode', 'manual') AS approval_mode,
  COUNT(*) AS tenant_count,
  MAX(updated_at) AS last_change_at
FROM tenants
GROUP BY 1;
