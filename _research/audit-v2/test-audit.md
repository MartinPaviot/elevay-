# Test Quality Audit — 2026-04-01

## Test Run Results

```
npx vitest run → 19 files, 99 tests, ALL PASSING
Duration: 8.00s (transform 6.03s, setup 0ms, import 19.81s, tests 2.61s)
```

All 99 tests pass. Zero failures.

## Per-File Analysis

### 1. `actions-api.test.ts`
- **Tests**: `GET /api/actions` — AI-generated next actions
- **Cases**: 2
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`, `ai` (generateObject), `@ai-sdk/anthropic`, `@ai-sdk/openai`, `drizzle-orm`
- **What it tests**: Auth guard (401) + that mocked AI output flows through to response
- **Edge cases**: None (only auth failure)
- **Score**: **WEAK** — mocks all externals (db + auth + AI). Tests nothing real.

### 2. `autopilot-api.test.ts`
- **Tests**: `POST /api/sequences/[id]/autopilot`
- **Cases**: 2
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`, `drizzle-orm`
- **What it tests**: Auth guard (401) + sequence-not-found (404)
- **Edge cases**: No happy path tested at all
- **Score**: **WEAK** — only tests two guard clauses. Core autopilot logic untested.

### 3. `dashboard.test.ts`
- **Tests**: Pure utility functions: `getGreeting()`, `getStartOfWeek()`, `getStalledDays()`, `getSummaryText()`
- **Cases**: 14
- **Mocks**: NONE
- **What it tests**: Real pure functions with real logic
- **Edge cases**: YES — boundary values (hour 11 vs 12 vs 17), Sunday edge for week start, 2 vs 3 days for stall threshold, null input, zero activity
- **Score**: **MEANINGFUL** — the only file testing real logic without mocks. However: **functions are defined INLINE in the test file, not imported from the actual codebase**. These tests could pass while the real app code has drifted.

### 4. `deals-api.test.ts`
- **Tests**: `POST /api/deals/analyze`
- **Cases**: 3
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`, `ai` (generateObject), `@ai-sdk/anthropic`, `@ai-sdk/openai`, `drizzle-orm`
- **What it tests**: Auth guard (401), missing dealIds (400), mocked AI analysis flows through
- **Edge cases**: None beyond guards
- **Score**: **WEAK** — mocks all externals.

### 5. `deliverability-api.test.ts`
- **Tests**: `GET /api/deliverability`
- **Cases**: 4
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`, `drizzle-orm`
- **What it tests**: Real rate computation from mocked activity data — verifies open/reply/bounce rate math, health score, warning generation
- **Edge cases**: Empty data (zeroes), correct rate computation (50% open, 25% reply, 25% bounce), high bounce rate warning
- **Score**: **MEANINGFUL** — tests real computation logic. No AI mock needed.

### 6. `emails-api.test.ts`
- **Tests**: `POST /api/emails`
- **Cases**: 4
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`, `ai` (generateObject), `@ai-sdk/anthropic`, `@ai-sdk/openai`
- **What it tests**: Auth (401), missing contactId (400), contact not found (404), prompt contains contact name
- **Edge cases**: Only the prompt assertion is marginally useful
- **Score**: **WEAK** — mocks all externals.

### 7. `enrich-api.test.ts`
- **Tests**: `POST /api/enrich`
- **Cases**: 6
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`, `@/lib/apollo-client`, `ai` (generateObject), `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@/lib/embeddings`
- **What it tests**: Empty ids (400), already-enriched skip, batch limit (25→20), missing company failure count
- **Edge cases**: Batch limit enforcement, skip logic
- **Score**: **WEAK-TO-MODERATE** — tests orchestration logic (skip, batch limit, failure counting) which is real code, but all data sources mocked.

### 8. `enrich-contacts-api.test.ts`
- **Tests**: `POST /api/enrich-contacts`
- **Cases**: 6
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`, `@/lib/apollo-client`, `ai` (generateObject), `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@/lib/embeddings`
- **What it tests**: Same pattern as enrich-api — empty ids, skip-if-enriched, batch limit, failure count
- **Edge cases**: Similar orchestration checks
- **Score**: **WEAK-TO-MODERATE** — mirrors enrich-api.

### 9. `g-features-batch.test.ts`
- **Tests**: `GET /api/accounts/[id]/contacts` + `getMomentum()` utility
- **Cases**: 7 (2 API + 5 momentum)
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`, `drizzle-orm` (for API tests only)
- **What it tests**: Momentum tests import real `getMomentum()` from `@/lib/momentum` — test 0 activities, 5+ in 7 days (high), 2-4 (medium), 1 (low), >7 days old (low)
- **Edge cases**: Good boundary testing on momentum
- **Score**: **MIXED** — momentum tests are **meaningful**, API tests are **weak**.

### 10. `g-features-batch2.test.ts`
- **Tests**: `POST /api/emails/follow-up`, `POST /api/emails/suggest-reply`, `detectLanguage()`, `getSystemPrompt()`
- **Cases**: 7 (2 API auth guards + 4 language + 1 system prompt)
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`, `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `drizzle-orm` (for API only)
- **What it tests**: Language detection covers fr/es/de/en; `getSystemPrompt` tests unknown language "xx"
- **Edge cases**: Good language detection coverage
- **Score**: **MIXED** — utility tests are **meaningful**, API tests are **useless** (auth guard only, no happy path).

### 11. `insights-api.test.ts`
- **Tests**: `GET /api/insights`
- **Cases**: 4
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`, `drizzle-orm`
- **What it tests**: Stalling deals (20+ days old), high-risk deals, win rate computation (2 won / 1 lost = 67%)
- **Edge cases**: Empty data, stall detection threshold, risk classification
- **Score**: **MEANINGFUL** — no AI mock. Tests real business logic (stall detection, risk classification, win rate).

### 12. `pipeline-analytics-api.test.ts`
- **Tests**: `GET /api/pipeline/analytics`
- **Cases**: 4
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`, `drizzle-orm`
- **What it tests**: totalDeals, activeDeals, winRate, avgDealValue, avgVelocityDays, totalPipelineValue, riskSummary, funnel, valueByStage — all with precise expected values
- **Edge cases**: Zero deals, mixed stages/values, null values
- **Score**: **MEANINGFUL** — the best test file. Verifies real computation with exact expected values (50% win rate, 28750 avg value, 30 day velocity).

### 13. `score-api.test.ts`
- **Tests**: `POST /api/score`
- **Cases**: 4
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`
- **What it tests**: Auth (401), missing companyIds (400), missing company, happy path with assertion `scored >= 0`
- **Edge cases**: None useful
- **Score**: **WEAK** — the scoring assertion (`>= 0`) would pass even for garbage output. The scoring algorithm (which is real code with real logic) is effectively untested.

### 14. `score-contacts-api.test.ts`
- **Tests**: `POST /api/score-contacts`
- **Cases**: 4
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`, `ai` (generateObject), `@ai-sdk/anthropic`, `@ai-sdk/openai`
- **What it tests**: Auth (401), missing contactIds (400), missing contact, mocked AI score
- **Edge cases**: None
- **Score**: **WEAK** — mocks all externals.

### 15. `search-tam-api.test.ts`
- **Tests**: `POST /api/search/tam`
- **Cases**: 5
- **Mocks**: `@/auth`, `@/lib/embeddings` (searchSimilar), `@/db`, `@/db/schema`
- **What it tests**: Auth (401), empty query (400), entity type filtering, empty results, hydration
- **Edge cases**: Entity type filtering is a useful check
- **Score**: **WEAK-TO-MODERATE** — tests hydration and filtering logic.

### 16. `sequences-api.test.ts`
- **Tests**: `GET /api/sequences` and `POST /api/sequences`
- **Cases**: 4
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`, `drizzle-orm`
- **What it tests**: Auth guards on GET/POST, empty name (400), creation (201)
- **Edge cases**: None
- **Score**: **WEAK** — tests guard clauses only.

### 17. `settings-api.test.ts`
- **Tests**: Knowledge, Workspace, Stages settings routes
- **Cases**: 5
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`, `drizzle-orm`
- **What it tests**: Auth guards, empty topic (400), default stages fallback (7+ stages when none configured)
- **Edge cases**: Default stages fallback is useful
- **Score**: **WEAK-TO-MODERATE** — stages fallback test is real logic.

### 18. `signals-api.test.ts`
- **Tests**: `POST /api/signals`
- **Cases**: 4
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`, `ai` (generateObject), `@ai-sdk/anthropic`, `@ai-sdk/openai`
- **What it tests**: Auth (401), missing companyIds (400), company with signals, company with empty signals
- **Edge cases**: Empty signals handling
- **Score**: **WEAK** — mocks all externals.

### 19. `tam-api.test.ts`
- **Tests**: `POST /api/tam` and `GET /api/tam`
- **Cases**: 5
- **Mocks**: `@/auth`, `@/db`, `@/db/schema`, `ai` (generateObject), `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@/lib/embeddings`, `drizzle-orm`
- **What it tests**: Auth (401), empty ICP (400), missing ICP (400), prompt verification, GET auth
- **Edge cases**: None useful
- **Score**: **WEAK** — mocks everything.

## Summary Table

| # | File | Cases | Mocks All? | Score | Real Logic Tested? |
|---|------|-------|-----------|-------|--------------------|
| 1 | actions-api | 2 | YES (db+auth+AI) | Weak | No |
| 2 | autopilot-api | 2 | db+auth | Weak | No |
| 3 | dashboard | 14 | NO | **Meaningful** | Yes (but inline funcs) |
| 4 | deals-api | 3 | YES (db+auth+AI) | Weak | No |
| 5 | deliverability-api | 4 | db+auth (no AI) | **Meaningful** | Yes |
| 6 | emails-api | 4 | YES (db+auth+AI) | Weak | No |
| 7 | enrich-api | 6 | YES (all) | Weak-Moderate | Orchestration only |
| 8 | enrich-contacts-api | 6 | YES (all) | Weak-Moderate | Orchestration only |
| 9 | g-features-batch | 7 | Partial | Mixed | Momentum = yes |
| 10 | g-features-batch2 | 7 | Partial | Mixed | Language = yes |
| 11 | insights-api | 4 | db+auth (no AI) | **Meaningful** | Yes |
| 12 | pipeline-analytics | 4 | db+auth (no AI) | **Meaningful** | Yes (best file) |
| 13 | score-api | 4 | db+auth (no AI) | Weak | No (assertion useless) |
| 14 | score-contacts-api | 4 | YES (db+auth+AI) | Weak | No |
| 15 | search-tam-api | 5 | db+auth+embeddings | Weak-Moderate | Filtering only |
| 16 | sequences-api | 4 | db+auth | Weak | No |
| 17 | settings-api | 5 | db+auth | Weak-Moderate | Stages fallback |
| 18 | signals-api | 4 | YES (db+auth+AI) | Weak | No |
| 19 | tam-api | 5 | YES (all) | Weak | No |

## Integration Tests: ZERO

No tests hit a real database, real auth provider, or real external API.

## E2E Tests: ZERO

No Playwright, Cypress, or browser-based tests.

## Real Test Coverage Assessment

| Metric | Value |
|--------|-------|
| Test files | 19 |
| Total test cases | 99 |
| Tests that exercise real logic | ~30 (dashboard, deliverability, insights, analytics, momentum, language) |
| Tests that only test mocked plumbing | ~50 |
| Tests that only test auth guards | ~19 (nearly every file has one) |
| Integration tests | 0 |
| E2E tests | 0 |
| Real coverage estimate | **~15-20%** of meaningful code paths |

## Systemic Problems

1. **8 of 19 files mock the AI SDK** — the core intelligence of those routes is never tested
2. **Every DB interaction is mocked** with hand-built chain stubs — SQL correctness never verified
3. **Auth is universally mocked** — no test verifies actual session/token validation
4. **The most common test is "401 on no auth"** — present in 18/19 files, testing the same 1-line check 18 times
5. **`dashboard.test.ts` defines functions inline** instead of importing them — tests could pass while real code diverges
6. **`score-api.test.ts`** asserts `scored >= 0` — would pass for any non-negative number
7. **No error handling tests** — no test verifies behavior when DB throws, AI returns malformed data, or network fails
8. **No concurrent access tests** — multi-user scenarios never tested
