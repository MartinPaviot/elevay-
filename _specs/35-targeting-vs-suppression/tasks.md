# 35 — Targeting vs Suppression — Tasks

> Kiro-style spec. **Phase 3 of 3: Tasks.** Requirements + Design approved
> (incl. D6 interactive-exempt, D7 reuse `companies:delete`/`settings:write`).
> Branch `feat/35-targeting-suppression`. One logical change per commit; each
> task lists a **verify** step and the **test** to write. `=== GATE ===` markers
> stop for review. Suppression subsystem is under concurrent development —
> re-validate `sending-gate.ts` / `db-store.ts` / migration index at the start of
> every task (design §0).

## Rollout safety (read once)

`safeModeEnabled` defaults **true**, so the moment T7's check-3 ships it would
deny every non-`targeted` automated send. To honour "no change to real outreach
behavior" + "before anything goes live", check-3 is wrapped in an env rollout
guard `TARGETING_GATE_ENABLED` (default **off**). Sequence: ship T1-T12 (guard
off, behavior unchanged) → run T13 backfill → review RECONCILE → flip
`TARGETING_GATE_ENABLED=on` (T14). Suppression checks (T2-T8, spec-22 path) are
**not** behind the guard — they are already live and only get safer.

---

## T0 — Reconcile (audit + plan) `=== GATE: reconciliation ===`

- **Goal**: confirm the current state vs spec 35 ACs before writing code; produce
  `_specs/35-targeting-vs-suppression/RECONCILE.md`.
- **Steps**:
  1. Re-read HEAD of `suppression` table (`outbound.ts:411-429`), `db-store.ts`,
     `sending-gate.ts`, and the migration list — record actual columns, the gate
     insertion point, and the highest migration index.
  2. Confirm whether spec 22 backfills `email_optouts → suppression` (grep callers
     of `addSuppressionDb`; check spec 22's `RECONCILE.md`/`tasks.md`). If it does
     **not**, spec 35 T13 absorbs the unsubscribe/bounce migration.
  3. Inventory legacy must-never-contact data with counts (dev DB): `email_optouts`
     by `reason`, `account_suppressions` by `kind`, `companies` with
     `excludedReason='do_not_contact_request'`, `meeting_opt_outs`.
  4. Lock the new migration indices (next free after HEAD) and the rollout-guard name.
- **Verify**: `RECONCILE.md` committed with the table of counts + the spec-22
  ownership decision + chosen migration indices.
- **Test**: n/a (audit). **DoD**: gate reviewed; numbers are real, not estimated.

---

## T1 — Schema: `targeting_status` enum + column

- **Goal**: reversible targeting state on accounts (R1.1).
- **Files**: `db/schema/enums.ts` (`targetingStatusEnum`, lowercase values),
  `db/schema/core.ts:77-129` (`companies.targetingStatus` default `unreviewed` +
  `companies_targeting_status_idx`), new migration `00NN_targeting_status.sql`
  (guarded `CREATE TYPE` + `ADD COLUMN` + index), drizzle-zod validator.
- **Verify**: `pnpm tsc`; apply migration on dev (`db:migrate:apply`), re-run →
  no-op; new company defaults `unreviewed`.
- **Test**: migration idempotency + default value (`db:push` then insert → assert
  `targeting_status='unreviewed'`).

## T2 — Schema: extend `suppression`

- **Goal**: status/source/actor/deactivation columns + `account` level +
  `complaint` type vocabulary (R3.3, R4.2, R3.2).
- **Files**: `db/schema/outbound.ts:411-429` (5 new cols), migration
  `00NN_suppression_status_source.sql` (`ADD COLUMN IF NOT EXISTS` ×5 +
  `suppression_status_idx`). `level`/`type` are text — no enum change.
- **Verify**: migration additive + idempotent; existing spec-22 rows read back
  with `status='active'` (column default backfills).
- **Test**: schema test — pre-existing row gets `active`; insert with
  `level='account'` / `type='complaint'` succeeds.

## T3 — Pure suppression logic

- **Goal**: account scope + status-aware liveness in the tested pure module.
- **Files**: `lib/suppression/suppression.ts` — `SuppressionTarget.accountKey`;
  push `["account", accountKey]` candidate (`:187-189`); add `"complaint"` to
  `SuppressionType` (`:12-17`); `liveAt` (`:166-171`) treats `status!=='active'`
  as not live. Export updates in `index.ts`.
- **Verify**: `pnpm test suppression`.
- **Test**: unit — account-level hit; inactive entry not live; complaint type
  round-trips; existing address/domain tests still green (regression).

## T4 — DB store: account loader, deactivation, audited writes, consent helpers

- **Goal**: persistence for the new capabilities (R3.4, R4.2, R6.5).
- **Files**: `lib/suppression/db-store.ts` — `accountKey` branch in
  `drizzleSuppressionLoader` (`:64-85`); `addSuppressionDb` writes
  `source`/`created_by`/`status` + calls `logAudit`; `deactivateSuppressionDb`
  (status→inactive + `deactivated_at/by` + audit; refuses opt_out/complaint
  pre-trigger); `isConsentSuppressed`/`filterConsentSuppressed` (read-only,
  fail-closed, reuse `suppressedDb`).
- **Verify**: `pnpm test` for the suppression dir.
- **Test**: injected-loader unit — account match; `deactivateSuppressionDb` flips
  deactivatable, throws/refuses on opt_out; `filterConsentSuppressed` performs
  zero writes (assert no insert/update spy).

## T5 — SAFE_MODE setting

- **Goal**: `safeModeEnabled` default-ON, fail-closed (R2.1, R2.4).
- **Files**: `lib/config/tenant-settings.ts` — add to `TenantSettings` +
  `DEFAULTS = true`.
- **Verify**: `getTenantSettings` returns `safeModeEnabled:true` for a tenant with
  no override.
- **Test**: unit — default true; explicit false honoured; `?? true` on null.

## T6 — Targeting status library (load + dual-write)

- **Goal**: `loadTargetingStatus` (fail-closed → `unreviewed` on miss) + dual-write
  helper keeping `targeting_status` ⇄ `excludedReason`/`deletedAt` in lockstep (D5).
- **Files**: new `lib/targeting/status.ts`; wire dual-write into
  `accounts/exclude/route.ts`, `accounts/batch/route.ts`,
  `accounts/restore/route.ts`, `lib/accounts/suppression.ts`.
- **Verify**: exclude → `archived`+`excludedReason`; restore → `targeted`+null
  `deletedAt`; partial unique index on `deleted_at IS NULL` (`core.ts:116-118`)
  still valid.
- **Test**: unit — `loadTargetingStatus` unresolved → `unreviewed`; lockstep
  transitions; idempotent re-apply.

## T7 — Gate: targeting + SAFE_MODE check + account-scope suppression

- **Goal**: the new check-3 and ACCOUNT-scope wiring inside `evaluateSend` (R5).
- **Files**: `lib/guardrails/sending-gate.ts:95-196` — extend `EvaluateSendArgs`
  (`contactId?/companyId?/targetingStatus?/interactive?`); move settings read
  above check-3; add check-3 guarded by `TARGETING_GATE_ENABLED` (default off) +
  `safeModeEnabled ?? true` + `!interactive`; resolve `accountKey`
  (companyId→identityKey, else contactId→companyId); pass `accountKey` to the
  loader; add `"not_targeted"` to `SendingGateOutcome.code` (`:43`).
- **Verify**: `pnpm test sending-gate`; with guard **off**, behavior identical to
  today (regression).
- **Test**: targeted passes; unreviewed/archived denied (`not_targeted`) only when
  guard on; interactive exempt; suppression beats targeting; account-scope hit
  denies; thrown lookup → `send:false`; guard-off = no-op.

## T8 — Thread recipient context at the 5 chokepoints

- **Goal**: give the gate `contactId`/`companyId`/`interactive` (design §3.1, recon).
- **Files**: `inngest/email-send-worker.ts` (C1 ~374, C5 ~674 — pass
  `email.contactId`, batch-resolve companyId/targetingStatus),
  `inngest/outbound-smtp-send.ts` (C3 ~86 — `o.contactId`, `mb.domain`),
  `lib/emails/deliver-interactive.ts` (C2 ~179 — `input.contactId`,
  `interactive:true`), `api/meetings/[id]/notes/send-follow-up/route.ts`
  (C4 ~131 — `interactive:true`).
- **Verify**: each call site compiles; crons resolve companyId once per batch (no
  per-row lookup); existing gate tests green.
- **Test**: per-chokepoint — context passed; interactive flag set on C2/C4;
  cron batch resolves account status without N+1.

## T9 — Permanence enforcement (DB trigger) `=== GATE: first-trigger review ===`

- **Goal**: opt_out/complaint undeletable by any actor (R4.1/R4.3).
- **Files**: migration `00NN_suppression_permanence.sql` (function + BEFORE
  DELETE/UPDATE trigger, frozen set `opt_out`+`complaint`); RUNBOOK note for
  owner-level maintenance (DSAR erase only adds, never deletes).
- **Verify**: apply on dev; raw `DELETE`/weakening `UPDATE` on a seeded opt_out
  row raises `P0001`; reason/created_at edits still allowed.
- **Test**: SQL-level (real Postgres in CI) — delete/weaken blocked, benign update
  allowed; `addSuppressionDb` re-ingest of an opt_out does not trip the trigger.

## T10 — Re-application on restore / import / TAM

- **Goal**: never resurrect a suppressed identity; never clear suppression (R6).
- **Files**: insert sites — `lib/tam-stream/per-company.ts`,
  `db/canonical/upsert.ts` (new-record branch), `api/import/route.ts`,
  `api/import/smart/commit/route.ts`, apollo import script,
  `api/accounts/restore/route.ts:60-71` (re-check, don't clear).
- **Verify**: a candidate matching a consent suppression is skipped/flagged at
  each path; restore re-checks; `account_suppressions` `liftSuppression` untouched.
- **Test**: integration — opted-out email re-imported stays suppressed (E6);
  restore of an account with a suppressed contact does not make it contactable (E5).

## T11 — Account-page UI

- **Goal**: targeting controls + read-only badge + manual DNC + admin deactivate (R7).
- **Files**: `app/(dashboard)/accounts/...` detail components (replace
  exclude/archive toggles, `accounts/page.tsx:265-270`); badge, history drawer
  (queries `activities` entityType=`suppression`).
- **Verify**: live UI — badge shows type/scope/date/source; opt_out/complaint have
  no action; manual DNC requires a reason; deactivate hidden for non-admins. No
  emoji (memory `feedback_no-emoji-in-ui`).
- **Test**: RTL/Playwright — badge read-only for opt_out; manual DNC writes a
  `manual_dnc`; deactivate gated; targeting control flips `targeting_status`.

## T12 — API routes (manual DNC add + admin deactivate)

- **Goal**: server endpoints for R7.5/R7.6 (D7 permissions).
- **Files**: new routes mirroring `accounts/exclude/route.ts`; add gated
  `companies:delete` (member+), deactivate gated `settings:write` (admin);
  `logAudit` on both; reject opt_out/complaint deactivation → 409 (catch P0001).
- **Verify**: member can add DNC, cannot deactivate (403); admin can deactivate;
  opt_out deactivate → 409.
- **Test**: route tests — permission matrix; 409 on permanent; audit row written.

## T13 — T0 data migration (backfill) `=== GATE: pre-go-live ===`

- **Goal**: migrate legacy state so SAFE_MODE-on preserves behavior (R8).
- **Files**: `scripts/backfill-targeting-and-dnc.ts` (idempotent).
- **Steps**: contactable (not excluded, not deleted) → `targeting_status='targeted'`;
  excluded/deleted → `archived`; `excludedReason='do_not_contact_request'` (+ DNC
  `account_suppressions`) → `suppression` `level='account'`, `value=identityKey`,
  `type='manual_dnc'`, `source='migration'`; `meeting_opt_outs` → `opt_out`
  address (only if spec 22 doesn't, per T0); `email_optouts` → suppression (only
  if spec 22 doesn't). Emit counts.
- **Verify**: run on dev; re-run → no-op; the set of recipients allowed before ==
  after (minus migrated suppressions) — regression query.
- **Test**: idempotency; backfill correctness on a seeded fixture; behavior-parity
  assertion.

## T14 — Enable + evaluate `=== GATE: checkpoint ===`

- **Goal**: flip `TARGETING_GATE_ENABLED=on` after backfill; full acceptance.
- **Steps**: confirm T13 + RECONCILE reviewed → enable guard on dev → run hostile
  eval against R1-R9 + E1-E12 (requirements §3) on the live app.
- **Verify**: `pnpm tsc && pnpm lint && pnpm test && pnpm eval:run`; Playwright
  the acceptance criteria literally; no regression on existing send paths.
- **Test**: the E1-E12 suite green; acceptance (requirements §7) satisfied.
  **DoD**: PASS → merge to main; prod enablement ops-gated (no prod migration
  from an unmerged branch).

---

## Dependency order

`T0 → T1,T2 (parallel) → T3 → T4 → T5,T6 (parallel) → T7 → T8 → T9 → T10 →
T11,T12 (parallel) → T13 → T14`. T1-T12 are shippable with the guard off
(behavior unchanged). Suppression-path tests (T3,T4,T7,T9,T10) gate correctness;
T13 gates go-live; T14 is the checkpoint.

## Traceability

T1→R1; T5,T7→R2; T2,T3,T4→R3; T4,T9,T12→R4; T7,T8→R5; T10→R6; T11,T12→R7;
T0,T13→R8; T6,T9,T12→R9. Edge cases E1-E12 covered across T3/T7/T9/T10/T13/T14.
