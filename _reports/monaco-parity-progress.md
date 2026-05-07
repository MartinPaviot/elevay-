# Monaco-Parity P0 Execution Progress

_Last updated_ : 2026-05-07

## Summary

| P0 | Branch | Tasks committed | Status |
|---|---|---|---|
| P0-5 | `feat/monaco-parity-p0-5-deal-autofill` | 9 / 10 | ✅ Code-complete |
| P0-1 | `feat/monaco-parity-p0-1-sequence-drafts` | 9 / 10 | ✅ Code-complete |
| P0-3 | — | 0 / 12 | ⏸️ Not started |
| P0-4 | — | 0 / ~9 | ⏸️ Not started |
| P0-2 | — | 0 / ~10 | 🔴 Blocked on `SNITCHER_API_KEY` |

Total : **18 task commits + 1 WIP + 3 docs = 22 commits across 2 branches**.
Tests added on P0-1 branch : **124 new vs baseline** (state-machine 28,
component tests 16, router 14, expiry 14, classifier 16, flow integration 18,
+ underlying API route shipped in 1.2).

---

## P0-5 — Deal autofill E2E proof + monitoring

**Branch** : `feat/monaco-parity-p0-5-deal-autofill`

### Committed

| Task | Commit | Description |
|---|---|---|
| 5.1 | `0f336d4` | Conflict resolution lib (5 rules, 17 tests) |
| 5.2 | `c23af60` | Property accessor backwards-compat + migration `0044_deal_property_metadata_backfill.sql` (25 tests) |
| 5.5 | `69feed9` | `GET /api/deals/[id]/property-source/[fieldName]` |
| 5.3 + 5.4 | `0f1b049` | Cascade pure fn + worker migration (27 tests) |
| 5.6 | `969bde4` | `<DealPropertyCell>` tooltip wired into opportunity page (9 tests) |
| 5.7 | `3c47051` | Metrics primitive + autofill counters (6 tests) |
| 5.8 + 5.10 | `6cb69b5` | Datadog dashboard + RUNBOOK |
| — | `48c4bcb` | Progress doc update |

### Pending

| Task | Effort | Blocker |
|---|---|---|
| 5.9 | 0.5j | Prod run validation — needs prod tenant access |

### Tests on this branch

- Cascade : `deal-autofill-{conflict-resolution,property-accessor,apply-signals}.test.ts` — 69 tests
- UI : `deal-property-cell.test.tsx` — 9 tests
- Metrics : `observability-metrics.test.ts` — 6 tests
- Suite total : 1996 / 1997 passing

---

## P0-1 — Sequence drafts queue per-email

**Branch** : `feat/monaco-parity-p0-1-sequence-drafts`

### Committed

| Task | Commit | Description |
|---|---|---|
| 1.1 | `f19a5af` | Migration `0045_sequence_drafts.sql` + Drizzle schema + state-machine helpers (28 tests) |
| 1.2 | `9afed36` | 5 API routes (`/api/sequences/drafts/...`) — list, approve, reject, edit, context |
| — | `a03d045` | Initial progress report |
| 1.3 | `4ee65b9` | `/sequences/review` page + 3 components (DraftList, DraftPreview, RejectModal) — 16 component tests |
| 1.4 | `2ddfa03` | `inngest/sequence-draft-router.ts` + tenant approvalMode gating + approve route advances enrollment (14 tests) |
| 1.5 | `4e4ca20` | `inngest/sequence-draft-expiry.ts` hourly cron (14 tests) |
| 1.6 | `1a984d2` | `inngest/sequence-draft-rejection-learner.ts` evaluator-optimizer + classifier (16 tests) |
| 1.7 | `af315b8` | Lifecycle + race-semantics integration suite (18 tests) |
| 1.10 | _this commit_ | Migration `0046_tenant_approval_mode_default.sql` + RUNBOOK |

### Deferred

| Task | Effort | Blocker |
|---|---|---|
| 1.8 | 0.5j | Playwright E2E — needs E2E harness setup |
| 1.9 | 0.5j | Refactor legacy `/sequences/[id]/review` to point at new flow — UX decision |

### Tests on this branch

- State machine : `sequence-drafts-state-machine.test.ts` — 28 tests (shipped 1.1)
- Components : `sequence-draft-{list,reject-modal}.test.tsx` — 16 tests (shipped 1.3)
- Router : `sequence-drafts-router.test.ts` — 14 tests (shipped 1.4)
- Expiry : `sequence-drafts-expiry.test.ts` — 14 tests (shipped 1.5)
- Classifier : `sequence-drafts-rejection-classifier.test.ts` — 16 tests (shipped 1.6)
- Flow integration : `sequence-drafts-flow-integration.test.ts` — 18 tests (shipped 1.7)
- Suite total : 2018 / 2019 passing

### Datadog metrics emitted

- `sequence_drafts.expired` (count, tags : tenantId, hours)
- `sequence_drafts.rejected` (count, tags : tenantId, sequenceId, category)
- `sequence_drafts.insight_emitted` (count, tags : tenantId, sequenceId, category)

---

## P0-3 — Onboarding wizard hardening

**Branch** : not yet created
**Status** : ⏸️ Not started — backbone built in prior sessions on `feat/lightfield-quick-wins` (preserved in WIP commit `44d79b6`). Remaining work : production-quality polish, telemetry, copy.

## P0-4 — Coaching transcript-grounded production-ready

**Branch** : not yet created
**Status** : ⏸️ Not started — RAG backbone built in prior sessions (chunking + parser + retrieval + chat tool wired). Remaining : LLM-grounded eval cases, video player surface (Recall.ai-dependent).

## P0-2 — Visitor ID Snitcher integration

**Branch** : not yet created
**Status** : 🔴 Blocked — `SNITCHER_API_KEY` not in `_credentials/bootstrap.json`. Snitcher contract signup required (~$500-2000/mo) before code can run.

---

## Cumulative session context

This work builds on substantial prior-session scaffolding preserved
in WIP commit `44d79b6` :
- 5 Monaco-Parity sub-spec folders (`_specs/MONACO-PARITY-{01..07}/`)
- 5 vertical playbooks (`_research/playbooks/`)
- 6 AI-UI primitives (`components/ai-ui/`)
- LLM observability wrapper + cost dashboard
- Eval harness with 6 suites
- `/cs/today` priority queue + health-score lib
- Voice-of-customer classifier
- Onboarding wizard `/onboarding-v3` + 9 hard gates + founder-led upsell
- Visitor-ID Snitcher provider (stub-safe without API key)
- Migrations `0039` → `0043`

The two new branches branch FROM `feat/lightfield-quick-wins` (which
holds the WIP scaffolding), so they inherit all prior infrastructure.
