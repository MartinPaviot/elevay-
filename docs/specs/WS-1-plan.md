# WS-1 — Guardrail Collection Infrastructure — Plan

**Status:** Approved by Martin ("juste fais ton travail et suis le cahier des charges" = full autonomy mandate). Executing PR A immediately after this doc.

## 1. OQs locked (defaults applied)

| # | Question | Decision |
|---|---|---|
| Q1 | Default LLM cap | `$50` for all new tenants. No tier field yet. Revisit when billing ships. |
| Q2 | Migration banner copy | *"We've added sending protections to Elevay. Your approval mode is now '{mapped}'. Review in Settings → Guardrails."* |
| Q3 | Primary-inbox daily cap | `20 sends/day`. Conservative rail; user can raise in Settings. |
| Q4 | `elevay-managed-requested` notification channel | Email via Resend to `process.env.OPS_EMAIL_ADDRESS`. Fallback to `[OPS-REQUEST]` console log if env unset. Configurable later. |
| Q5 | Instantly credential storage | Per-tenant, encrypted via AES-GCM with `ELEVAY_APP_SECRET`. Self-serve. |
| Q6 | `agentMemoryPanelDiscovered` gate on nudges | Yes. Matches brief §8.1 T2-T4 sequencing dependency. |
| Q7 | Trust-score calibration | `+0.02` clean approval, `+0.01` edited, `0` heavily-edited, `-0.05` undone post-send. First nudge at 0.5, second at 0.8. |
| Q8 | `updateWorkspace` chat-tool enum | Accept legacy `auto\|ask\|off` with deprecation warning for 30 days, emit v2 on mutation. |
| Q9 | `/api/settings/agent` deprecation | 301 redirect to `/settings/guardrails`. Page file deleted. |
| Q10 | Scope vs time | Ship full 5-PR scope. If PR E (UI + Instantly) blows past 500 LOC, split into E1 (Settings UI) + E2 (Instantly + banner). |

## 2. PR strategy

```
PR A (schema/migration)  →  PR B (enforcement helpers + rewire)  →  PR C (trustScore)  →  PR D (estimate-cost)  →  PR E (UI + Instantly + banner)
```

Each stacked on predecessor. After merge of predecessor: rebase → force-push → merge current. Same pattern as WS-0 (3 stacked PRs with rebase-on-merge learned lesson applied: always base on `main`, use `gh pr create --base main` when stacking isn't possible).

## 3. Task list per PR

### PR A — Foundations (schema, migration, TenantSettings)
- T A.1 — Add `sending_infra_requests` + `trust_events` tables to `db/schema.ts` with Drizzle definitions + indexes.
- T A.2 — Generate migration SQL via `drizzle-kit` + commit in `drizzle/`.
- T A.3 — Extend `TenantSettings` interface + `DEFAULTS` per spec §4.3/4.4.
- T A.4 — Create `lib/migrations/ws-1-guardrail-defaults.ts` idempotent runner.
- T A.5 — Create `/api/admin/run-ws1-migration` admin-gated endpoint with dry-run support.
- T A.6 — Unit test `ws-1-migration.test.ts` (idempotency, enum mapping, dry-run shape).
- T A.7 — Extend `analytics-events.test.ts` with new events declared in PR E (preview).
- T A.8 — Add new events to `EventCatalog` for PR C/E to consume.
- T A.9 — Commit + PR A.

### PR B — Enforcement helpers + rewire
- T B.1 — `lib/guardrails/approval-mode.ts` with `enforceAgentApprovalMode` + `readApprovalMode` (legacy coercion).
- T B.2 — `lib/guardrails/sending-identity.ts` with `enforceSendingIdentity`.
- T B.3 — Rewire `inngest/reply-handler.ts` + `inngest/autonomous-pipeline.ts` + `inngest/email-send-worker.ts` to use the helpers.
- T B.4 — Reconcile `lib/chat/tools/update.ts` + `api/settings/workspace/route.ts` enum.
- T B.5 — 301 redirect on `app/(dashboard)/settings/agent/page.tsx` to `/settings/guardrails`.
- T B.6 — Unit tests: approval-mode matrix + sending-identity matrix.
- T B.7 — Commit + PR B.

### PR C — trustScore + nudges backend
- T C.1 — `lib/guardrails/trust-score.ts` with increment + nudge-candidate + audit-trail writes.
- T C.2 — `/api/nudges/autonomy` GET + POST.
- T C.3 — Wire callsites that produce trust events (approved-without-edit emissions in reply-handler, etc.).
- T C.4 — Unit + integration tests.
- T C.5 — Commit + PR C.

### PR D — estimate-cost
- T D.1 — `lib/estimate-cost.ts` pure helper.
- T D.2 — `/api/estimate-cost` POST endpoint with rate-limit.
- T D.3 — `lib/llm-budget.ts` extension: `isNearCap(status)` helper.
- T D.4 — Call `estimate-cost` from `api/tam/route.ts` on kickoff; return in TAM response (consumed later by WS-4).
- T D.5 — Unit tests.
- T D.6 — Commit + PR D.

### PR E — UI + Instantly + banner
- T E.1 — `lib/providers/instantly-client.ts`.
- T E.2 — Instantly connect/disconnect API routes.
- T E.3 — `api/settings/sending-infra/route.ts` (GET/PUT) + `request-managed` endpoint.
- T E.4 — `Settings → Guardrails` page.
- T E.5 — `Settings → Sending infrastructure` page.
- T E.6 — `<GuardrailMigrationBanner>` component + mount on `/home`.
- T E.7 — E2E tests (guardrails-sending-enforcement + guardrails-approval-mode).
- T E.8 — Sidebar/settings-layout menu entries.
- T E.9 — Commit + PR E.

Each PR ends with: typecheck clean, vitest clean (or pre-existing failures isolated), push to remote, `gh pr create --base main`, squash-merge, rebase next branch.

## 4. Risk register (abridged)

- **Migration fires on prod tenants** → dry-run + admin-gated trigger (ADR §6.8 honored).
- **Instantly API key leak** → encrypted at rest via `ELEVAY_APP_SECRET`. Env var required.
- **Trust-events table explosion** → +0.01 per clean approval, ~50 events/user/month. Non-issue at current scale.
- **Enum migration breaks live autonomous sends** → legacy coercion in `readApprovalMode`. Both old and new values decode correctly during rollout.
- **Sending-identity enforcement blocks legitimate warm sends** → warm = has prior conversation. Cap = 20/day. Both conservative; the WS-6 scaling prompt absorbs the overflow.

## 5. Exit condition (restated)
Spec §10 holds. Retros at `docs/specs/WS-1-retro.md` after merge of PR E + migration execution + 72-hour soak.

## 6. First action
Execute PR A now. Branch: `feat/ws-1-pr-a-foundations`. Base: `main`.
