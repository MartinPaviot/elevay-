-- Spec 33 — lawful-basis compliance columns on contacts.
-- Additive + idempotent + nullable. lawful_basis holds { type, assessmentId?,
-- consentAt? }; jurisdiction is FR/CH/EU/…; `source` provenance reuses the
-- existing source_system column. The lawful-basis gate is BLOCK-BY-DEFAULT, so
-- it stays behind the LAWFUL_BASIS_GATE env flag (off) until these are
-- backfilled — enforcing on NULL would halt every send.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lawful_basis jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS jurisdiction text;
