# Requirements — "Proposed by Elevay" (/home agentic sequence proposals)

Founder ask (2026-07-02): "mettre en avant des actions agentiques comme des propositions
de séquences ultra qualifiées et précises sur une ICP qui a un type de signal
d'actualité en particulier". The pull-side complement to `signalAutoEnroll`
(inngest/signal-to-sequence.ts — push, per-detection, always defers): aggregate the
STANDING STOCK of fresh signals into founder-facing launch proposals.

Anchored against origin/main `f760debe`. Prod census (Pilae 47dca783, 2026-07-02):
816 companies, 6 ICPs, **0 sequences**, fresh signals = funding_recent×7 cos,
hiring_surge×3, acquisition×2, funding×1 (entries duplicate per company — BTG ×2).

## R1 — Proposal generation (daily cron, per tenant)

- **R1.1** GIVEN a tenant with companies carrying `properties.signals[]` entries,
  WHEN the daily proposals cron runs, THEN it computes one proposal per signal
  FAMILY (canonical type via `SIGNAL_CANONICAL_ALIAS`, signal-outcomes.ts:122)
  that (a) has ≥ MIN_COHORT(2) distinct non-excluded, non-deleted companies with
  a FRESH signal (`isSignalFresh`, lib/signals/freshness.ts), (b) maps to a
  proven template (catalog.ts) via an explicit family→trigger bridge, and
  (c) has >= 1 enrollable contact (EMAIL — the enrollment stack rejects no_email, enrollment-eligibility.ts:71) in the cohort.
- **R1.2** Signal entries MUST be deduped per company (freshest per family) —
  19 funding_recent entries = 7 companies, never "19 accounts".
- **R1.3** Proposals MUST be ranked by `multiplier(family) × cohortSize` using
  `getSignalMultipliers` (prior→learned, INV-7: opens never contribute — they
  are absent from SIGNAL_PRIORS by #609).
- **R1.4** A proposal row MUST carry: family, templateId, title, company ids +
  names sample, companyCount, contactableCount, freshestAt, cohortHash.
- **R1.5** Dedupe: one row per (tenant, family, cohortHash) EVER (mold: #574
  ifn_dedupe_idx). A dismissed family re-proposes ONLY when the cohort changes
  (new company → new hash → new row).
- **R1.6** Reconcile before drafting (mold #574 reconcileStaleNudges): a
  pending row whose recomputed cohortHash differs, or past `expiresAt` (7d),
  flips to `expired`.
- **Edge cases**: tenant with 0 signals → 0 rows, card hidden; signal types
  with no template bridge (acquisition, warm_connection) → skipped, counted in
  cron output, never a broken proposal; company in 2 families → appears in
  both cohorts (different why-now); all contacts suppressed/ineligible →
  contactableCount counts email-holders only (not suppression-checked at propose time — launch rechecks for real).

## R2 — Card on /home

- **R2.1** GIVEN ≥1 `pending_review` proposal, WHEN /home renders, THEN a
  "Proposed by Elevay" card shows above FollowUpsReadyCard, each proposal with:
  plain-language title ("Recent funding — 7 accounts"), the why-now (signal
  family + freshest date), up to 3 company names + "+N more", contactable
  count, template cadence summary ("3 steps · email → LinkedIn → email"), and
  Launch / Dismiss.
- **R2.2** The card self-hides when loading or empty (mold FollowUpsReadyCard).
  UI strings in ENGLISH (product default — #563).
- **R2.3** GIVEN 0 fresh-signal proposals, the card is absent — /home is not
  polluted by an empty shell (INV-5 empty state = absence).
- **R2.4** Dismiss flips the row to `dismissed` (optimistic, versioned 409 on
  concurrent action — mold send/dismiss routes).
- **R2.5** No emoji anywhere (design-language).

## R3 — Launch (0 auto-send, by construction)

- **R3.1** WHEN the founder clicks Launch, THEN the route (a) instantiates the
  bridged template as a DRAFT sequence via `instantiateTemplate`
  (lib/sequences/templates/instantiate.ts:78) if none exists for its
  templateId, (b) creates an account list named after the proposal
  (`createAccountListWithMembers`, account-lists-db.ts:162), (c) enrolls the
  cohort's eligible contacts (same gate stack as enrollAccountListInSequence:
  eligibility + suppression + already-enrolled + guardEnrollment +
  `.onConflictDoNothing()`), (d) flips the proposal to `launched` and returns
  the sequence deep-link.
- **R3.2** NOTHING sends on Launch: the sequence is a DRAFT — the send worker
  only processes active sequences; activation happens in /sequences/[id] after
  the founder reviews the copy. Two human clicks stand between a proposal and
  the first send. All sends then traverse the existing gates (INV-10).
- **R3.3** Launch is versioned (409 on stale version / non-pending status) and
  idempotent-safe: re-instantiation is deduped on campaignConfig->>'templateId',
  list name conflicts get a dated suffix, enrollment inserts are conflict-safe.
- **R3.4** The proposal row is the signal justification (INV-2): family,
  freshestAt, cohort — persisted and shown before any enrollment exists.
- **Edge cases**: cohort went stale between render and Launch (companies
  excluded since) → launch enrolls the still-eligible subset and reports
  {enrolled, skipped}; 0 still-eligible → 409 with reason, row stays pending;
  LinkedIn-only contacts do NOT enroll (platform rule: `no_email` is
  ineligible) — LinkedIn steps still fire for enrolled email-holders.

## Out of scope (flagged)

- Copy generation/personalization at propose time (autopilot arc M13 owns copy
  gates; the draft sequence carries the proven template copy).
- A GIN index on properties.signals (816-company scan is the same cost class
  as signal-score-daily; revisit at 10k+ companies).
- acquisition/warm_connection templates (no proven template yet — add to
  catalog later, the bridge map makes it one line).
- Enrollment-row signal stamping (no metadata column; needs its own migration).

