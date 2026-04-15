# CHAT-01 — Tasks

The full list of tool-creation tasks is in `_specs/CHAT-00-coverage-audit/tasks.md` §CHAT-01 tasks. This file tracks the **refactor task 1.0** sub-breakdown and any CHAT-01-specific additions discovered mid-implementation.

## Task 1.0 — Refactor existing 44 tools (in order)

### 1.0.0 — Scaffolding
- **Action**: create `app/apps/web/src/lib/chat/` directory; create `lib/chat/tools/context.ts` with `ToolContext` type + `makeTool` helper.
- **Verify**: file exists, imports are valid (`tool` from `ai`, `z` from `zod`, `AuthContext` from `@/lib/auth-utils`, `TenantSettings` from `@/lib/tenant-settings`).

### 1.0.1 — Extract query tools
- **Scope**: searchCRM, queryContacts, queryAccounts, queryDeals, queryActivities, queryNotes, queryTasks (7 tools).
- **File**: `lib/chat/tools/query.ts` exporting `buildQueryTools(ctx: ToolContext)`.
- **Dependencies**: `db`, `companies`, `contacts`, `deals`, `activities`, `notes`, `tasks` from `@/db/schema`; `searchSimilar` from `@/lib/embeddings`.
- **Verify**: `buildQueryTools(ctx)` returns object with 7 keys matching tool names.

### 1.0.2 — Extract create tools
- **Scope**: createContact, createAccount, createDeal, createTask (4 tools).
- **File**: `lib/chat/tools/create.ts` exporting `buildCreateTools(ctx: ToolContext)`.
- **Note**: preserve the `agentApprovalMode === "ask"` branching logic inside each tool exactly as it existed pre-refactor.

### 1.0.3 — Extract update tools
- **Scope**: updateDealStage, completeTask, bulkUpdateDeals, bulkUpdateContacts (4 tools).
- **File**: `lib/chat/tools/update.ts` exporting `buildUpdateTools(ctx: ToolContext)`.

### 1.0.4 — Extract action tools
- **Scope**: draftEmail, proposeCampaign (2 tools).
- **File**: `lib/chat/tools/action.ts` exporting `buildActionTools(ctx: ToolContext)`.
- **Note**: draftEmail uses dynamic import of `@/lib/writing-profile`; keep it inside the execute function.

### 1.0.5 — Extract memory tools
- **Scope**: rememberContext, recallMemories, exploreGraph (3 tools).
- **File**: `lib/chat/tools/memory.ts` exporting `buildMemoryTools(ctx: ToolContext)`.

### 1.0.6 — Extract intelligence tools
- **Scope**: getDealCoaching, getAccountIntelligence, generateMeetingPrep, getMeetingNotes (4 tools).
- **File**: `lib/chat/tools/intelligence.ts` exporting `buildIntelligenceTools(ctx: ToolContext)`.

### 1.0.7 — Extract skills tools
- **Scope**: analyzePipeline, scanSignals, generateBattlecard, researchCompetitor, detectChurnRisk, analyzeSequencePerformance, findLeadsAtCompany, detectExpansionOpportunities, buildTAM, findLeadsByDomain, defineICP, prepSalesCall, qualifyLeads, qualifyInboundLead, enrichContact, checkDuplicates, trackChampions, checkFundingSignals, checkHiringSignals, detectLeadershipChanges (20 tools).
- **File**: `lib/chat/tools/skills.ts` exporting `buildSkillsTools(ctx: ToolContext)`.
- **Note**: preserve the `await import("@/skills/runner")` pattern — don't hoist to static imports (lazy-load is intentional).

### 1.0.8 — Aggregator
- **File**: `lib/chat/tools/index.ts` exporting `buildAllChatTools(ctx)`.

### 1.0.9 — Rewire route.ts
- **Action**: replace inline `chatTools = { ... }` block with `const chatTools = buildAllChatTools(toolCtx)`.
- **Delete**: the inline schemas (searchCRMSchema etc.), the inline `makeTool` definition, the entire `chatTools` block.
- **Keep**: POST handler, auth/rate-limit, parallel context fetch (RAG, snapshot, entity, memories), system prompt build, `tracedStreamText` call.

### 1.0.10 — Verify
- `pnpm --filter web typecheck` clean.
- `pnpm --filter web test` — existing tests pass.
- Manual smoke: send a query in `/chat` → tool fires.

### 1.0.11 — Commit
- Single commit "refactor(chat): extract 44 tools to lib/chat/tools/ by category".
- Trailers: Rippletide + Claude.

## Tasks 1.1–1.74

Pre-enumerated in `_specs/CHAT-00-coverage-audit/tasks.md`. Implemented in follow-up commits/sub-branches under `feat/CHAT-01-tool-registry`.

Priority order for shipping:
1. **Wave 1 non-destructive** (tasks 1.1–1.24 minus 1.25 merge + 1.26 delete) — 22 tools
2. **Wave 3 foundational** (tasks 1.50–1.51 listSchema) — unblocks custom schema awareness
3. **Wave 2 settings** (tasks 1.27–1.49 minus destructive) — 20 tools
4. **Wave 3 remaining** (tasks 1.52–1.74) — 23 tools + endpoints
5. **Gated destructive** (1.25, 1.26, 1.30, 1.41, 1.45, 1.59, etc.) — wait for CHAT-04

## Exit criteria

- `route.ts` ≤ 450 lines.
- `lib/chat/tools/` has 9 files, total ~1500 lines (roughly equal to the chunk removed from route.ts).
- 264 tests pass.
- ~95+ tools in registry post-Wave-1 shipping.
