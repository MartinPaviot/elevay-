# T0 — Saignements arrêtés — Completion report

**Branch merged into main:** `fix/T0-saignements` → fast-forward at `ae68e74`.
**Started from:** `ba9746b` (main)
**Completed at:** 2026-04-13

## Commits

| ID | SHA | Title |
|---|---|---|
| T0.1 | `5c84a04` | fix(onboarding): needsOnboarding now respects completion flag only |
| T0.2 | `7b1a9cb` | fix(onboarding): persist currentStep so the wizard resumes after a reload |
| T0.3 | `85f114b` | fix(home): match the actual wizard challenge labels |
| T0.4 | `d40f33d` | fix(chat): surface approveCard failures instead of swallowing them |
| T0.5 | `49e9626` | fix(accounts): stop silently dropping ids past the server-side bulk cap of 20 |
| T0.6 | `7ec999e` | fix(accounts): drop the misleading "Suggested" badge from expanded contact list |
| T0.7 | `6a70402` | fix(landing): drop the placeholder Twitter link from the footer |
| T0.8 | `ae68e74` | feat(auth): end-to-end password reset flow |

## Verification

- **Typecheck:** `npx tsc --noEmit -p .` → exit 0 (clean, only the pre-existing
  node10 deprecation warning remains).
- **Vitest:** `npx vitest run` → 35 files, 300 tests, **all passing**. No
  regressions introduced; 4 new test files adding 28 new cases:
  - `onboarding-status-api.test.ts` — 7 tests
  - `onboarding-save-api.test.ts` — 5 tests
  - `chunk-bulk.test.ts` — 7 tests
  - `password-reset.test.ts` — 17 tests (generate, hash, create,
    validate live/expired/used/short, invalidate prior, other users
    untouched, password policy including DoS guard + non-string input)
- **Silent catches** (`catch {}`/`.catch(() => {})`): zero bare
  occurrences in `src/` (only a doc comment inside `lib/safe-fetch.ts`).
  T0.4 removed the single remaining one (chat/page.tsx:458).

## Migrations

Two files added under `drizzle/`:

1. `0009_broad_golden_guardian.sql` — new schema migration,
   `password_reset_tokens` table + 3 indexes + FK to `auth_user`.
   Tracked in `drizzle/meta/_journal.json` and auto-applied by
   `drizzle-kit migrate`.
2. `drizzle/manual/0001_fix_challenge_label.sql` — data-only cleanup,
   normalises legacy `primaryChallenge = "Finding the right leads"` →
   `"Finding leads"`. Operator-run; tracked in
   `drizzle/manual/README.md`.

## Risks + debts not addressed in T0

- No Playwright E2E coverage for the new password-reset flow. The pure
  helpers are tested; the round-trip (email received → link clicked →
  password updated → sign-in works) is manual only. Budget a Playwright
  spec in T1 alongside the other BUGFIX E2E gaps called out in
  `_specs/PROD_SETUP.md` §7.
- OAuth-only users who hit `/forgot-password` will receive an email
  and land on the reset page — and the reset CREATES a credentials
  row for them (additive auth method). This is slightly unusual but
  explicitly documented in the reset-password route; see the inline
  comment at `src/app/api/auth/reset-password/route.ts`.
- The in-memory rate limiter in `lib/rate-limit.ts` doesn't survive
  a process restart and isn't shared across serverless instances.
  Good enough to blunt casual abuse but a determined attacker with
  parallel shards could exceed the nominal limits. Upgrade to Redis
  or Vercel KV in a later pass.
- `drizzle/manual/0001_fix_challenge_label.sql` must be applied to
  each environment once. Local dev, staging, and prod need the
  `psql $DATABASE_URL -f …` call. Log updated in
  `drizzle/manual/README.md`.

## PROD_SETUP.md additions pending

Add to `_specs/PROD_SETUP.md` in T1:

- Apply `drizzle/manual/0001_fix_challenge_label.sql` in prod (one-off).
- Verify Resend "From" address on `INVITE_FROM_ADDRESS` — reused for
  the password-reset + password-changed templates.
- Add smoke test row for `/forgot-password` + `/reset-password` flow.

## Next

T1 Phase 1 (foundations) — 13 modules, branches `feat/T1-found-*`.
Priority order is not dependency-ordered in the plan but pagination
(F1) + VirtualTable (F2) unlock the biggest list-page refactors, so
starting there is a reasonable default. Start with:

1. `feat/T1-found-pagination` — F1 server-side pagination hook +
   shared response type.
2. `feat/T1-found-empty-states` — F7 empty-state component (unlocks
   home/meetings/errors content).
3. `feat/T1-found-sentry` — F13 Sentry integration (everything else
   gets observable for free afterwards).
