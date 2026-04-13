-- T0.3 — Challenge label migration.
-- The home page subtitle matched on "Finding the right leads" but the
-- wizard had been writing "Finding leads" for ages (cf.
-- `components/onboarding-wizard.tsx`). The fallback branch kicked in for
-- every tenant whose onboarding happened after the rename, so the
-- personalised subtitle never appeared.
--
-- The UI fix now expects "Finding leads". This migration cleans up any
-- tenant row that is still carrying the legacy label, so we don't need
-- a backwards-compat alias on the client.
UPDATE tenants
SET settings = jsonb_set(settings, '{primaryChallenge}', '"Finding leads"')
WHERE settings->>'primaryChallenge' = 'Finding the right leads';
