# WS-1 — Guardrail Collection Infrastructure — Spec

**Workstream:** WS-1 (foundation layer for explicit trust calibration)
**Spec author:** Claude Code
**Spec date:** 2026-04-21
**Reviewer:** Martin
**Status:** Draft — awaiting approval before Plan phase
**Predecessor:** WS-0 (instrumentation, merged 2026-04-21)
**Reference:** master brief §3 WS-1, §6 (success criteria), §8.1 (tensions + mitigations)

---

## 1. Purpose and scope

### 1.1 Purpose
Build the **enforceable guardrails** that protect users and P&L before any autonomous action. Three user-visible guardrails — approval mode, LLM budget cap, sending mailbox identity — plus the underlying enforcement paths, `/api/estimate-cost` helper, progressive autonomy engine (`trustScore` + nudges), and scaling-path plumbing referenced by WS-6.

### 1.2 Why this is the second workstream
Per master brief §3 WS-1 rationale: "the three explicit guardrails are the highest-leverage, lowest-risk addition. They protect the user and the P&L." They can ship before the full UX refactor (WS-2) and immediately reduce risk. Without them, the brief's success criterion 2 — "explicit trust calibration before any autonomous action" — is unreachable.

### 1.3 In scope
- **`agentApprovalMode` v2.** Replace the current `"auto" | "ask" | "manual"` enum with `"review-each" | "batch-daily" | "auto-high-confidence"`. Migration path preserves existing users' intent; default for new tenants is `"review-each"`. All autonomous send paths route through an enforcement helper.
- **`llmMonthlyCostCapUsd` default hardening.** Infrastructure exists (PUT/GET routes, `enforceLlmBudget`). WS-1 adds tier-based defaults on tenant creation and surfaces "near-cap" threshold for T3 mitigation.
- **Sending mailbox identity** (net-new):
  - `sendingMailboxMode: "primary-with-caps" | "external-connected" | "elevay-managed-requested" | "elevay-managed-active"`
  - `sendingDailyCapPrimary: number` (default 20)
  - `sendingAllowColdOnPrimary: boolean` (default `false`)
- **`sending_infra_requests` table** — manual-ops handoff for `elevay-managed-requested` state.
- **Instantly OAuth / API-key connect flow** (`external-connected` provider #1). Smartlead + SendGrid deferred.
- **`POST /api/estimate-cost`** — operation-aware cost preview helper consumed by WS-4 and future heavy flows.
- **Cost preview display rules (T3 mitigation).** Preview surfaces only on first-time-per-op or near-cap; aggregated in `Settings → Usage` otherwise.
- **Progressive autonomy engine** — `trustScore` (0-1) + `autonomyNudgeState` tracking + nudge surfacing that never auto-applies.
- **T2 mitigation — non-silent trustScore.** Schema + audit trail + `agentMemoryPanelDiscovered` gate flag. Actual panel UI is WS-8.
- **`Settings → Guardrails`** consolidated page with all three controls + explanations of why the protections exist.
- **`Settings → Sending infrastructure`** as a standalone section with mode-specific prompts.
- Migration for existing tenants to safe defaults + one-shot in-app banner.

### 1.4 Out of scope (explicit)
- The user-facing confirmation card in onboarding — WS-2's work. WS-1 lands the *backend* for the guardrails; onboarding UX consumes them later.
- The scaling-path prompt UX (`<ScalingPathPrompt>`) — WS-6's work. WS-1 provides the enforcement-layer hook that triggers it.
- Email-send `undo` toast + `agent_actions` table — WS-7's work. WS-1 enforces pre-send guards; WS-7 adds post-send reversibility.
- Agent memory panel itself — WS-8. WS-1 only seeds the `learned-preference` category entries + discovery flag.
- Smartlead + SendGrid external sender connectors. Instantly first per brief §5 decision #6.
- Mobile support for any new UI.

### 1.5 Why this workstream isn't "wiring-only" like WS-0
Of the WS-1 deliverables, roughly half are **net-new** infrastructure (sending mode + caps + Instantly OAuth + `sending_infra_requests` + `/api/estimate-cost` + `trustScore` + nudge engine) and half are **hardening/refactor** of existing pieces (`agentApprovalMode` enum migration, `llmMonthlyCostCapUsd` tier defaults, enforcement plumbing for autonomous sends).

### 1.6 Existing-code audit (informs scope)
Confirmed by grep + read on `main` (post-WS-0 merge):

| Piece | Status | File |
|---|---|---|
| `llmMonthlyCostCapUsd` schema + GET/PUT | ✅ shipped | `lib/tenant-settings.ts`, `api/settings/llm-budget/route.ts` |
| `enforceLlmBudget` pre-dispatch gate | ✅ shipped | `lib/llm-budget.ts` |
| `BudgetExceededError` + 30s cache | ✅ shipped | `lib/llm-budget.ts` |
| Settings → LLM budget UI page | ✅ shipped | `app/(dashboard)/settings/llm-budget/page.tsx` |
| `agentApprovalMode` schema | ⚠️ present but enum mismatch | `lib/tenant-settings.ts:102` declares `"auto" \| "ask" \| "manual"`; `lib/chat/tools/update.ts:822` uses `"auto" \| "ask" \| "off"`; settings page uses `"ask" \| "auto"` |
| `agentApprovalMode` default | ⚠️ unsafe default `"auto"` | `lib/tenant-settings.ts:195-199` |
| Approval-mode enforcement in reply-handler | ✅ exists but binary | `inngest/reply-handler.ts:174` — `const autoSend = settings.agentApprovalMode === "auto"` |
| Approval-mode enforcement in autonomous-pipeline | ✅ exists but binary | `inngest/autonomous-pipeline.ts:94` |
| `Settings → Agent` page | ✅ exists, 2-option UI | `app/(dashboard)/settings/agent/page.tsx` |
| `email-send-worker.ts` via Resend + ramp-up | ✅ shipped | `inngest/email-send-worker.ts` |
| `sendingMailboxMode`, caps, cold-on-primary | ❌ none | — |
| `sending_infra_requests` table | ❌ none | — |
| Instantly / Smartlead / SendGrid integration | ❌ none | grep confirms marketing-only refs |
| `/api/estimate-cost` | ❌ none | — |
| `trustScore`, `autonomyNudgeState` | ❌ none | — |
| `agentMemoryPanelDiscovered` flag | ❌ none (WS-1 seeds, WS-8 consumes) | — |

**Implication:** WS-1 is ~70% net-new code, ~30% refactor/hardening. Estimated ~20-25 task units. Fits brief's "~2-3 days" only if we parallelize aggressively; realistic is **3-4 days of focused work**.

---

## 2. Target behavior after WS-1 ships

### 2.1 Pre-send guardrail chain (new invariant)
Every outbound email (sequence step, reply draft, cold outreach, founder-coach nudge, etc.) passes through a **single enforcement funnel** before reaching `email-send-worker`:

```
Send request
  ↓
enforceAgentApprovalMode(mode, action, trustScore)   ← approval-mode gate
  ↓ allow
enforceSendingIdentity(mailboxMode, isColdLead, dailyCountToday)   ← sending-identity gate
  ↓ allow
enforceLlmBudget(tenantId)   ← existing budget gate (for LLM-generated content)
  ↓ allow
email-send-worker sends via the correct provider (Resend primary / Instantly external / managed setup)
```

If any gate rejects:
- Approval-mode reject → action queued as `pending-approval`, user notified in-app.
- Sending-identity reject → triggers the WS-6 `<ScalingPathPrompt>` (WS-1 ships the backend signal; UX lands in WS-6).
- Budget reject → existing `BudgetExceededError` surface (unchanged).

### 2.2 New Settings surface
One page `/settings/guardrails` holds:
- Approval mode selector (3 radio options with explanations and "last changed" timestamp).
- LLM budget input with live "spent this month" indicator (read-only reuse of existing UI).
- Sending infrastructure summary + "change mode" CTA that opens the sending-infra detail page or the WS-6 scaling prompt if the user tries to relax protections.

A separate page `/settings/sending-infrastructure` (linked from the summary) holds the mode-specific prompts:
- `primary-with-caps` (default) → shows effective daily cap, cold-on-primary toggle (default off), explainer paragraph.
- `external-connected` → provider list + connect/disconnect buttons + per-provider health/send-count.
- `elevay-managed-requested` → status card ("requested on <date>, waiting on ops handoff") + cancel link.
- `elevay-managed-active` → configured sending domain + warmup progress.

### 2.3 Progressive autonomy loop
- Every user-approved autonomous action (email send without edit, contact confirmation without edit, etc.) increments `trustScore` by +0.02. Edited approvals: +0.01. Rejected / heavily edited: 0. Undone post-send (WS-7): -0.05.
- At `trustScore >= 0.5` AND `agentMemoryPanelDiscovered === true`: surface nudge banner offering `review-each → batch-daily`. User clicks Accept or Dismiss.
- At `trustScore >= 0.8` AND `agentMemoryPanelDiscovered === true`: surface nudge banner offering `batch-daily → auto-high-confidence`.
- Nudges never auto-apply. Dismissed nudges re-surface after 14 days unless the user has regressed in score.

### 2.4 Migration for existing tenants
- On WS-1 deploy, a one-shot migration runs per tenant:
  - Remap legacy `agentApprovalMode` values to the v2 enum:
    - `"auto"` → `"auto-high-confidence"` (preserves current intent for users who explicitly opted in)
    - `"ask"` → `"review-each"`
    - `"manual"` → `"review-each"` (manual was effectively "agent paused" — review-each respects that mindset)
    - unset (uses default) → `"review-each"` (tightens default per brief §6 success criterion)
  - Seed `sendingMailboxMode: "primary-with-caps"`, `sendingDailyCapPrimary: 20`, `sendingAllowColdOnPrimary: false` for every tenant.
  - Seed `trustScore: 0.0`, `autonomyNudgeState: { batchDailyOffered: false, autoHighConfidenceOffered: false, batchDailyDismissedAt: null, autoHighConfidenceDismissedAt: null }`.
  - Leave `llmMonthlyCostCapUsd` untouched if already set; otherwise seed `50` (free tier default — Q1 in §8).
  - Seed `agentMemoryPanelDiscovered: false`.
- One-shot **in-app banner** for tenants who had `agentApprovalMode === "auto"` pre-migration: "We've added new sending protections. Your approval mode is now '{mapped value}'. Review in Settings → Guardrails." Banner dismissable, non-blocking.

---

## 3. File inventory

### 3.1 Files to CREATE

| Path | Purpose | Est. LOC |
|---|---|---|
| `app/apps/web/src/db/migrations/0026_sending_infra_requests.sql` | Drizzle migration for `sending_infra_requests` table. | ~40 |
| `app/apps/web/drizzle/0026_sending_infra_requests.sql` | Drizzle-generated migration twin (both dirs are used in this repo — confirm in Plan). | ~40 |
| `app/apps/web/src/lib/guardrails/approval-mode.ts` | `enforceAgentApprovalMode(mode, context)` returning `{ allowed, reason, queueAs? }`. Plus helpers for score-based auto decisions. | ~150 |
| `app/apps/web/src/lib/guardrails/sending-identity.ts` | `enforceSendingIdentity({ mode, isCold, sentTodayFromPrimary, hasPriorConversation })` returning `{ allowed, reason, scalingPath? }`. | ~180 |
| `app/apps/web/src/lib/guardrails/trust-score.ts` | `incrementTrustScore(tenantId, delta, reason)` + `recordAutonomyEvent(tenantId, kind)` + `getNudgeCandidate(tenantId)`. Writes to `settings.trustScore` + audit entries to a new `trust_events` table. | ~220 |
| `app/apps/web/src/db/migrations/0027_trust_events.sql` | Migration for `trust_events` table (audit trail for trustScore changes; consumed by WS-8 panel later). | ~30 |
| `app/apps/web/src/lib/estimate-cost.ts` | Pure helper mapping `{op, params}` → `{llmEstimateUsd, apolloCredits, estimatedDurationSeconds, confidenceLevel}`. | ~200 |
| `app/apps/web/src/app/api/estimate-cost/route.ts` | POST endpoint wrapping `estimate-cost.ts`. Rate-limited. Tenant-scoped. | ~90 |
| `app/apps/web/src/app/api/settings/sending-infra/route.ts` | GET/PUT — read and update sendingMailboxMode + caps + cold-on-primary flag. Admin-only for mode changes. | ~140 |
| `app/apps/web/src/app/api/settings/sending-infra/request-managed/route.ts` | POST — creates a `sending_infra_requests` row + fires internal notification. | ~80 |
| `app/apps/web/src/app/api/settings/sending-infra/providers/instantly/connect/route.ts` | POST — accepts an Instantly API key, validates via a test call, stores encrypted. | ~130 |
| `app/apps/web/src/app/api/settings/sending-infra/providers/instantly/disconnect/route.ts` | POST — revokes credentials, resets mode to `primary-with-caps` if no other external. | ~60 |
| `app/apps/web/src/lib/providers/instantly-client.ts` | Thin Instantly Hypergrowth API wrapper — test connection, send email, fetch send count. | ~180 |
| `app/apps/web/src/app/api/nudges/autonomy/route.ts` | GET — returns currently-surfaceable nudge for tenant (consults trustScore + `agentMemoryPanelDiscovered`). POST — dismisses a nudge. | ~100 |
| `app/apps/web/src/app/(dashboard)/settings/guardrails/page.tsx` | Consolidated Settings → Guardrails page (approval mode + budget + sending-infra summary). | ~260 |
| `app/apps/web/src/app/(dashboard)/settings/sending-infrastructure/page.tsx` | Mode-specific detail page (caps, external providers, managed state). | ~320 |
| `app/apps/web/src/components/GuardrailMigrationBanner.tsx` | One-shot dismissable banner for migrated-from-legacy users. | ~80 |
| `app/apps/web/src/lib/migrations/ws-1-guardrail-defaults.ts` | Idempotent per-tenant migration runner — invoked from an Inngest one-shot cron job OR from a manual admin endpoint. | ~120 |
| `app/apps/web/src/app/api/admin/run-ws1-migration/route.ts` | Admin-gated endpoint to dry-run or execute the WS-1 migration. | ~100 |
| `app/apps/web/src/__tests__/guardrails-approval-mode.test.ts` | Unit tests for `enforceAgentApprovalMode`. | ~180 |
| `app/apps/web/src/__tests__/guardrails-sending-identity.test.ts` | Unit tests covering the 4 modes × warm/cold × cap-not-hit/cap-hit matrix. | ~240 |
| `app/apps/web/src/__tests__/guardrails-trust-score.test.ts` | Unit tests: increment arithmetic, nudge threshold gates, `agentMemoryPanelDiscovered` gate, audit trail. | ~200 |
| `app/apps/web/src/__tests__/estimate-cost.test.ts` | Unit tests for cost estimation across op types. | ~120 |
| `app/apps/web/src/__tests__/instantly-client.test.ts` | Mocked Instantly API wrapper tests. | ~100 |
| `app/apps/web/src/__tests__/ws-1-migration.test.ts` | Migration idempotency, enum remap correctness, per-tenant-scope. | ~150 |
| `app/apps/web/tests/e2e/guardrails-sending-enforcement.spec.ts` | E2E: block a cold send, verify the scaling-path signal payload. | ~160 |
| `app/apps/web/tests/e2e/guardrails-approval-mode.spec.ts` | E2E: approval mode change + pending-approval queue shape. | ~140 |
| `docs/specs/WS-1-plan.md` | Plan document after spec approval (placeholder). | N/A |
| `docs/specs/WS-1-retro.md` | Retrospective at workstream close (placeholder). | N/A |

**Total new files:** 27. **Total new LOC estimate:** ~3,900 code + tests.

### 3.2 Files to MODIFY

| Path | Change | Est. LOC |
|---|---|---|
| `app/apps/web/src/lib/tenant-settings.ts` | Extend `TenantSettings`: new `agentApprovalMode` enum (keep legacy strings decodable for migration), new fields (`sendingMailboxMode`, `sendingDailyCapPrimary`, `sendingAllowColdOnPrimary`, `trustScore`, `autonomyNudgeState`, `agentMemoryPanelDiscovered`, `instantlyCredentialsEncrypted`). Update `DEFAULTS`. Add helpers for enum migration read-path. | ~90 |
| `app/apps/web/src/db/schema.ts` | Add `sending_infra_requests` table definition + `trust_events` table definition + indexes. | ~80 |
| `app/apps/web/src/inngest/reply-handler.ts` | Replace the binary `settings.agentApprovalMode === "auto"` check with a call to `enforceAgentApprovalMode(...)`. Route the outbound through the guardrail funnel. | ~40 |
| `app/apps/web/src/inngest/autonomous-pipeline.ts` | Same as above. | ~40 |
| `app/apps/web/src/inngest/email-send-worker.ts` | Before dispatching via Resend, consult `sendingMailboxMode`: if `external-connected` (Instantly), route through Instantly client; if `elevay-managed-active`, route through managed-domain transport; if `primary-with-caps` and the target is a cold lead OR cap hit, fail and emit a `sending.blocked.scaling-path` event. | ~110 |
| `app/apps/web/src/lib/chat/tools/update.ts` | Fix the enum mismatch (`"auto" \| "ask" \| "off"` → new v2 enum) on `updateWorkspace` chat tool. Update the zod schema + migration shim. | ~25 |
| `app/apps/web/src/app/api/settings/workspace/route.ts` | Same enum reconciliation. | ~20 |
| `app/apps/web/src/app/(dashboard)/settings/agent/page.tsx` | Reshape the 2-option radio into the 3-option v2 radio with inline explanations. Or deprecate this page and redirect to `/settings/guardrails`. | ~50 |
| `app/apps/web/src/lib/llm-budget.ts` | Add `isNearCap(status)` helper (last 20% of cap) for the T3 cost-preview display rule. Also accept tier-based default hooks. | ~30 |
| `app/apps/web/src/app/api/tam/route.ts` | Call `estimateCost("tam-build", ...)` before the build kicks off; if first-time OR near-cap, return the estimate in the response for the WS-4 UI to render. | ~30 |
| `app/apps/web/src/app/(dashboard)/settings/layout.tsx` OR sidebar config | Add "Guardrails" and "Sending infrastructure" menu entries. | ~10 |
| `app/apps/web/src/__tests__/analytics-events.test.ts` | Add new WS-1 events to the catalog sanity check (see §4.2). | ~20 |
| `app/apps/web/src/lib/analytics.ts` | Add WS-1 event types to `EventCatalog`. | ~80 |

**Total modifications:** 13 files, ~625 LOC.

### 3.3 Files to DELETE
None during WS-1. `settings/agent/page.tsx` may be deprecated via redirect rather than deleted (kept for the Plan phase to decide).

### 3.4 Total change footprint
**~4,500 LOC total** across 40 files. Definitely multi-PR. Proposed 5-PR split (detail in Plan, preview here):
- **PR A**: schema + migrations + TenantSettings interface + legacy enum migration runner + tests. Deployable as no-op.
- **PR B**: `enforceAgentApprovalMode` + `enforceSendingIdentity` helpers + rewiring `reply-handler`, `autonomous-pipeline`, `email-send-worker`. Reconcile chat-tool enum.
- **PR C**: `trustScore` library + `trust_events` table wiring + nudge endpoint. Surface points deferred to PR E.
- **PR D**: `/api/estimate-cost` + `estimate-cost.ts` + `isNearCap` helper + TAM call site integration.
- **PR E**: Settings UI (Guardrails page + Sending infrastructure page) + Instantly OAuth routes + migration banner + Instantly client. E2E tests.

---

## 4. Schema changes

### 4.1 New table `sending_infra_requests`

```sql
CREATE TABLE sending_infra_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requested_by_user_id TEXT NOT NULL REFERENCES auth_users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assignee_email TEXT,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sending_infra_requests_tenant_idx ON sending_infra_requests(tenant_id);
CREATE INDEX sending_infra_requests_status_idx ON sending_infra_requests(status);
```

One request row per tenant per active request. Status lifecycle: `pending → in_progress → completed` OR `pending → cancelled`. No row deleted — kept for ops audit.

### 4.2 New table `trust_events`

```sql
CREATE TABLE trust_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES auth_users(id),
  event_type TEXT NOT NULL, -- e.g. "approved_no_edit", "approved_with_edit", "rejected", "undone_after_send", "nudge_accepted", "nudge_dismissed"
  score_delta REAL NOT NULL DEFAULT 0,
  new_score REAL NOT NULL,
  entity_ref TEXT, -- optional: the action the event refers to (email send id, etc.)
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX trust_events_tenant_created_idx ON trust_events(tenant_id, created_at DESC);
```

Append-only. WS-8's Agent Memory panel reads this via the `learned-preference` category. T2 mitigation (brief §8.1): this table is the visibility surface for the trustScore.

### 4.3 `TenantSettings` JSONB additions
Ten new keys, one migration-only field:

```ts
// ── WS-1 guardrails ──
/** Explicit trust calibration. Replaces legacy auto|ask|manual.
 *  Legacy values are still decoded by `readApprovalMode()` for rollback. */
agentApprovalMode?: "review-each" | "batch-daily" | "auto-high-confidence";
/** Sending infra mode. Default "primary-with-caps" on new tenants. */
sendingMailboxMode?: "primary-with-caps" | "external-connected" | "elevay-managed-requested" | "elevay-managed-active";
/** Max sends/day from the user's primary inbox. Default 20. */
sendingDailyCapPrimary?: number;
/** When false (default), cold outreach from primary inbox is blocked. */
sendingAllowColdOnPrimary?: boolean;
/** Encrypted Instantly API key (AES-GCM via app secret). Only present when
 *  sendingMailboxMode === "external-connected" and provider === "instantly". */
instantlyCredentialsEncrypted?: string;
/** Current trust score, 0.0 - 1.0. See lib/guardrails/trust-score.ts. */
trustScore?: number;
/** State of the progressive-autonomy nudge flow. */
autonomyNudgeState?: {
  batchDailyOffered: boolean;
  batchDailyOfferedAt?: string;
  batchDailyDismissedAt?: string;
  autoHighConfidenceOffered: boolean;
  autoHighConfidenceOfferedAt?: string;
  autoHighConfidenceDismissedAt?: string;
};
/** T2 + T4 mitigation: nudges cannot surface until this flag is true.
 *  Flipped by WS-8 on first open of the Agent Memory panel. WS-1 only seeds false. */
agentMemoryPanelDiscovered?: boolean;
/** Internal: timestamp of the WS-1 migration run for this tenant.
 *  Idempotency guard for the migration runner. */
ws1MigrationRanAt?: string;
/** One-shot banner dismissal: if truthy, the migration banner is hidden. */
ws1MigrationBannerDismissedAt?: string;
```

### 4.4 `DEFAULTS` update
```ts
const DEFAULTS: Required<Pick<
  TenantSettings,
  "aiTone" | "salesMotion" | "agentApprovalMode" |
  "sendingMailboxMode" | "sendingDailyCapPrimary" | "sendingAllowColdOnPrimary" |
  "trustScore" | "agentMemoryPanelDiscovered"
>> = {
  aiTone: "Direct",
  salesMotion: "Founder-led sales",
  agentApprovalMode: "review-each", // changed from "auto"
  sendingMailboxMode: "primary-with-caps",
  sendingDailyCapPrimary: 20,
  sendingAllowColdOnPrimary: false,
  trustScore: 0.0,
  agentMemoryPanelDiscovered: false,
};
```

### 4.5 Migration strategy — non-destructive, idempotent
Single one-shot migration per tenant, run from an Inngest job triggered by a manual admin endpoint (NOT auto-triggered on deploy to avoid a thundering herd + to let Martin watch the first tenant migrate before fanning out).

Steps per tenant:
1. Read current settings. If `ws1MigrationRanAt` already set, return `{ status: "skipped" }`.
2. Remap `agentApprovalMode` per §2.4 table.
3. Seed the 6 new default fields if absent.
4. Compute `migrationBannerNeeded = previousMode === "auto"`. If true, seed `ws1MigrationBannerDismissedAt: undefined` so the banner renders.
5. Write updates + `ws1MigrationRanAt: new Date().toISOString()`.
6. Return `{ status: "migrated", previousMode, newMode, migrationBannerNeeded }`.

The migration endpoint `/api/admin/run-ws1-migration` accepts `{ dryRun?: boolean, tenantId?: string }`. Without `tenantId`, migrates all tenants in batches of 50 with backoff. Dry-run returns the would-be-mutations without writing.

---

## 5. API surface

### 5.1 `POST /api/estimate-cost`

**Request body:**
```ts
{
  op: "tam-build" | "sequence-draft" | "inbox-scan" | "narrate-website" | "icp-analysis";
  params?: Record<string, unknown>; // op-specific — e.g. { contactCount: 50 }
}
```

**Response (200):**
```ts
{
  llmEstimateUsd: number;
  apolloCredits: number;
  estimatedDurationSeconds: number;
  confidenceLevel: "high" | "medium" | "low";
  // T3 display-rule hints — callers use these to decide whether to surface to the user.
  isFirstTimeForOp: boolean;
  isNearCap: boolean;
  currentCapStatus?: {
    capUsd: number;
    spentUsd: number;
    percentUsed: number;
  };
}
```

**Error (400):** unknown op, missing required params.
**Error (429):** rate-limited (checkRateLimit("estimate-cost")).

**Performance target:** p95 ≤ 200 ms. Implementation is pure arithmetic + a budget-status read (already cached 30s).

### 5.2 `GET|PUT /api/settings/sending-infra`
GET → current mode + caps + connected providers list + pending request if any.
PUT (admin only) → mutate caps/flags. Mode changes go through the mode-transition helper that validates transitions (e.g. can't jump `primary-with-caps → elevay-managed-active` directly, must go through `requested`).

### 5.3 `POST /api/settings/sending-infra/request-managed`
Idempotent per tenant (one active request at a time). Creates `sending_infra_requests` row, sets `sendingMailboxMode = "elevay-managed-requested"`, fires Martin's internal notification (channel configurable via env; falls back to `console.error` with `[OPS]` prefix if unset).

### 5.4 `POST /api/settings/sending-infra/providers/instantly/connect`
Body: `{ apiKey: string }`. Validates by calling Instantly's health endpoint. On success, encrypts via AES-GCM with app secret, stores in `settings.instantlyCredentialsEncrypted`, sets mode to `external-connected`.

### 5.5 `GET|POST /api/nudges/autonomy`
GET returns `{ nudge: "batch-daily" | "auto-high-confidence" | null, reason? }`. POST with `{ action: "accept" | "dismiss", nudge: ... }` records the user's choice in `autonomyNudgeState` + `trust_events`.

### 5.6 No breaking changes to existing endpoints
- `/api/settings/llm-budget` unchanged.
- `/api/settings/workspace` gains the enum reconciliation but keeps backwards-compat for legacy payloads.
- `/api/settings/agent` deprecated; returns 301 to `/settings/guardrails`.

---

## 6. Architecture decisions (ADR-light)

### 6.1 ADR — Keep legacy approval-mode strings decodable, not deleted
**Decision:** `readApprovalMode(settings)` returns a v2 value, coerces legacy `auto|ask|manual` via the migration table, and never throws.
**Alternatives:** hard-delete legacy strings at migration time.
**Why:** rollback needs the legacy values intact on disk. If WS-1 migration has a bug and Martin wants to revert by reverting the PR, the `settings.agentApprovalMode = "auto"` entries should still work against the PRE-WS-1 code. Coercion at read-time is 5 lines and preserves the rollback path.

### 6.2 ADR — One enforcement funnel, not per-call-site checks
**Decision:** Create a single `enforceAgentApprovalMode(mode, context)` helper in `lib/guardrails/approval-mode.ts` that every autonomous send path consults. Callers don't re-implement the logic.
**Alternatives:** Keep the current pattern where each callsite does its own `if (settings.agentApprovalMode === "auto") send()` check.
**Why:** brief §6 success criterion "Zero user-reported incidents of 'the agent did something I didn't approve'" is an ALL-paths claim. A single helper is easier to audit than N callsites. Current state has ≥2 callsites (`reply-handler.ts:174`, `autonomous-pipeline.ts:94`) with subtle divergence already (the former binaries on "auto", the latter reads and passes around). Time to consolidate.

### 6.3 ADR — `sendingMailboxMode` as discriminator, not separate boolean flags
**Decision:** One enum `sendingMailboxMode` with 4 states. Caps + cold-on-primary flag live alongside as modifiers.
**Alternatives:** Boolean `usesExternalSender`, `usesManagedInfra` separately.
**Why:** the brief §2.3 Category C defines the three identity options explicitly. An enum avoids invalid state combinations (e.g., `usesExternalSender=true AND usesManagedInfra=true`). Ensures state-transition validation in one place.

### 6.4 ADR — `trust_events` table, not JSON blob in settings
**Decision:** Append-only `trust_events` table with one row per scoring event.
**Alternatives:** Rolling window stored in `settings.trustEventLog` JSON.
**Why:** (a) the audit trail is the T2 mitigation — must be visible and queryable in WS-8's memory panel. (b) JSONB grows unbounded without automated pruning; a dedicated table with indexed queries is cheaper and structurally honest. (c) Cost: ~100 rows/user/month max → negligible storage.

### 6.5 ADR — Nudges never auto-apply, even on first accept click
**Decision:** Accept of a nudge requires a second confirmation step with a 5-second delay + explicit "I understand this means X" checkbox. Dismiss is one click.
**Alternatives:** One-click accept like any normal UI.
**Why:** brief §2.1.1 criterion 2 "explicit trust calibration before any autonomous action". The nudge IS the calibration moment — making it reversible and friction-free-to-refuse protects against accidental autonomy upgrades.

### 6.6 ADR — Cost preview modal is the exception, not the rule (T3)
**Decision:** The `isFirstTimeForOp` + `isNearCap` booleans in the estimate-cost response are advisory. Callers that honor them (WS-4 TAM kickoff, future sequence-draft on large contact lists) render the preview modal. Routine ops (chat messages, small enrichments) never render it.
**Alternatives:** Show preview on every call; user dismisses.
**Why:** brief §8.1 T3 identifies anxiety and fatigue as real costs of over-surfacing. Rule-based conditional display keeps the preview powerful when it appears.

### 6.7 ADR — Instantly API key, not OAuth, for external-connected v1
**Decision:** Start with API-key-based connection (Instantly Hypergrowth plan supports this). OAuth optional follow-up.
**Alternatives:** Wait for Instantly OAuth to ship.
**Why:** brief §5 decision #6 ("Instantly first since Martin already has the Hypergrowth plan") + Instantly's OAuth app registration flow is opaque and slow. API key lets Martin self-serve the connection in minutes. Encryption at rest via AES-GCM keeps it safe.

### 6.8 ADR — Migration is admin-triggered, not auto-on-deploy
**Decision:** A deploy that ships WS-1 does NOT automatically run the migration. Martin must call `/api/admin/run-ws1-migration` (first with `dryRun: true`).
**Alternatives:** Auto-run on deploy, Inngest cron, lazy-migrate on first settings read.
**Why:** (a) the migration changes the enum interpretation on every tenant — a buggy migration + auto-run = 100% fleet impact. (b) Dry-run on `dryRun: true` tells Martin exactly what would change before committing. (c) Lazy migration is simpler but leaves old code in the hot path for weeks. Explicit + fast > implicit + slow.

### 6.9 ADR — Sending-infra blocks route callers to `scalingPath` signal (not a `throw`)
**Decision:** `enforceSendingIdentity` returns `{ allowed: false, reason, scalingPath: true }` rather than throwing. Callers translate to the WS-6 `<ScalingPathPrompt>` or queue the send as `blocked-awaiting-scaling`.
**Alternatives:** Throw a `SendingBlockedError` like `BudgetExceededError`.
**Why:** the scaling-path flow is a product conversation with the user, not an error. Throwing forces every caller to catch + re-render a specific UI; returning a discriminated union keeps the caller in charge of routing.

### 6.10 ADR — Free/Pro/Team tiers are not yet a first-class concept
**Decision:** WS-1 uses a single default `llmMonthlyCostCapUsd = 50` for all new tenants (pending Martin's §5.1 decision). No tier field added.
**Alternatives:** Introduce `tenantTier: "free" | "pro" | "team"` now.
**Why:** billing tiers aren't WS-1's concern and no downstream consumer reads them. Adding the field just to pick a default is premature abstraction. When billing ships, it'll own the tier field and read it here.

---

## 7. Testing strategy

### 7.1 Unit tests (Vitest)
- `__tests__/guardrails-approval-mode.test.ts` — matrix of modes × action-types × trustScore-ranges. Assertions on `{ allowed, reason, queueAs }`.
- `__tests__/guardrails-sending-identity.test.ts` — matrix of `{ mode, isCold, sentToday, cap, allowColdOnPrimary }`. Assertions on `{ allowed, scalingPath }`.
- `__tests__/guardrails-trust-score.test.ts` — increment arithmetic, threshold gates, `agentMemoryPanelDiscovered` gate, audit-trail writes.
- `__tests__/estimate-cost.test.ts` — each op-type returns sensible numbers, first-time flag toggles, near-cap logic.
- `__tests__/instantly-client.test.ts` — mocked fetch, happy + 401 + 429 paths.
- `__tests__/ws-1-migration.test.ts` — idempotency, enum mapping table, dry-run vs execute, banner-needed flag correctness.
- Extend `__tests__/analytics-events.test.ts` with WS-1 event names.

**Framework:** Vitest (matches existing pattern).
**Mock approach:** `vi.hoisted` for cross-factory shared state (pattern from WS-0 PR 3). Mock `@/lib/tenant-settings` + `@/db` the same way other tests do.

### 7.2 Integration tests (Vitest with DB)
- `__tests__/sending-infra-api.test.ts` — `POST /api/settings/sending-infra/request-managed` creates a row, repeat call is idempotent, cancel clears state.
- `__tests__/estimate-cost-api.test.ts` — admin vs member, rate-limit, shape correctness.
- `__tests__/approval-mode-integration.test.ts` — an autonomous reply is queued as `pending-approval` in `review-each` mode; auto-sent in `auto-high-confidence`.

### 7.3 E2E tests (Playwright)
- `tests/e2e/guardrails-sending-enforcement.spec.ts` — seed a user with `sendingMailboxMode: "primary-with-caps"`, attempt a cold outreach, assert the send is blocked + the blocking payload carries `scalingPath: true`.
- `tests/e2e/guardrails-approval-mode.spec.ts` — toggle approval mode, kick off an action, verify the resulting state (auto-send vs queued).
- Extend the WS-0 e2e harness (not create new env) so PostHog intercepts continue to work.

### 7.4 Failure modes per brief §4.4
- **Severity 1** — `trust_events` insert fails: swallow, log, `trustScore` write still happens.
- **Severity 2** — Instantly API 429: surface inline "pause + retry in 60s", no user-visible error banner.
- **Severity 3** — Apollo/LLM unavailable during `estimate-cost`: return `confidenceLevel: "low"` with whatever static estimate we can produce, plus `error` field in the response so callers can decide.
- **Severity 3** — Migration failure mid-batch: resumable. `ws1MigrationRanAt` prevents re-migration of tenants that already succeeded.

### 7.5 Manual verification checklist
Martin signs off WS-1 exit when:
- Fresh tenant signs up → `agentApprovalMode: "review-each"`, `sendingMailboxMode: "primary-with-caps"`, `sendingDailyCapPrimary: 20`, `sendingAllowColdOnPrimary: false`, `trustScore: 0.0`.
- Existing tenant running the migration dry-run sees the expected remap table and no unexpected mutations.
- Legacy-`auto` tenant after migration sees the one-shot banner on first `/home` visit.
- Attempted cold send from primary inbox triggers the WS-6 scaling-path signal (verified via event log).
- `/api/estimate-cost` returns within 200 ms p95 for a tam-build op.
- Progressive autonomy: simulate 30 approved-without-edit actions (trustScore ≥ 0.6 assuming fresh start + mid-gate events), verify NO nudge fires until `agentMemoryPanelDiscovered = true`, then flip the flag and watch the nudge appear.

---

## 8. Rollout and rollback

### 8.1 Rollout
- Ship PRs A → B → C → D → E sequentially; each is independently deployable (per ADR §6.1 and §6.8 — legacy enum still readable, migration not auto-triggered).
- After PR E ships: Martin calls `/api/admin/run-ws1-migration` with `dryRun: true`, reviews the report (expected: all tenants get `sendingMailboxMode: "primary-with-caps"` seeded, a subset remap from `auto → auto-high-confidence` or `ask → review-each`), then re-runs with `dryRun: false`.
- Banner appears for tenants whose previous mode was `"auto"`. Banner text (final copy to Martin):
  > *"We've added sending protections to Elevay. Your approval mode is now 'Auto (high-confidence actions only)'. Review in Settings → Guardrails."*

### 8.2 Rollback
- `git revert` each PR in reverse order (E → D → C → B → A). Each revert is independently clean because of the legacy-enum coercion (ADR §6.1).
- `sendingMailboxMode`, `trustScore`, `autonomyNudgeState` etc. remain in `settings` JSONB post-revert. They're unused by the reverted code; no harm.
- `sending_infra_requests` + `trust_events` tables remain. No DROP TABLE on revert — data retention for safety.

### 8.3 Observability during rollout
- WS-0 PostHog dashboard gains 2 new funnels:
  - Approval mode migration: `ws1.migration.executed` → `ws1.migration.banner_shown` → `ws1.migration.banner_dismissed` → `ws1.approval_mode_changed` (if user adjusted after migration).
  - Scaling-path hit: `sending.blocked.scaling-path.raised` → (WS-6's prompt interactions when WS-6 ships).
- `Settings → Sending infrastructure` pageviews tracked.
- `trust_events` rate monitored daily — if it spikes >100x baseline, something is mis-wired and double-counting.

---

## 9. Open questions for Martin before execution starts

### 9.1 Billing tier defaults (Q1 in brief §5.1)
Proposed: `llmMonthlyCostCapUsd = 50` for all new tenants (no tier field). Confirm or override.

### 9.2 Migration banner copy
Final wording in Martin's voice. Draft above in §8.1.

### 9.3 Primary-inbox daily cap default (brief §5.3)
Proposed: 20. Confirm or override. This is the most user-sensitive default — too low and legitimate warm follow-ups get blocked at the cap.

### 9.4 Notification channel for `elevay-managed-requested`
Brief §5.5 asks where the notification fires. Options: Slack webhook, email alias, Linear issue, console log. Martin to specify. **Default if unspecified:** write to server logs with `[OPS-REQUEST]` prefix + send an email via the existing Resend client to an env-configured `OPS_EMAIL_ADDRESS`.

### 9.5 Instantly Hypergrowth plan API key location
Will the key be stored in env (one key for the whole tenant fleet) or per-tenant (Martin's current plan)? Brief §5.6 implies per-tenant. Confirm — if env, the `instantlyCredentialsEncrypted` field becomes redundant.

### 9.6 Is `agentMemoryPanelDiscovered` gating nudges too aggressive?
The brief's T2 sequencing dependency says no nudge fires before the panel is discoverable. WS-8 defers the header button until after first approved action. So in practice, a user who never approves anything never gets nudged. Is this the right behavior? My default is yes (it matches the brief), but flagging.

### 9.7 Trust-score math — is +0.02 per clean approval calibrated?
At +0.02/approval, a fresh user hits the first nudge (threshold 0.5) after **25 clean approvals**. For a founder sending ~5 approved drafts/day, that's ~1 week. Matches the brief's intent. Confirm or propose alternative calibration.

### 9.8 `updateWorkspace` chat tool enum reconciliation
The tool currently accepts `"auto" | "ask" | "off"` via zod. WS-1 changes the enum. Should the tool still accept the legacy strings for agent-initiated mode changes during the migration window, or hard-cut to v2? **Default:** accept legacy with a deprecation warning in the LLM context, 30-day window.

### 9.9 `/api/settings/agent` deprecation
Deprecate via 301 redirect to `/settings/guardrails` vs keep the page as a thin view under the new page? **Default:** 301 redirect. Simpler routing, single source of truth.

### 9.10 PR scope vs time
Estimate is ~4 days, 5 PRs. Brief §3.4 estimated "~2-3 days" for WS-1. Confirm that the realistic 4-day estimate is acceptable, or we narrow scope (likely candidates to defer: progressive-autonomy nudge UX — ship the scoring/audit trail, defer the nudge-banner UI to WS-1.5).

---

## 10. Exit condition

Restated for clarity. WS-1 is complete when **all** hold:

1. All 5 PRs (A-E) merged to `main`.
2. Martin has run the migration (dry-run → execute), verified the per-tenant mutations, and no user has reported unexpected behavior within 72 hours of the migration.
3. Fresh tenant signup produces the new defaults (verified via admin metrics endpoint extension or manual DB query).
4. A cold-send attempt from primary inbox on a test tenant produces the `scalingPath: true` signal in logs.
5. Progressive-autonomy engine fires the first nudge for a test tenant after crossing trustScore ≥ 0.5 + `agentMemoryPanelDiscovered = true`.
6. WS-1 retrospective (`docs/specs/WS-1-retro.md`) written.

Post-exit, WS-2 (confirmation card) can consume the `/api/estimate-cost` helper and the guardrail surfaces without blocking on further WS-1 work.

---

## 11. What this spec deliberately excludes

- Visual design of the Guardrails page, Sending Infrastructure page, migration banner — Martin's call during PR E. Spec locks layout shape (zones, fields), not brand styling.
- The full WS-6 scaling-path prompt UX — WS-1 emits the backend signal; WS-6 renders.
- WS-7's undo layer — trust_events already has a slot for `undone_after_send`, but the undo itself is WS-7.
- WS-8's Agent Memory panel — WS-1 writes to `trust_events` and toggles `agentMemoryPanelDiscovered`, but the panel itself is WS-8.
- Smartlead, SendGrid, Mailgun etc. as external providers — Instantly first per brief §5.6.
- A second "executive summary" dashboard for Martin on approval-mode / budget / sending stats — PostHog insights suffice for WS-1 exit.

---

## 12. Approval

Martin: review and reply with Approve / Approve with changes / Reject per the Kiro methodology in brief §9.1. Once approved, I'll write `docs/specs/WS-1-plan.md` (Phase 2) and then execute PR A (schema + migration + TenantSettings extension).

**Defaults for the 10 open questions** are pre-locked per §1 of the forthcoming Plan document (same pattern as WS-0-plan.md §1).

End of spec.
