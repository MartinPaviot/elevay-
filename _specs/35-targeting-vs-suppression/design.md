# 35 — Targeting vs Suppression — Design

> Kiro-style spec. **Phase 2 of 3: Design.** Requirements approved.
> Tasks follow only after explicit approval of this section.
> Every `file:line` was verified against HEAD while writing; the suppression
> subsystem is under **concurrent development** (see §0) — re-validate line
> numbers at build time and prefer the named **interfaces** over line anchors.

## 0. Boundary with Spec 22 (read first — it changes the build)

Spec 22 (suppression-list) **landed in this working tree during this session**
(files timestamped today). It already provides the global suppression store this
feature needs, so spec 35 is the **delta on top of it**, not a parallel store.

What spec 22 already ships:

- Table `suppression` — `db/schema/outbound.ts:411-429`, migration
  `drizzle/0089_suppression.sql`. Columns: `id`, `tenant_id` (NULL = global),
  `level` (`address`|`domain`), `value`, `type`
  (`opt_out`|`hard_bounce`|`manual_dnc`|`competitor`|`existing_customer`),
  `reason`, `permanent` (default true), `expires_at`, `created_at`. Unique
  `(tenant_id, level, value)` NULLS NOT DISTINCT. RLS `tenant_isolation_suppression`
  (`0089_suppression.sql:25-38`).
- Persistence/lookup — `lib/suppression/db-store.ts`: `addSuppressionDb`
  (idempotent upsert, `:109-126`), `isSuppressedDb`/`suppressedDb` (`:91-106`),
  `drizzleSuppressionLoader` (one combined query over candidate `(level,value)`,
  `:64-85`). Pure merge/cool-off logic in `lib/suppression/suppression.ts`.
- **Already wired into the send gate**: `evaluateSend` calls `isSuppressedDb`
  with `drizzleSuppressionLoader()` (`lib/guardrails/sending-gate.ts:144-154`),
  returning `code: "suppressed"`. So **address + domain suppression is live at
  all 5 chokepoints today**.

What spec 22 does **not** do (this is spec 35's job):

1. `ACCOUNT`-scope suppression (only `address`/`domain` exist).
2. `complaint` type, and a clean `ALREADY_CUSTOMER` semantic (it has
   `existing_customer`).
3. Permanence **enforcement** (it has a `permanent` flag but nothing stops a
   `DELETE`), `status`/deactivation, `source`/actor, or a history trail.
4. `targeting_status` + `SAFE_MODE` (entirely net-new).
5. Threading recipient `contactId`/`companyId` into `evaluateSend`
   (`EvaluateSendArgs` is `toAddress`-only, `sending-gate.ts:95-111`).
6. Re-application on restore/import/TAM (`addSuppressionDb` has **no production
   callers yet** — ingestion from unsubscribe/26/27 is unwired).
7. The Account-page UI.

**Hazard (memory `shared-working-tree-branch-hazard`).** The parallel session may
keep editing `db-store.ts`, `sending-gate.ts`, and add migrations past `0089`.
Design against the **stable interfaces** (`addSuppressionDb`, `suppressedDb`,
`drizzleSuppressionLoader`, the `suppression` columns), re-check the migration
index and `sending-gate.ts` insertion points immediately before building, and
land spec 35 on its own `feat/35-...` branch.

---

## 1. Architecture overview

Two independent axes, one gate.

```
                    targeting_status (companies)        suppression (global store)
                    unreviewed|targeted|archived        EMAIL / DOMAIN / ACCOUNT
                            │                                   │
   SAFE_MODE (tenant) ──────┤                                   │
                            ▼                                   ▼
        ┌───────────────────────────── evaluateSend(args) ─────────────────────────┐
        │  1. isSuppressed(email_optouts)        → opted_out      [exists]          │
        │  2. isSuppressedDb(suppression)        → suppressed     [exists; +ACCOUNT]│
        │  3. targeting+SAFE_MODE gate           → not_targeted   [NEW, spec 35]    │
        │  4. enforceSendingIdentity(mode/cap)   → cold/cap       [exists]          │
        │  FAIL-CLOSED catch → send:false                                            │
        └───────────────────────────────────────────────────────────────────────────┘
              ▲ called by C1 campaign cron · C2 interactive · C3 SMTP cron
                · C4 meeting follow-up · C5 single send  (sending-gate.ts:10-12)
```

- **Suppression overrides targeting**: checks 1–2 run before 3, so a suppressed
  recipient is denied regardless of `targeting_status` (R5.4).
- **Targeting is the autonomous-engine rail**: the SAFE_MODE default-deny (check
  3) gates *automated* dispatch. Human-initiated interactive sends (C2 composer,
  C4 follow-up) are exempt from check 3 but **never** from 1–2 (see **D6**).
- **Live, never snapshot**: every check reads the global store per send
  (`drizzleSuppressionLoader` runs at call time); confirmed no per-list snapshot
  path (R5.2).

---

## 2. Data model

### 2.1 `targeting_status` on `companies` (NEW)

`db/schema/enums.ts` (append; values lowercase to match `dealStageEnum`
convention at `enums.ts:69-78`):

```ts
export const targetingStatusEnum = pgEnum("targeting_status", [
  "unreviewed",
  "targeted",
  "archived",
]);
```

`db/schema/core.ts` `companies` (add near `excludedReason`, `core.ts:77-78`):

```ts
targetingStatus: targetingStatusEnum("targeting_status")
  .notNull()
  .default("unreviewed"),
```

Index (add to the `companies` index list, `core.ts:111-129`):

```ts
index("companies_targeting_status_idx").on(table.tenantId, table.targetingStatus),
```

### 2.2 Extend `suppression` (additive ALTERs on spec-22's table)

Spec 22's `suppression` (`outbound.ts:411-429`) gains, via migration:

| Column | Type | Why |
|---|---|---|
| `status` | `text NOT NULL DEFAULT 'active'` (`active`\|`inactive`) | admin deactivation (R4.2) |
| `source` | `text` | provenance: `unsubscribe`/`resend_webhook`/`reply_classifier`/`dsar`/`manual_ui`/`migration` (R3.3) |
| `created_by` | `text` | actor for manual/admin writes (R3.3) |
| `deactivated_at` | `timestamptz` | history of deactivation (R4.2) |
| `deactivated_by` | `text` | who deactivated (R4.2) |

Drizzle `suppression` object in `outbound.ts:411-429` gains the same five
columns. **No new table.** `level` and `type` are free `text` (`outbound.ts:417,419`),
so the two new vocabulary values are additive with **no enum migration**:

- `level`: add `"account"` (value = the company's canonical `identityKey`, see §3).
- `type`: add `"complaint"`. Map `existing_customer` ⇢ the requirements'
  `ALREADY_CUSTOMER` (keep the existing column value; treat as a synonym in the
  UI copy — do not rename, that would break spec-22 rows).

Active-entry predicate (extends spec-22's `liveAt`, `suppression.ts:166-171`):
`status = 'active'` AND (`permanent` OR `expires_at` is null/future).

### 2.3 History / audit trail — reuse `logAudit`, no new table

R3.4/R4.2 need an append-only history. Rather than a `suppression_events` table,
reuse the existing **HMAC-signed** audit log (`lib/infra/audit-log.ts`, writes to
`activities`, 7-yr retention). Every add/deactivate/rejected-attempt →
`logAudit({ entityType: "suppression", entityId, action, metadata:{ type, level, value, source } })`.
The Account-page history drawer (R7) queries `activities` by
`entityType='suppression'`. Trade-off vs a purpose table: one query joins on
`entityId` instead of a typed FK, but we inherit a tamper-evident, already-tested
trail and add zero schema surface. The mutable `suppression` row is current
truth; the signed log is history. (Diverges from the design-panel's separate
event-log proposal — justified by `logAudit` already existing and being signed.)

---

## 3. The `evaluateSend` insertion (ACCOUNT scope + targeting)

### 3.1 New optional args (no call-site breaks)

`EvaluateSendArgs` (`sending-gate.ts:95-111`) gains optional fields:

```ts
contactId?: string;        // resolves companyId → identityKey when companyId absent
companyId?: string;        // account-scope subject
targetingStatus?: "unreviewed" | "targeted" | "archived"; // pre-resolved by crons
interactive?: boolean;     // human-initiated send → exempt from targeting gate (D6)
```

All optional ⇒ the 5 existing callers compile unchanged; they are upgraded
incrementally (§9). When neither `companyId` nor `contactId` is present, the
ACCOUNT-scope lookup and the targeting gate are **skipped** — but suppression by
email/domain (checks 1–2) still runs, and `interactive` sends are exempt from
targeting by design, so no path silently sends to a targeting-ineligible account
*without a human* (the only skip-without-human case is a cron that fails to
resolve `companyId`, which we treat fail-closed: see §3.3).

### 3.2 ACCOUNT-scope matching (extend the loader, one query)

The account is keyed by the company's canonical `identityKey` (`core.ts:104`),
**not** its domain. Rationale: `identityKey` (`fr:<siren>` / `ch:<uid>` /
`d:<domain>` / `n:<name>`) is the spec-00 dedup key that survives re-import and
TAM rebuild (R6.4); a raw domain would mis-handle shared domains and wouldn't
distinguish two companies. (Diverges from design-panel decision B's
"account = domain row" — the extra correctness is one more OR-branch in the
*same* query, not a second round-trip.)

`drizzleSuppressionLoader` (`db-store.ts:64-85`) `valueMatch` gains a third
branch when an `accountKey` is supplied:

```ts
accountKey ? and(eq(suppression.level, "account"), eq(suppression.value, accountKey)) : undefined,
```

Resolution order inside the gate (each step fail-closed):
1. `companyId` given → `accountKey = identityKey ?? companyId` (one indexed read
   on `companies`, batched by crons).
2. else `contactId` given → `contacts.companyId` (`contacts_company_id_idx`,
   `core.ts:208`) → company → `accountKey`.
3. else skip account scope.

`SuppressionTarget` (`suppression.ts:155-159`) gains `accountKey?: string`; the
pure `isSuppressed` candidate loop (`suppression.ts:187-189`) adds the
`["account", accountKey]` candidate. All additive.

### 3.3 Targeting + SAFE_MODE block (new check 3)

Inserted **after** the suppression checks (lines 144-154) and **before**
`enforceSendingIdentity` (line 156), inside the existing fail-closed `try`:

```ts
// 3. Targeting default-deny (spec 35). Suppression already ran above and wins.
const safeMode = settings?.safeModeEnabled ?? true;        // fail-closed default ON
if (safeMode && !args.interactive) {
  const status = args.targetingStatus
    ?? (await loadTargetingStatus(args.tenantId, args.companyId, args.contactId)); // → 'unreviewed' on any miss
  if (status !== "targeted") {
    return { send: false, code: "not_targeted",
             reason: `Account is ${status}; SAFE_MODE allows only targeted accounts.` };
  }
}
```

- `settings` is read just below today (`sending-gate.ts:156-159`); move that read
  **above** check 3 so SAFE_MODE and the identity policy share one load.
- `loadTargetingStatus` returns `'unreviewed'` (⇒ deny) on any unresolved
  account — fail-closed (R2.4). A thrown lookup hits the outer `catch`
  (`:189-195`) ⇒ `send:false`.
- New `SendingGateOutcome.code` value `"not_targeted"` added to the union
  (`sending-gate.ts:43`).

### 3.4 SAFE_MODE storage

Add `safeModeEnabled: boolean` to `TenantSettings` + `DEFAULTS = true`
(`lib/config/tenant-settings.ts`; settings persist in `tenants.settings` JSONB,
recon-confirmed). Default-ON means **every existing tenant inherits SAFE_MODE on
with no migration** — which is why the targeting backfill (§7) is mandatory, or
all automated sends stop. Not an env var: a per-tenant setting is auditable and
unlockable per workspace (diverges from the `OUTBOUND_TEST_MODE` env pattern,
`recipient-guardrail.ts:33`, deliberately — `OUTBOUND_TEST_MODE` stays as the
separate global kill-switch).

---

## 4. Permanence enforcement (R4.1/R4.3)

`permanent` is a flag; nothing enforces it. Add a `BEFORE DELETE OR UPDATE` row
trigger on `suppression` — the project's **first trigger** (flagged; RLS
precedent exists in `_archive/0074_rls_enforced.sql`, but RLS does not bind the
migration/owner role, so a trigger is required to satisfy "no actor, including
migrations").

Frozen set = `type IN ('opt_out','complaint')` **only**. `manual_dnc` and
`existing_customer` are admin-deactivatable (R4.2), so they are **not** frozen
(resolves the design-panel A-vs-E conflict in favour of R4.2).

```sql
-- 0092_suppression_permanence.sql
CREATE OR REPLACE FUNCTION suppression_guard_permanent() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.type IN ('opt_out','complaint')
      THEN RAISE EXCEPTION 'suppression_permanent_immutable' USING ERRCODE='P0001'; END IF;
    RETURN OLD;
  END IF; -- UPDATE: block weakening a frozen row
  IF OLD.type IN ('opt_out','complaint')
     AND (NEW.type <> OLD.type OR NEW.value <> OLD.value OR NEW.level <> OLD.level
          OR NEW.permanent <> OLD.permanent OR NEW.status <> 'active'
          OR NEW.expires_at IS DISTINCT FROM OLD.expires_at)
    THEN RAISE EXCEPTION 'suppression_permanent_immutable' USING ERRCODE='P0001'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER suppression_permanence_guard BEFORE DELETE OR UPDATE ON suppression
  FOR EACH ROW EXECUTE FUNCTION suppression_guard_permanent();
```

- `addSuppressionDb`'s `onConflictDoUpdate` (`db-store.ts:122-125`) only
  *strengthens* (permanent stays true), so it never trips the trigger on
  re-ingest of an opt-out.
- Rejected attempt (R4.3): the deactivate/delete admin route catches `P0001` →
  `logAudit({ action:"delete", entityType:"suppression", metadata:{ outcome:"rejected_permanent" }})`
  → HTTP 409.
- DSAR (spec 34) interaction: erase **adds** a permanent suppression
  (do-not-resurrect); it never deletes one, so the trigger does not impede DSAR.

---

## 5. Re-application on restore / import / TAM (R6)

One shared read-only helper in `db-store.ts` (reuses `suppressedDb`,
fail-closed):

```ts
export async function isConsentSuppressed(tenantId, t: {email?; domain?; accountKey?}): Promise<boolean>;
export async function filterConsentSuppressed<T extends {...}>(tenantId, candidates: T[]): Promise<T[]>;
```

Insert points (gate-at-insert; mirrors the dormant `filterAllowed` pattern at
`lib/accounts/suppression.ts:186`, which today no build path calls):

- `lib/tam-stream/per-company.ts` (before `db.insert(companies)`) — skip + count.
- `db/canonical/upsert.ts` **new-record branch only** (the merge branch is a
  known existing account — untouched).
- `api/import/route.ts`, `api/import/smart/commit/route.ts`, the Apollo import
  script — each insert site.
- `api/accounts/restore/route.ts:60-71` — restore sets `targeting_status` and
  **must not touch the consent store**; after restore, re-check
  `isConsentSuppressed` and keep any matched contact/account out (R6.1, R6.4).
  `liftSuppression` (`:68`) stays scoped to the `account_suppressions` *sourcing*
  ledger — a different table (`core.ts:140`).

This is **defense-in-depth**: the §3 live gate is authoritative; import-time
filtering just avoids resurrecting contactable rows. No path ever *clears* a
consent suppression (R6.3).

---

## 6. Account-page UI

- **Targeting control** (replaces the exclude/archive view-toggles,
  `accounts/page.tsx:265-270`): a 3-state control writing `targeting_status`
  (`Target` → `targeted`, `Archive` → `archived`, `Re-target` → `targeted`).
  Under SAFE_MODE, a non-`targeted` account shows a quiet helper line
  "Autonomous sends paused — target to enable" (no emoji).
- **Suppression badge** (read-only, R7.2): pill per active suppression showing
  type (Opt-out / Complaint / Already a customer / Manual DNC / Hard bounce),
  scope (`address`/`domain`/`account`), date, source. For `opt_out`/`complaint`:
  **no** action affordance (R7.3).
- **Override hint** (R7.4): when an `account`-scope or all-contact suppression is
  active, disable the "contactable" implication of targeting controls and show
  "Suppression overrides targeting."
- **Manual "Do not contact"** (R7.5): action → `addSuppressionDb` with
  `type:"manual_dnc"`, chosen scope, required reason, `source:"manual_ui"`,
  `created_by`. Promotes today's free-form `do_not_contact_request` exclude tag
  (`accounts/exclude/route.ts:33`) to a real suppression.
- **Admin deactivate** (R7.6): on `manual_dnc`/`existing_customer`/`hard_bounce`
  → set `status='inactive'` + audit; hidden for `opt_out`/`complaint`.

**Permissions** (recon: roles `admin`/`member`/`viewer`, `permissions.ts:91-130`):
targeting writes + manual-DNC add gated like exclude today (`companies:delete`,
member+, `accounts/exclude/route.ts:43`); **deactivation** gated admin-only
(`settings:write`). Viewer sees all read-only. (Flag **D7** if a purpose-built
`suppression:manage` capability is preferred over reusing existing ones.)

---

## 7. Brownfield T0 (gate before go-live)

Spec 22 owns its own `RECONCILE.md` + the `email_optouts → suppression`
backfill. **Confirm spec 22 actually backfills `email_optouts`**; if not, spec 35
absorbs it. Spec 35's T0 adds:

| Source | Target | Rule |
|---|---|---|
| every `companies` row | `targeting_status` | not excluded & not deleted → `targeted`; `excludedReason` set OR `deletedAt` set → `archived` (R8.6 — preserves SAFE_MODE-on behavior) |
| `companies.excludedReason = 'do_not_contact_request'` and matching `account_suppressions` DNC rows | `suppression` `level='account'`, `value=identityKey`, `type='manual_dnc'`, `source='migration'` | explicit DNC ⇒ real suppression, not just archived (R8.5) |
| `meeting_opt_outs` (`outbound.ts:431`) attendee emails | `suppression` `level='address'`, `type='opt_out'`, permanent | if not already covered by spec 22 |
| `account_suppressions` `kind IN ('excluded','deleted')` | **targeting only** (already mapped to `archived` above) — **NOT** consent | R8.4 |

Idempotent: `targeting_status` via column `DEFAULT` + a guarded backfill
`UPDATE … WHERE targeting_status = 'unreviewed'`; suppression rows via
`addSuppressionDb` (upsert). Applied on dev via `db:migrate:apply`/`db:push`
(`db:migrate` disabled at journal idx 12). Prod ops-gated. **`=== GATE ===`**:
do not flip any tenant's `safeModeEnabled` semantics / enable the targeting check
in prod until T0 + RECONCILE reviewed (R8.9).

---

## 8. Migrations (additive; coordinate indices with the parallel session)

At write time the highest migration is `0089_suppression.sql`. Reserve the next
free indices, re-checking just before build (the parallel session may consume
`0090+`):

- `00NN_suppression_status_source.sql` — `ALTER TABLE suppression ADD COLUMN`
  ×5 (`status`,`source`,`created_by`,`deactivated_at`,`deactivated_by`), all
  `IF NOT EXISTS`; index `suppression_status_idx (tenant_id, status)`.
- `00NN_targeting_status.sql` — `CREATE TYPE targeting_status` (guarded
  `DO $$ … duplicate_object`), `ALTER TABLE companies ADD COLUMN targeting_status
  … DEFAULT 'unreviewed' NOT NULL`, index, then the R8.6 backfill `UPDATE`.
- `00NN_suppression_permanence.sql` — the §4 function + trigger.

All re-runnable. `safeModeEnabled` needs **no** migration (JSONB settings default
in code).

---

## 9. File touch-list

**New**
- 3 migrations (§8) + `scripts/backfill-targeting-and-dnc.ts` (T0).
- Account-page targeting/suppression components.
- API routes: manual-DNC add, admin deactivate (mirror `accounts/exclude/route.ts`).
- `lib/targeting/status.ts` — `loadTargetingStatus` + dual-write helper (D5).

**Modified**
- `db/schema/enums.ts` — `targetingStatusEnum`.
- `db/schema/core.ts:77-129` — `companies.targetingStatus` + index.
- `db/schema/outbound.ts:411-429` — 5 new `suppression` columns.
- `lib/config/tenant-settings.ts` — `safeModeEnabled` (interface + `DEFAULTS`).
- `lib/suppression/suppression.ts` — `SuppressionTarget.accountKey`, `account`
  candidate, `complaint` type, active-by-`status`.
- `lib/suppression/db-store.ts` — `accountKey` in loader; `isConsentSuppressed`/
  `filterConsentSuppressed`; `deactivateSuppressionDb`; `created_by`/`source`/
  `status` on `addSuppressionDb` + `logAudit`.
- `lib/guardrails/sending-gate.ts:95-196` — new args, settings read moved up,
  targeting/SAFE_MODE check 3, `accountKey` resolution, `not_targeted` code.
- 5 chokepoints — pass `contactId`/`companyId`/`domain`/`interactive`:
  `inngest/email-send-worker.ts` (C1 ~374, C5 ~674), `inngest/outbound-smtp-send.ts`
  (C3 ~86), `lib/emails/deliver-interactive.ts` (C2 ~179, `interactive:true`),
  `api/meetings/[id]/notes/send-follow-up/route.ts` (C4 ~131, `interactive:true`).
- Re-application insert sites (§5).
- Dual-write sites for `targeting_status` (D5): `accounts/exclude/route.ts`,
  `accounts/batch/route.ts`, `accounts/restore/route.ts`, `lib/accounts/suppression.ts`.
- drizzle-zod validators for the new columns.

---

## 10. Test plan (→ R1–R9, E1–E12)

| Target | Test |
|---|---|
| R1.1-1.5 | `targeting_status` default `unreviewed`; transitions reversible+idempotent; archive/re-target write no suppression |
| R2.2-2.4 | gate: SAFE_MODE on + `unreviewed`/`archived` → `not_targeted`; `targeted` passes; flag unreadable → treated ON (fail-closed); thrown `loadTargetingStatus` → `send:false` |
| R2.5/R8.6 | backfill: contactable → `targeted` ⇒ same recipients still allowed (regression) |
| R3.2/3.4 | suppression at EMAIL, DOMAIN, ACCOUNT(identityKey); idempotent re-add = one row, upsert strengthens only |
| R4.1/4.3 | raw `DELETE`/weakening `UPDATE` on `opt_out`/`complaint` row → `P0001` (covers owner/migration); admin route → 409 + signed audit |
| R4.2 | `deactivateSuppressionDb` flips `manual_dnc`/`existing_customer`/`hard_bounce` to `inactive` + audit; refuses `opt_out`/`complaint` |
| R5.1/5.4 | suppression beats targeting: `targeted` account + suppressed email → deny |
| R5.2 | suppression added mid-sequence → next send denied (no snapshot) |
| R5.8/D6 | interactive (C2/C4 `interactive:true`) exempt from targeting but still blocked by suppression |
| R6.1/6.3/6.4 | restore re-checks, never clears; re-import of opted-out email stays suppressed; `filterConsentSuppressed` performs no writes |
| R7 | badge read-only for opt_out/complaint; manual DNC creates `manual_dnc`; deactivate admin-only |
| R9.1/9.3 | tenant-scoped lookups; existing opt-out (`email_optouts`) check still runs first; no send-pipeline rewrite |
| E1-E12 | the requirements.md edge-case table, 1:1 (E2 per-address vs E3 domain vs E4 account scoping; E5 archived+opt-out re-target; E9 idempotent webhook; E11 reject opt-out delete; E12 DSAR re-suppress) |

DB-level tests (trigger, RLS) run against a real Postgres in CI; gate/loader unit
tests inject the loader (pattern already in `__tests__/sending-gate.test.ts:75-76`
and `db-store.test.ts`).

---

## 11. Decision resolutions

From requirements (D1-D5) + new design decisions (D6-D7):

- **D1** "global" = workspace-global, **tenant-scoped**; spec-22's `tenant_id
  NULL` global-row capability exists but is reserved for platform-level
  complaints (off by default). Tenant predicate always present (R9.1).
- **D2** `hard_bounce` = cool-off via spec-22's `expires_at` (`suppression.ts:104-121`);
  not in the frozen set; system-managed, not consent.
- **D3** voice deferred — `do_not_call_list` stays separate; ACCOUNT-scope
  suppression wired into `calls/start` in a fast-follow (note: until then an
  account `manual_dnc` blocks email, not calls).
- **D4** SAFE_MODE OFF allows `unreviewed` (check 3 is `if (safeMode && …)`);
  suppression still applies.
- **D5** bounded dual-write: `targeting_status` authoritative for the gate; every
  exclude/delete/restore keeps `targeting_status` ⇄ `excludedReason`/`deletedAt`
  in lockstep so the partial unique index on `deleted_at IS NULL`
  (`core.ts:116-118`) and sourcing dedup are unaffected. Collapse later.
- **D6** (new) interactive sends exempt from the targeting gate, never from
  suppression. Refines R5.3: the SAFE_MODE default-deny is for autonomous
  dispatch; a human composing has already chosen the recipient. **Confirm.**
- **D7** (new) reuse `companies:delete` (add) + `settings:write` (deactivate)
  rather than a new `suppression:manage` capability. **Confirm.**

---

## 12. Residual risks

1. **Concurrent spec-22 edits** (§0) — re-validate `sending-gate.ts`,
   `db-store.ts`, migration index at build; land on a clean branch.
2. **First DB trigger** breaks the "RLS + app-layer only" convention; lives
   outside Drizzle/drizzle-zod — needs an SQL-level regression test and a runbook
   note for owner-level maintenance.
3. **Dual-write drift** (`targeting_status` ⇄ `deletedAt`; `suppression.status`
   ⇄ audit log) is app-discipline, not DB-enforced — funnel all writers through
   the helpers; add a reconciliation sweep.
4. **`existing_customer` vs `ALREADY_CUSTOMER` naming** — kept as `existing_customer`
   to not break spec-22 rows; UI shows "Already a customer". If the spec insists
   on the literal value, that is a coordinated rename with spec 22.
5. **`identityKey` null** for un-canonicalized companies → ACCOUNT-scope falls
   back to `companyId` (does not survive re-import) + DOMAIN scope still catches
   the domain. Backfilling `identityKey` (spec 00) closes this.
6. **C4/C5 context** — meeting follow-up / single-send may lack `companyId`;
   they pass `interactive:true` (C4) or resolve from `outboundEmails.contactId`
   (C5). A cron that cannot resolve `companyId` is fail-closed under SAFE_MODE.

---

**STOP — approval gate.** Approve this Design (and confirm D6/D7), or request
changes. Tasks (`tasks.md`: ordered, each with a verify step + test) follow only
after approval.
