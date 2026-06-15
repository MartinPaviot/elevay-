# Call Lists — Tasks

Ordered. Each task has a verify step + the test to write. Tasks assume the
recommended model **A2a + A4** (D0); T0 gates that. Tests run with
`regression.sh`. No commit until acceptance criteria + regression pass (CLAUDE.md
Phase 5). Branch `feat/call-lists`.

## T0 — Confirm D0 (blocking, no code)
- Confirm with Martin: model A2a (one global objective + named lists) vs A2b
  (one campaign per list); storage `call_lists` table vs `targetFilter.lists[]`.
- Verify: a one-line decision recorded at the top of design.md.
- Test: none (decision gate).

## T1 — Generalise the audience builder (pure, no UI)
- Extend `sprintAudienceConditions` (`call-sprint.ts:47`) from {industries,
  personas} to the full `Segment` shape (R4.1–R4.15), each as a stored-column
  condition AND-combined; keep the literal-qualified-name + `sql.join` discipline
  (the silent-zero + tuple footguns called out lines 47-51).
- Extend `countSprintAudience` (`call-sprint.ts:277`) to the same conditions so
  counts == what gets listed.
- Verify: run `scripts/_verify-call-sprint.ts` (the live SQL harness) against a
  segment using each new parameter; counts match a hand SQL.
- Test: unit test per parameter (industry, persona, seniority, signal, stage,
  dealValueMin, geo, size, tech, source, owner, freshness, fitMin, phoneType) +
  a combined-AND case + an empty-segment case (returns no extra conditions).

## T2 — `call_lists` table + repository
- Migration: create `call_lists` (design data model) with the partial index;
  reuse the `prev_*` reversibility convention if needed.
- Repo helpers: list/create/update/delete scoped by (tenantId, campaignId,
  ownerId) via `withTenantTx`.
- Verify: migrate locally; insert/read a row through the repo under RLS.
- Test: repo CRUD + tenant-isolation test (other tenant can't read the row).

## T3 — List APIs
- `GET /api/calls/lists` (system derived + sector from table, each with counts).
- `POST /api/calls/lists` (phrase→`resolveSprintAudience` extended, or explicit
  segment→`validateSprintLabels` extended).
- `PATCH`/`DELETE /api/calls/lists/[id]`; DELETE clears `audience` if active.
- `POST /api/calls/lists/[id]/activate` (writes `targetFilter.audience` via
  `updateCallCampaign` + `generateDailyCallList`, returns queue).
- Verify: drive each route with `curl`/`tsx`; activate → `targetFilter.audience`
  updated + today's list regenerated.
- Test: route tests (auth required, validation rejects unknown labels verbatim,
  activate regenerates, delete-active falls back).

## T4 — System "by-day" lists (derived)
- Add derived projections "Today" / "Callbacks due" (`status='queued'` AND
  `nextAttemptAt<=now`) / "New to call" (`attemptCount=0`) over
  `getTodaysCallList` output (or a sibling query). Counts via the same conditions.
- Verify: seed targets in mixed states; counts match.
- Test: unit test the projection from a fixture set of targets (NRP from
  yesterday lands in "Callbacks due"; fresh in "New").

## T5 — Selector UI in "To call now"
- Replace the static header (`page.tsx:981`) with a list selector (system then
  sector, with counts). Selecting filters/sorts the queue; persist last choice
  (localStorage, `FROM_NUMBER_STORAGE_KEY` pattern `page.tsx:109`); default
  "Today". Fold sprint editing in (R3.5); keep the chat path working.
- Collapse while in-call (R3.6). No emoji; lucide icons; counts honest.
- Verify (Playwright, turbopack rig): create a sector list, switch lists, reload
  → choice sticks; in-call → selector collapsed.
- Test: component test for selector render + empty state (no sector lists).

## T6 — Sort options per list
- Implement the R5 sort keys (fit default, intent, accessibility, deal value,
  oldest-callback, fewest-attempts, local-time window); composite stays the
  "smart default". Deterministic ordering.
- Verify: switch sort on a list → order changes as expected.
- Test: unit test each sort key over a fixture, including local-time window.

## T7 — Dead-number auto-detection (the one new server capability)
- In `dial-status` (`dial-status/route.ts`), read `CallStatus` ∈ {failed, busy,
  no-answer, canceled} + `ErrorCode`/`SipResponseCode`; classify explicit
  unallocated/unobtainable → dead (terminal), else NRP. Feed
  `recordCallOutcomeForCampaigns` with `invalid_number` (terminal via
  `exhausted`) vs a retry outcome. Surface the removal honestly (R6.6).
- CONFIRM exact Twilio codes via Context7/Twilio docs first (R6.7) — do not
  hardcode guesses.
- Verify: post a simulated `dial-status` with a dead code → target terminal,
  contact absent next day; post `no-answer` no-code → NRP, returns.
- Test: webhook test for both branches + the uncertain→NRP default (R8.4).

## T8 — Empty-list affordance
- Zero-callable sector list → honest empty state with counts + "enrich this
  audience" action calling `listSprintContactsMissingPhone` (`call-sprint.ts:244`).
- Verify: define an all-without-phone segment → empty state + enrich offer.
- Test: component test for the empty state branch.

## T9 — Regression + comparison + docs
- Run `regression.sh`; confirm gates unchanged on every list (R7.1) and the
  in-cadence-retry invariant (R0.2) holds when switching lists.
- Compare against the Monaco/teardown call-list screenshots if any; fix obvious
  gaps.
- Update product-spec + this spec if reality drifted; note A2b + learned-sort +
  per-list-quota as [SEAM]s.
- Verify: full regression green; Playwright walkthrough of Evaluation steps 1–9
  (requirements.md).
- Test: the evaluation-steps walkthrough encoded where automatable.
