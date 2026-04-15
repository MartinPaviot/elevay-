# CHAT-01 — Requirements

## User story

> As the LeadSens team, I want the chat tool registry to be **modular, testable, and completeness-auditable** so that (a) the 87KB `route.ts` stops being a bottleneck and (b) we can ship ~50 new tools without merge conflicts or regression risk.

## Scope

- **Task 1.0** — refactor existing 44 tools from `app/apps/web/src/app/api/chat/route.ts` into `app/apps/web/src/lib/chat/tools/<category>.ts` files organized by the taxonomy defined in `_specs/CHAT-00-coverage-audit/design.md` §Taxonomy.
- **Tasks 1.1–1.49** — ship Gap-A + Gap-B tools per `_specs/CHAT-00-coverage-audit/tasks.md`.
- **Tasks 1.50–1.74** — ship new-tool-needs-new-endpoint set.

## Acceptance criteria

### AC1 — Refactor preserves behavior
- **GIVEN** the chat registry pre-refactor (44 tools defined inline in `route.ts`)
- **WHEN** the refactor completes and `pnpm test` runs
- **THEN** the 264 existing tests pass unchanged
- **AND** a snapshot test verifies tool names + descriptions match pre-refactor 1:1
- **AND** the chat streaming behavior is unchanged (same `tools:` payload shape to `tracedStreamText`)

### AC2 — File layout matches taxonomy
- **GIVEN** the refactor is complete
- **WHEN** I list `app/apps/web/src/lib/chat/tools/`
- **THEN** I see: `context.ts`, `query.ts`, `create.ts`, `update.ts`, `action.ts`, `memory.ts`, `intelligence.ts`, `skills.ts`, `index.ts`
- **AND** each category file exports a single `build<Category>Tools(ctx: ToolContext)` factory

### AC3 — Context boundary is explicit
- **GIVEN** `context.ts`
- **WHEN** a new tool is written
- **THEN** it receives `ToolContext { tenantId, userId, authCtx, settings, agentApprovalMode }` as its only external dependency
- **AND** no tool reaches outside the context object for auth/tenant data (no direct `getAuthContext` calls inside tools)

### AC4 — route.ts is thinned
- **GIVEN** the refactor is complete
- **WHEN** I count lines of `app/apps/web/src/app/api/chat/route.ts`
- **THEN** it is ≤ 450 lines (down from 1732)
- **AND** it contains only: POST handler, context assembly, system prompt build, registry composition via `buildAllChatTools(ctx)`, streamText invocation

### AC5 — New tool landing pattern is one-file
- **GIVEN** CHAT-01 task 1.5 asks to add `createNote`
- **WHEN** a developer adds it
- **THEN** the only file changed is `lib/chat/tools/create.ts`
- **AND** adding a test file + a spec note are the only other writes

### AC6 — Wave 1 Gap-A tools ship
Per `_specs/CHAT-00-coverage-audit/tasks.md` tasks 1.1–1.26, ≥ 22 new tools shipped (4 destructive gated until CHAT-04). Each has: zod schema, factory entry, test, route-backed execution. Accepted in a follow-up commit series.

### AC7 — Capability resolver ready
- **GIVEN** the modular layout
- **WHEN** CHAT-02 lands the capability resolver
- **THEN** it can filter `buildAllChatTools(ctx)` output by category without code churn in category files

## Out of scope

- Writing the capability resolver (CHAT-02).
- UI changes (CHAT-03).
- Tool-call persistence + undo (CHAT-04).
- Destructive tool execution paths (scaffolded but gated pending CHAT-04).

## Evaluation steps

1. `git diff main -- app/apps/web/src/app/api/chat/route.ts` shows net deletion of ~1280 lines.
2. `pnpm typecheck` clean.
3. `pnpm test` — 264+ tests pass (no regression).
4. Manual smoke: `pnpm dev`, open `/chat`, send "list my deals" → tool call `queryDeals` fires, returns results.
5. Count tools in new registry (`grep -c 'makeTool(' lib/chat/tools/*.ts`) — expect ≥ 44 + any Wave 1 additions.
