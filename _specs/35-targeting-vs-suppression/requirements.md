# 35 — Targeting vs Suppression (Account page)

> Kiro-style spec. **Phase 1 of 3: Requirements.** Design and Tasks follow
> only after explicit approval of this section. Brownfield: T0 is reconciliation
> (R8). This is a hot-path safety feature — correctness beats cleverness.
> Specs and code in English.

## 1. Problem

Today "removing a lead from a list" conflates two concerns that have opposite
lifecycles:

- A **reversible business choice** (do we *want* to contact this account right
  now?) — implemented as `companies.excludedReason` / `excludedAt`
  (`app/apps/web/src/db/schema/core.ts:77-78`) and soft-delete `deletedAt`
  (`core.ts:107`), surfaced as two mutually-exclusive view toggles on the
  Accounts page (`app/apps/web/src/app/(dashboard)/accounts/page.tsx:265-270`).
  `POST /api/accounts/exclude` even mirrors the choice into a *reversible*
  ledger (`app/apps/web/src/app/api/accounts/exclude/route.ts:114-131`;
  `liftSuppression` deletes it, `lib/accounts/suppression.ts:168-179`).
- An **irreversible constraint** (we must *never* contact this person) — today
  scattered across `email_optouts` (address-only, `db/schema/outbound.ts:389-401`),
  `meeting_opt_outs` (`outbound.ts:403-417`), the voice `do_not_call_list`
  (`db/schema/voice.ts:146-160`), and an unpersisted in-memory module
  (`lib/suppression/suppression.ts:12-36`).

Because exclusion ("not a fit") writes the same `account_suppressions` ledger as
real removal, and because consent opt-outs live in a different, weaker store than
the business state, the two concerns leak into each other. This spec separates
them with hard guarantees.

**Definitions used below.**

| Term | Meaning |
|---|---|
| **Account** | a `companies` row — the entity was never renamed to `accounts` (`core.ts:53`). |
| **targeting_status** | new reversible enum on accounts: `UNREVIEWED` \| `TARGETED` \| `ARCHIVED`. Moves with the ICP. |
| **Suppression entry** | a row in the new global store: `(scope, value, reason, status, source, actor, timestamps)`. |
| **scope** | `EMAIL` (normalized address) \| `DOMAIN` (bare domain) \| `ACCOUNT` (company identity). |
| **reason** | `OPT_OUT` \| `COMPLAINT` (permanent) · `ALREADY_CUSTOMER` \| `MANUAL_DNC` (admin-deactivatable) · `HARD_BOUNCE` (system cool-off — see D2). |
| **active suppression** | `status = active` and not past any cool-off expiry. |
| **SAFE_MODE** | workspace flag, default **ON**; while ON only `TARGETED` accounts are eligible (default-deny). |
| **eligible(contact)** | `account.targeting_status == TARGETED` **AND** no active suppression matches the contact's email, its email domain, or its account. |

EARS keywords: **THE SYSTEM SHALL** (ubiquitous), **WHEN … THE SYSTEM SHALL**
(event), **WHILE … THE SYSTEM SHALL** (state), **IF … THEN THE SYSTEM SHALL**
(unwanted), **WHERE … THE SYSTEM SHALL** (optional/feature-gated).

---

## 2. Requirements (EARS)

### R1 — Targeting status (reversible)

- **R1.1** THE SYSTEM SHALL store a reversible `targeting_status` on every
  account with exactly one of `{UNREVIEWED, TARGETED, ARCHIVED}`, defaulting to
  `UNREVIEWED` for newly created accounts.
- **R1.2** WHEN a user targets an account, THE SYSTEM SHALL set
  `targeting_status = TARGETED` and SHALL NOT write any suppression entry.
- **R1.3** WHEN a user archives an account, THE SYSTEM SHALL set
  `targeting_status = ARCHIVED` and SHALL NOT write any suppression entry
  (archive is a targeting choice, not a consent constraint).
- **R1.4** WHEN a user re-targets a previously archived account, THE SYSTEM SHALL
  set `targeting_status = TARGETED` and SHALL leave every existing suppression
  entry unchanged.
- **R1.5** THE SYSTEM SHALL treat `targeting_status` transitions as fully
  reversible and idempotent; re-applying the current status SHALL be a no-op.
- **R1.6** WHERE the existing exclude/include (`accounts/exclude/route.ts`),
  soft-delete (`accounts/batch/route.ts:56-68`) and restore
  (`accounts/restore/route.ts:60-71`) actions are retained, THE SYSTEM SHALL map
  them onto `targeting_status` (exclude/delete → `ARCHIVED`, include/restore →
  `TARGETED`) and SHALL NOT write consent suppression as a side effect.

### R2 — SAFE_MODE default-deny

- **R2.1** THE SYSTEM SHALL provide a workspace-level `SAFE_MODE` flag that
  defaults to **ON** (today only `OUTBOUND_TEST_MODE` exists,
  `lib/emails/recipient-guardrail.ts:32-35`; `SAFE_MODE` is net-new).
- **R2.2** WHILE `SAFE_MODE` is ON, THE SYSTEM SHALL treat only accounts with
  `targeting_status == TARGETED` as targeting-eligible; `UNREVIEWED` and
  `ARCHIVED` accounts SHALL be ineligible (default-deny).
- **R2.3** WHILE `SAFE_MODE` is OFF, THE SYSTEM SHALL treat `UNREVIEWED` and
  `TARGETED` as eligible and `ARCHIVED` as ineligible (see **D4**).
- **R2.4** IF the `SAFE_MODE` flag cannot be resolved at send time, THEN THE
  SYSTEM SHALL behave as if `SAFE_MODE` is ON (fail-closed, consistent with
  `lib/guardrails/sending-gate.ts:170-176`).
- **R2.5** THE SYSTEM SHALL preserve current outreach behavior on rollout: with
  `SAFE_MODE` ON, eligibility depends on accounts being `TARGETED`, therefore the
  T0 backfill (R8.6) SHALL set `targeting_status = TARGETED` for accounts that
  are contactable today, so no currently-allowed send becomes newly blocked
  except by a migrated suppression.

### R3 — Global, append-only suppression store

- **R3.1** THE SYSTEM SHALL maintain a single workspace-global suppression store,
  separate from per-list/per-campaign membership and from `targeting_status`.
- **R3.2** THE SYSTEM SHALL support suppression entries at three scopes: `EMAIL`,
  `DOMAIN`, `ACCOUNT`.
- **R3.3** THE SYSTEM SHALL record for every entry: `scope`, normalized `value`,
  `reason`, `status`, `source` (e.g. unsubscribe-link, resend-webhook,
  reply-classifier, dsar, manual-ui, migration), `created_at`, `created_by`, and
  — where applicable — `deactivated_at` / `deactivated_by`.
- **R3.4** THE SYSTEM SHALL be append-only: WHEN a suppression is added that
  duplicates an existing `(scope, value)`, THE SYSTEM SHALL record the event
  idempotently without deleting prior history — explicitly NOT the destructive
  delete-then-insert used by the sourcing ledger
  (`lib/accounts/suppression.ts:127-131`).
- **R3.5** THE SYSTEM SHALL normalize before storing and matching: lowercase/trim
  email, strip scheme/`www`/path for domain, and resolve an account to its
  canonical `identity_key` (`core.ts:104`; identity rules in
  `_specs/00-canonical-data-model`). It SHALL reuse the existing normalizers
  where present (`suppression.ts:30-62`).
- **R3.6** THE SYSTEM SHALL accept ingestion from existing feeders without
  changing their callers' contracts: unsubscribe one-click
  (`api/unsubscribe/route.ts:117-122,219-226`), Resend/EmailEngine bounce +
  complaint webhooks (`api/webhooks/resend/route.ts:138-192`), the
  reply-classifier opt-out (spec 26), and DSAR erase (spec 34).

### R4 — Permanence & admin deactivation

- **R4.1** THE SYSTEM SHALL treat `OPT_OUT` and `COMPLAINT` entries as permanent:
  there SHALL be no code path and no UI control that deletes or deactivates them.
- **R4.2** THE SYSTEM SHALL allow an admin to deactivate `ALREADY_CUSTOMER` and
  `MANUAL_DNC` entries; WHEN deactivated, THE SYSTEM SHALL set `status = inactive`
  and retain the full entry, actor, and timestamp (history kept).
- **R4.3** IF any actor (user, admin, API, migration) attempts to delete or
  deactivate an `OPT_OUT` or `COMPLAINT` entry, THEN THE SYSTEM SHALL reject the
  operation and record the attempt in the audit log.
- **R4.4** WHEN evaluating eligibility, THE SYSTEM SHALL count an entry as active
  only while `status = active` and not past any cool-off expiry.
- **R4.5** WHERE `HARD_BOUNCE` entries are stored, THE SYSTEM SHALL manage them as
  system-owned deliverability suppressions with a configurable cool-off (see
  **D2**), distinct from consent reasons and not subject to R4.1/R4.2.

### R5 — Send-time eligibility gate

- **R5.1** THE SYSTEM SHALL compute send-time eligibility as:
  `account.targeting_status == TARGETED` AND no active suppression matches the
  contact's email (`EMAIL`), its email domain (`DOMAIN`), or its account
  (`ACCOUNT`).
- **R5.2** THE SYSTEM SHALL evaluate eligibility **live** against the global store
  at send time, never against a per-list/per-campaign snapshot taken at
  enrollment (already true for opt-outs:
  `inngest/email-send-worker.ts:160-193`).
- **R5.3** WHEN any of the five send chokepoints (C1 campaign cron, C2
  single-send, C3 SMTP cron, C4 interactive composer, C5 meeting follow-up)
  attempts a send, THE SYSTEM SHALL run the eligibility check inside the shared
  `evaluateSend` gate before transport (`lib/guardrails/sending-gate.ts:1-20,
  125-177`).
- **R5.4** IF a contact is suppressed at any scope, THEN THE SYSTEM SHALL deny the
  send with a distinct reason code and SHALL NOT dispatch, regardless of
  `targeting_status` or campaign state (suppression overrides targeting).
- **R5.5** IF `targeting_status != TARGETED` while `SAFE_MODE` is ON, THEN THE
  SYSTEM SHALL deny the send with a targeting-ineligible reason code.
- **R5.6** IF the suppression or targeting lookup throws, THEN THE SYSTEM SHALL
  fail closed (deny), consistent with `sending-gate.ts:170-176`.
- **R5.7** THE SYSTEM SHALL apply the same eligibility semantics at enrollment
  (`lib/sequences/enrollment-eligibility.ts:41-53`) so a suppressed or
  non-targeted contact cannot be enrolled; the enrollment check SHALL NOT replace
  the live send-time check (R5.2).
- **R5.8** WHERE voice calls are dispatched (`api/calls/start/route.ts:50-140`,
  which today bypasses `evaluateSend`), THE SYSTEM SHALL also enforce
  `ACCOUNT`-scope targeting + suppression (see **D3**).

### R6 — Re-application across archive reopen / re-import / TAM rebuild

- **R6.1** WHEN an account is restored from archive, THE SYSTEM SHALL set
  `targeting_status` and SHALL NOT clear any suppression entry — unlike today,
  where restore lifts the `'deleted'` ledger row (`accounts/restore/route.ts:68`).
- **R6.2** WHEN a new account or contact is created via any sourcing/import/TAM
  path (`lib/tam-stream/per-company.ts:175-199`, `api/tam/route.ts:279-310`,
  `api/import/smart/commit/route.ts:120-129`, `api/import/route.ts:123-130`,
  `db/canonical/upsert.ts:140-151`, `scripts/apply-apollo-import.ts`), THE SYSTEM
  SHALL match it against the global store by identifier and SHALL honor any active
  suppression — never producing a contactable state for a suppressed identity.
- **R6.3** WHEN the TAM is rebuilt, THE SYSTEM SHALL preserve all suppression
  entries and re-apply them by identifier match to the rebuilt set; THE SYSTEM
  SHALL NOT delete or deactivate any suppression as part of a rebuild.
- **R6.4** IF a re-imported identity matches a permanent suppression, THEN THE
  SYSTEM SHALL keep it suppressed even when its account is set `TARGETED`.
- **R6.5** THE SYSTEM SHALL match suppressions to candidates using canonical
  identity (identity_key, domain, normalized email) so domain-less and re-keyed
  records are still caught — the send-path/consent analogue of the sourcing
  `filterAllowed` (`suppression.ts:186-230`), which today is called by no
  import/build flow.

### R7 — Account page UI

- **R7.1** THE SYSTEM SHALL surface targeting controls on the Account page that
  set `targeting_status` (Target / Archive / re-target), replacing the current
  exclude/delete view-toggle semantics (`accounts/page.tsx:265-270,2175-2195`).
- **R7.2** WHERE an account or any of its contacts has an active suppression, THE
  SYSTEM SHALL display a **read-only** suppression badge showing reason, scope,
  date, and source.
- **R7.3** THE SYSTEM SHALL NOT render any control that deletes or deactivates an
  `OPT_OUT` or `COMPLAINT` suppression (badge is read-only).
- **R7.4** WHILE an account is permanently suppressed at `ACCOUNT` scope (or all
  its contacts are suppressed), THE SYSTEM SHALL hide or disable targeting actions
  that imply the account is contactable, and SHALL make explicit that suppression
  overrides targeting.
- **R7.5** THE SYSTEM SHALL provide a manual "Do not contact" action that creates
  a `MANUAL_DNC` suppression at a chosen scope (`EMAIL`/`DOMAIN`/`ACCOUNT`) with a
  required reason note and the actor recorded — promoting today's free-form
  `do_not_contact_request` exclude tag (`accounts/exclude/route.ts:33`) to a real
  suppression.
- **R7.6** WHERE an admin views a deactivatable suppression
  (`ALREADY_CUSTOMER`/`MANUAL_DNC`), THE SYSTEM SHALL expose a deactivate action
  (R4.2) gated by admin permission; non-admins SHALL see the badge read-only.

### R8 — Brownfield T0 reconciliation (gate before go-live)

- **R8.1** Before the new eligibility gate is enabled in any environment, THE
  SYSTEM SHALL run a reconciliation migration that populates the global store from
  every existing must-never-contact source and SHALL emit a `RECONCILE.md` with
  per-source counts. `=== GATE: reconciliation ===`
- **R8.2** THE SYSTEM SHALL migrate `email_optouts` (`outbound.ts:389-401`):
  `unsubscribe` → `EMAIL`/`OPT_OUT` (permanent); `complaint` → `EMAIL`/`COMPLAINT`
  (permanent); `bounce_hard` → `EMAIL`/`HARD_BOUNCE` (cool-off, D2); `manual` →
  `EMAIL`/`MANUAL_DNC` (deactivatable).
- **R8.3** THE SYSTEM SHALL migrate `meeting_opt_outs` attendee emails
  (`outbound.ts:403-417`) → `EMAIL`/`OPT_OUT` (permanent).
- **R8.4** THE SYSTEM SHALL NOT migrate `account_suppressions` `kind='excluded'`
  or `kind='deleted'` (`core.ts:140-175`) into consent suppression; instead it
  SHALL map those accounts to `targeting_status = ARCHIVED` (reversible).
- **R8.5** WHERE an `account_suppressions` row or a `companies.excludedReason`
  value denotes an explicit do-not-contact request (e.g. value
  `do_not_contact_request`), THE SYSTEM SHALL migrate that specific entry to an
  `ACCOUNT`/`MANUAL_DNC` suppression (deactivatable), not merely `ARCHIVED`.
- **R8.6** THE SYSTEM SHALL backfill `targeting_status` so SAFE_MODE-ON preserves
  behavior: contactable today (not excluded, not soft-deleted) → `TARGETED`;
  excluded or soft-deleted → `ARCHIVED`.
- **R8.7** WHERE voice DNC (`do_not_call_list`, `voice.ts:146-160`) is in scope,
  THE SYSTEM SHALL migrate it under a `PHONE` scope; the v1 recommendation is to
  keep voice DNC separate (see **D3**).
- **R8.8** THE SYSTEM SHALL make T0 idempotent and re-runnable, applied on the dev
  DB via the custom runner (`db:migrate:apply` / `db:push`; `db:migrate` is
  disabled at journal idx 12). Next migration index is **0089** (highest present:
  `drizzle/0088_segments.sql`). Prod application is ops-gated — no auto-migrate of
  prod from an unmerged branch.
- **R8.9** THE SYSTEM SHALL NOT enable the live eligibility gate until T0 has
  completed and `RECONCILE.md` is reviewed. `=== GATE ===`

### R9 — Isolation, audit, non-regression

- **R9.1** THE SYSTEM SHALL scope every suppression read/write by tenant; a
  lookup with no tenant predicate SHALL be a programming error (see **D1** for the
  meaning of "global").
- **R9.2** THE SYSTEM SHALL write an audit-log entry for every suppression add,
  every deactivation, and every `targeting_status` change, reusing `logAudit`
  (`accounts/exclude/route.ts:134`, `accounts/restore/route.ts:73`).
- **R9.3** THE SYSTEM SHALL be additive: it SHALL NOT remove or rewrite the
  existing send pipeline, the existing opt-out lookup (`sending-gate.ts:74-89`),
  or the exclude/restore routes; the new gate composes into `evaluateSend`.
- **R9.4** THE SYSTEM SHALL preserve all currently-passing send behavior: with
  `SAFE_MODE` ON and T0 applied, the set of recipients allowed today SHALL remain
  allowed, minus those newly captured by migrated suppressions (R5.4 wins).

---

## 3. Edge cases (GIVEN / WHEN / THEN)

| # | GIVEN | WHEN | THEN |
|---|---|---|---|
| E1 | account `TARGETED`, contact has no email | send attempted | deny `no_email` (unchanged, `enrollment-eligibility.ts:45`) |
| E2 | contact email suppressed, account `TARGETED`, domain clean | send to a *different* clean contact at same account | allowed (EMAIL scope is per-address) |
| E3 | domain suppressed | send to any address on that domain | deny (DOMAIN scope) |
| E4 | account suppressed (ACCOUNT scope) | send to any contact at the account | deny even if individual emails are clean |
| E5 | account `ARCHIVED` with a contact `OPT_OUT` | account re-targeted to `TARGETED` | opted-out contact stays suppressed; not resurrected |
| E6 | email previously `OPT_OUT` | re-imported under a new contact/account row | still suppressed (identity match on email) |
| E7 | active sequence running | suppression added mid-sequence | next send denied live (no snapshot, R5.2) |
| E8 | suppressions exist | `SAFE_MODE` toggled OFF→ON | no suppression state changes; only targeting default-deny changes |
| E9 | duplicate opt-out webhook fires twice | second insert | one active entry; append-only history (R3.4); idempotent |
| E10 | `MANUAL_DNC` deactivated by admin | next send | eligible only if account `TARGETED` and no other active suppression |
| E11 | API call tries to deactivate an `OPT_OUT` | request processed | rejected + audited (R4.3) |
| E12 | DSAR erase (spec 34) | erased identity reappears from a provider | re-suppressed permanently, not re-contacted (R6.4) |

---

## 4. Out of scope

- Opt-out **detection** from replies (spec 26) and bounce **detection** (spec
  27) — this feature only **stores and enforces** (mirrors spec 22 out-of-scope).
- Per-list / per-campaign membership model changes.
- Lawful-basis gating (spec 33) — an independent gate; this feature only *honors*
  suppression so 33 can rely on it.
- Cross-tenant platform-global complaint sharing (unless **D1** decides it in).
- Wiring the gate into the Instantly/HeyReach adapters (specs 23/24) beyond the
  shared `evaluateSend` path; the gate is channel-agnostic by design.

---

## 5. Open decisions (recommendation + trade-off)

- **D1 — Meaning of "global".** Recommend: workspace-global, **tenant-scoped**
  (one store across all lists/campaigns/ICP versions; not cross-tenant).
  Trade-off: a platform-global `COMPLAINT` layer would protect deliverability
  across tenants but risks silencing legitimately distinct relationships and
  complicates RLS (the documented tenantId-leak regression). Defer cross-tenant
  to a later flag.
- **D2 — Bounce permanence.** Recommend: `HARD_BOUNCE` = system-managed,
  configurable cool-off (default: suppressed until the address is re-verified),
  kept out of the consent permanence rule. Trade-off: permanent-forever is safest
  for deliverability but discards recoverable addresses; cool-off recovers them at
  a re-verification cost. (Spec 22 left this open.)
- **D3 — Voice in v1?** Recommend: defer — keep `do_not_call_list` separate
  (phone scope) for v1 and wire `ACCOUNT`-scope suppression into
  `calls/start/route.ts` as a fast follow. Trade-off: until then, an `ACCOUNT`
  `MANUAL_DNC` blocks email but not a call.
- **D4 — SAFE_MODE OFF semantics (R2.3).** Recommend: OFF = legacy behavior,
  only `ARCHIVED` excluded (UNREVIEWED allowed). Confirm.
- **D5 — Replace vs coexist with `excludedReason`/`deletedAt`.** Recommend:
  `targeting_status` becomes source of truth, but keep `excludedReason`/`deletedAt`
  dual-written during a transition window — the canonical identity unique index is
  partial on `deleted_at IS NULL` (`core.ts:116-118`) and sourcing dedup reads
  these columns. Trade-off: dual-write adds complexity but avoids breaking the
  identity index and re-import dedup.

---

## 6. Dependencies & parked-spec alignment

- **Depends on 00** (canonical data model) — `identity_key` is the match key for
  ACCOUNT scope and re-import (R3.5, R6.5).
- **Realizes / does not duplicate 22** — this is the persistent, scope-aware
  store + the live send gate that 22 describes abstractly; it extends 22's
  taxonomy with `COMPLAINT` and `ALREADY_CUSTOMER`, which the live in-memory enum
  lacks (`lib/suppression/suppression.ts:12-17`).
- **Fed by 26** (reply opt-out) and **27** (hard bounce → suppression) via R3.6.
- **Honored by 33** (lawful basis includes a mandatory, honored opt-out).
- **Required by 34** (DSAR erase → permanent suppression + do-not-resurrect, R6.4).
- **Independent of 14** (anti-collision lock ≠ suppression).

---

## 7. Acceptance (Requirements-level)

A build satisfies this spec only if: a suppressed identity cannot be contacted on
any path (E1–E12 pass); `OPT_OUT`/`COMPLAINT` have no removal path (R4.1, R4.3);
suppression survives archive reopen, re-import and TAM rebuild (R6); the gate is
additive inside `evaluateSend` with no send-pipeline rewrite (R9.3); SAFE_MODE
defaults ON and T0 preserves current behavior (R2.5, R9.4); and T0 reconciliation
is gated and reviewed before go-live (R8.9).

---

**STOP — approval gate.** Reply to approve these Requirements (or request
changes). Design (data model for the new store + `targeting_status` column, the
`evaluateSend` insertion, the T0 migration plan, and the Account-page UI) follows
only after approval.
