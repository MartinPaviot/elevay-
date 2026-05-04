# Campaign Engine 1000x — Tasks

## Phase A: Database & Types (2 days)

### Task A.1: Create TypeScript interfaces

**File:** `app/apps/web/src/lib/campaign-engine/types.ts`

- Define all interfaces from design.md: `IntelligenceBrief`, `StrategyCandidate`, `StrategyType`, `AutonomyConfig`, `GuardrailsConfig`, `EscalationRule`, `BrandConfig`, etc.
- Export all types.

**Verify:** `npx tsc --noEmit` passes with new file.

---

### Task A.2: Add schema tables to Drizzle

**File:** `app/apps/web/src/db/schema.ts`

- Add `intelligenceBriefs` table definition
- Add `outreachPlaybooks` table definition
- Add `enrollmentStrategy` table definition
- Add `autonomyConfig` table definition
- Add `systemTrustScore` table definition
- Add `contentVariants` table definition
- Add proper indexes and foreign keys as specified in design.md

**Verify:** `npx drizzle-kit generate` produces a valid migration without errors.

---

### Task A.3: Run migration

- Apply the generated migration to the dev database.
- Verify tables exist with correct columns.

**Verify:** `npx drizzle-kit push` succeeds. Query each new table with `SELECT 1 FROM <table> LIMIT 0`.

---

### Task A.4: Seed default playbooks

**File:** `app/apps/web/src/lib/campaign-engine/playbook-defaults.ts`

- Create a function `seedDefaultPlaybooks(tenantId)` that inserts 10 playbook rows (one per strategy type) with `is_active: true` and null `custom_system_prompt`.
- Call this function during tenant creation (or on first campaign engine access).

**Verify:** After calling `seedDefaultPlaybooks`, query returns 10 rows for the tenant.

---

## Phase B: Intelligence Brief (5 days)

### Task B.1: Website scraper

**File:** `app/apps/web/src/lib/campaign-engine/sources/website.ts`

- Implement `scrapeCompanyWebsite(domain: string): Promise<WebsiteResult>`
- Fetch homepage with 10s timeout, follow redirects
- Parse with cheerio: extract meta description, first 3000 chars of body text, H1/H2 headings
- Return `{ rawText, metaDescription, headings, fetchedAt }` or `null` on failure

**Verify:** Unit test with mocked HTTP responses (200, 403, timeout). Confirm soft-fail returns null.

---

### Task B.2: News fetcher

**File:** `app/apps/web/src/lib/campaign-engine/sources/news.ts`

- Implement `fetchRecentNews(companyName: string, daysBack: number): Promise<NewsItem[]>`
- Use Google News RSS feed (free, no API key): `https://news.google.com/rss/search?q={company}&hl=en`
- Parse RSS XML, extract top 5 items within `daysBack`
- For each: title, link, pubDate, snippet

**Verify:** Unit test with mocked RSS XML. Returns 0-5 NewsItem objects.

---

### Task B.3: Job postings scraper

**File:** `app/apps/web/src/lib/campaign-engine/sources/jobs.ts`

- Implement `scrapeJobPostings(domain: string): Promise<JobPosting[]>`
- Strategy: try `${domain}/careers`, `${domain}/jobs`, common ATS patterns (greenhouse.io, lever.co, ashbyhq.com)
- Parse: extract job titles, departments if visible
- Return max 10 most recent postings

**Verify:** Unit test with mocked careers page HTML. Correctly extracts job titles.

---

### Task B.4: Tech stack detector

**File:** `app/apps/web/src/lib/campaign-engine/sources/tech-stack.ts`

- Implement `detectTechStack(domain: string): Promise<TechEntry[]>`
- Use `wappalyzer-core` library (open source, runs locally, no API cost)
- Alternatively: analyze page source for known script patterns (GA, Segment, Intercom, HubSpot, etc.)
- Return detected tools with category and confidence

**Verify:** Unit test against known sites. Detects at least 3 technologies on a typical SaaS homepage.

---

### Task B.5: LinkedIn activity fetcher

**File:** `app/apps/web/src/lib/campaign-engine/sources/linkedin.ts`

- Implement `fetchLinkedInActivity(linkedinUrl: string): Promise<LinkedInActivity | null>`
- Strategy: fetch the public profile page (no login required for basic data)
- Extract: recent activity section if visible, estimate posting frequency
- If profile is private or data insufficient: return null (soft-fail)
- Note: this is best-effort. LinkedIn blocks aggressive scraping.

**Verify:** Unit test with mocked profile HTML. Returns null on private profiles.

---

### Task B.6: LLM synthesis

**File:** `app/apps/web/src/lib/campaign-engine/brief-synthesizer.ts`

- Implement `synthesizeBrief(sources: RawSources, contact, company): Promise<SynthesizedBrief>`
- Call Claude Sonnet with structured output
- System prompt instructs: extract pain points, determine best outreach angle, assess communication style, count citable public content
- Handle timeout: if LLM takes > 15s, return partial brief with raw data only

**Verify:** Integration test with real Claude API call (or mocked). Output matches IntelligenceBrief shape.

---

### Task B.7: Brief orchestrator (main entry point)

**File:** `app/apps/web/src/lib/campaign-engine/build-intelligence-brief.ts`

- Implement `buildIntelligenceBrief(companyId, contactId?, tenantId, options?): Promise<IntelligenceBrief>`
- Check cache first (SELECT from intelligence_briefs WHERE not expired)
- If cache miss: run all sources in parallel via `Promise.allSettled`
- Count attempted/succeeded sources
- Call synthesizer
- UPSERT result into intelligence_briefs table
- Return brief

**Verify:** Integration test: first call generates, second call returns cached, force-refresh bypasses cache.

---

### Task B.8: API route

**File:** `app/apps/web/src/app/api/campaign-engine/research/route.ts`

- POST handler: auth check, validate body, call `buildIntelligenceBrief`
- Handle concurrent dedup: if generation already in-flight (check a semaphore/lock), return 202
- Rate limit: max 5 concurrent per tenant

**Verify:** API test: call with valid companyId returns 200 with brief. Call with unknown ID returns 404.

---

## Phase C: Strategy Selector (3 days)

### Task C.1: Playbook activation conditions

**File:** `app/apps/web/src/lib/campaign-engine/playbook-conditions.ts`

- Define activation conditions for each of the 10 playbooks as pure functions:
  ```typescript
  function scoreWarmIntro(brief, warmPath, signals, history): { score: number; reason: string }
  function scoreTriggerBased(brief, warmPath, signals, history): { score: number; reason: string }
  // ... 8 more
  ```
- Each function returns a score 0-100 and a reason string
- No I/O, no async — pure computation

**Verify:** Unit tests for each function with various input scenarios. Edge case: all inputs empty → score 0.

---

### Task C.2: Warm path resolver (basic)

**File:** `app/apps/web/src/lib/campaign-engine/warm-path.ts`

- Implement `findWarmPath(tenantId, targetContactId): Promise<WarmPath | null>`
- Query context_graph_edges: find edges from team member nodes to target node (max depth 2)
- Use a simple BFS with SQL (recursive CTE or 2 queries for depth 1 + depth 2)
- Return: `{ distance, connectorNodeId, connectorName, lastActiveAt }`

**Verify:** Integration test: insert test graph nodes/edges, verify BFS finds correct path.

---

### Task C.3: Strategy selector main function

**File:** `app/apps/web/src/lib/campaign-engine/select-strategy.ts`

- Implement `selectStrategy(companyId, contactId, tenantId): Promise<StrategyCandidate[]>`
- Load: brief, warm path, active signals, competitor, previous outreach history
- Run all 10 playbook scoring functions
- Apply penalties (previous failure: -20, opted-out channel: -∞ for that strategy)
- Sort by score, return top 3 (or fewer if only 1-2 score > 0)
- Deterministic: same DB state → same result

**Verify:** Unit test with mocked data loads. Verify warm_intro scores highest when path exists. Verify long_game is fallback.

---

### Task C.4: API route

**File:** `app/apps/web/src/app/api/campaign-engine/strategy/route.ts`

- GET handler: auth check, validate query params, call `selectStrategy`
- Return 409 if brief doesn't exist yet
- Include metadata: briefUsed, warmPathAvailable, signalsActive

**Verify:** API test: call with companyId that has brief → 200 with candidates. Call without brief → 409.

---

## Phase D: Autonomy Config (4 days)

### Task D.1: Autonomy defaults and level presets

**File:** `app/apps/web/src/lib/campaign-engine/autonomy-defaults.ts`

- Define `LEVEL_DEFAULTS: Record<AutonomyLevel, PermissionsMap>` with default permissions per level
- Define `mergeAutonomyConfig(level, overrides)` that produces the effective config
- Define `getEffectivePermission(actionType, config): PermissionValue`

**Verify:** Unit test: merging overrides with level defaults produces correct result.

---

### Task D.2: Trust score computation

**File:** `app/apps/web/src/lib/campaign-engine/trust-score.ts`

- Implement `updateTrustScore(tenantId, event: TrustEvent): Promise<number>`
- Event types and deltas:
  - approved_without_edit: +2
  - approved_with_minor_edit: +1
  - rejected: -3
  - email_positive_reply: +5
  - email_negative_reply: -2
  - meeting_booked: +10
  - factual_error: -5
  - wrong_person: -10
  - escalation_warranted: +3
- Clamp to [0, 100]
- Check for auto-downgrade (< 40) or upgrade suggestion (> 80 for 14 days)
- UPSERT system_trust_score row

**Verify:** Unit test: starting at 50, apply sequence of events, verify final score and downgrade trigger.

---

### Task D.3: Execution gate

**File:** `app/apps/web/src/lib/campaign-engine/execution-gate.ts`

- Implement `gateAction(action, enrollment, tenantId): Promise<GateResult>`
- GateResult: `{ status: "execute" | "delayed" | "queued_for_approval" | "blocked", reason?, delay? }`
- Check order: guardrails → escalation rules → permission level
- Log every decision to a new `campaign_action_log` (reuse existing `agentActions` table)

**Verify:** Unit test: action that violates guardrail → blocked. Action at "delayed" permission → delayed with correct timer. Action at "auto" → execute.

---

### Task D.4: API route for autonomy settings

**File:** `app/apps/web/src/app/api/settings/autonomy/route.ts`

- GET: return current config + trust score
- PUT: validate + update config. Reject upgrade to Strategic if trust < 80.
- Auto-create config with copilot defaults on first GET if not exists.

**Verify:** API test: PUT with valid config → 200. PUT upgrading to Strategic with low trust → 403.

---

### Task D.5: API route for trust score

**File:** `app/apps/web/src/app/api/campaign-engine/trust-score/route.ts`

- GET: return full trust breakdown with trend and suggestions
- Trend: compare current score to 7-days-ago score

**Verify:** API test: returns valid shape with trend.

---

### Task D.6: Autonomy settings UI page

**File:** `app/apps/web/src/app/(dashboard)/(rest)/settings/autonomy/page.tsx`

- Level selector (4 radio options with descriptions)
- Permission overrides grid (per action type)
- Guardrails form (limits, blacklist, escalation rules)
- Brand configuration (style, forbidden words, signature)
- Trust score display with trend and upgrade suggestion
- Save button → PUT /api/settings/autonomy

**Verify:** Start dev server, navigate to /settings/autonomy. All controls render. Save persists to DB.

---

## Phase E: Integration (3 days)

### Task E.1: Replace buildProspectContext in campaign generation

**File:** `app/apps/web/src/app/api/campaigns/generate/route.ts`

- Import `buildIntelligenceBrief` instead of `buildProspectContext`
- Map IntelligenceBrief fields to the expected ProspectContext shape (adapter pattern)
- Keep `buildProspectContext` intact for other callers (non-breaking)

**Verify:** Campaign generation still works. Generated emails reference brief data (news, pain points).

---

### Task E.2: Add strategy selection to campaign wizard

**File:** `app/apps/web/src/components/campaign-wizard.tsx`

- After target selection (step 1), call `/api/campaign-engine/research` for top companies
- Display brief summaries in the "generating" step (show research happening)
- Show selected strategy per prospect in the review step
- Optional: let user override strategy pick before launch

**Verify:** Campaign wizard shows strategy reasoning per prospect in review step.

---

### Task E.3: Wire execution gate into outbound send

**File:** `app/apps/web/src/inngest/campaign-functions.ts` (or equivalent)

- Before sending any outbound email, call `gateAction()`
- Handle each GateResult:
  - execute → send immediately
  - delayed → schedule with Inngest sleep
  - queued_for_approval → create approval request (use existing approvals system)
  - blocked → log + skip

**Verify:** Integration test: with Copilot config, emails go to approval queue. With Autonomous config, emails send directly.

---

### Task E.4: Trust score events from existing flows

- In reply-handler.ts: emit trust events on reply classification
- In approval flow: emit trust events on approve/reject/edit
- In outbound webhooks: emit on positive reply, bounce, etc.

**Verify:** After approving 5 emails without edit, trust score increases by ~10 points.

---

## Phase F: Testing (2 days)

### Task F.1: Unit tests for strategy selector

**File:** `app/apps/web/src/__tests__/strategy-selector.test.ts`

Test cases:
- Warm path exists → warm_intro scores highest
- Fresh signal + no warm path → trigger_based scores highest
- Rich LinkedIn + no signal → smykm or social_first
- Nothing available → long_game only
- Previous failed strategy → penalized
- All 10 playbooks have at least one scenario where they win

**Verify:** `npm test -- strategy-selector` passes.

---

### Task F.2: Unit tests for trust score

**File:** `app/apps/web/src/__tests__/trust-score.test.ts`

Test cases:
- Initial score is 50
- 10 approvals without edit → score rises to ~70
- 3 rejections in a row → score drops below 40 → triggers downgrade
- Score never goes below 0 or above 100
- Actions before minimum threshold (10) → "building trust" state

**Verify:** `npm test -- trust-score` passes.

---

### Task F.3: Unit tests for execution gate

**File:** `app/apps/web/src/__tests__/execution-gate.test.ts`

Test cases:
- Guardrail maxEmailsPerDay reached → blocked
- Prospect in neverContact list → blocked
- Escalation rule matches → queued_for_approval
- Permission "delayed" → returns delayed with correct timer
- Permission "auto" → returns execute
- Multiple guardrails: first violation wins

**Verify:** `npm test -- execution-gate` passes.

---

### Task F.4: Integration test for brief generation

**File:** `app/apps/web/src/__tests__/intelligence-brief.integration.test.ts`

- Mock external HTTP calls (website, news RSS, careers page)
- Verify brief is generated with all fields populated from mocked sources
- Verify cache: second call returns same brief without HTTP calls
- Verify soft-fail: one source 500 → brief still generated from others
- Verify force-refresh bypasses cache

**Verify:** `npm test -- intelligence-brief.integration` passes.

---

### Task F.5: E2E smoke test

**File:** `app/apps/web/src/__tests__/campaign-engine-e2e.test.ts`

Full flow:
1. Create a company + contact in test DB
2. Call POST /api/campaign-engine/research → brief generated
3. Call GET /api/campaign-engine/strategy → candidates returned
4. Verify autonomy gate: with copilot config, action is queued
5. Approve the action → trust score increases

**Verify:** `npm test -- campaign-engine-e2e` passes.

---

## Summary

| Phase | Tasks | Estimated days | Depends on |
|---|---|---|---|
| A: DB & Types | A.1–A.4 | 2 | None |
| B: Intelligence Brief | B.1–B.8 | 5 | A |
| C: Strategy Selector | C.1–C.4 | 3 | A, B (for brief data) |
| D: Autonomy Config | D.1–D.6 | 4 | A |
| E: Integration | E.1–E.4 | 3 | B, C, D |
| F: Testing | F.1–F.5 | 2 | B, C, D |
| **Total** | **27 tasks** | **~19 days** | |

Phases B, C, D can partially overlap (D has no dependency on B/C until integration).
Realistic critical path: A → (B + D in parallel) → C → E → F = **~14 days**.
