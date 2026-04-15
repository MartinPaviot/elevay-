# CHAT-01 — Design

## System fit

The registry refactor moves tool definitions out of `app/apps/web/src/app/api/chat/route.ts` (1732 lines) into category-scoped factory modules under `app/apps/web/src/lib/chat/tools/`. The POST handler becomes a thin orchestrator.

```
app/apps/web/src/
├── app/api/chat/route.ts          # POST handler (≤450 lines)
└── lib/chat/tools/
    ├── context.ts                 # ToolContext type + makeTool helper
    ├── query.ts                   # build queryTools(ctx)
    ├── create.ts                  # build createTools(ctx)
    ├── update.ts                  # build updateTools(ctx)
    ├── action.ts                  # build actionTools(ctx)  (draftEmail, proposeCampaign)
    ├── memory.ts                  # build memoryTools(ctx)  (remember/recall/exploreGraph)
    ├── intelligence.ts            # build intelligenceTools(ctx)  (getDealCoaching, getAccountIntelligence, generateMeetingPrep, getMeetingNotes)
    ├── skills.ts                  # build skillsTools(ctx)  (20 runSkill-backed tools)
    └── index.ts                   # buildAllChatTools(ctx) aggregator
```

## Data model — no schema change

This phase is code organization only. Later phases:
- CHAT-04 adds `toolCallEvents` table for audit + undo.
- CHAT-05 extends `chatMessages` with `parentMessageId` + `branchId` for tree/fork.
- CHAT-06 adds `researchJobs` + `aiAttributeRuns` for long-running.

## Core types

### ToolContext

```ts
// lib/chat/tools/context.ts
import type { AuthContext } from "@/lib/auth-utils";
import type { TenantSettings } from "@/lib/tenant-settings";
import { tool } from "ai";
import { z } from "zod";

export interface ToolContext {
  tenantId: string;
  userId: string;           // alias for authCtx.appUserId for readability
  authCtx: AuthContext;
  settings: TenantSettings;
  agentApprovalMode: "auto" | "ask" | "off";
}

export function makeTool<I>(opts: {
  description: string;
  inputSchema: z.ZodType<I>;
  execute: (input: I) => Promise<unknown>;
}) {
  return tool<I, unknown>({
    description: opts.description,
    inputSchema: opts.inputSchema,
    execute: opts.execute,
  } as any);
}
```

### Factory convention

Each category exports a single builder:

```ts
// lib/chat/tools/query.ts
export function buildQueryTools(ctx: ToolContext) {
  return {
    searchCRM: makeTool({ ... }),
    queryContacts: makeTool({ ... }),
    // ...
  };
}
```

### Aggregator

```ts
// lib/chat/tools/index.ts
export function buildAllChatTools(ctx: ToolContext) {
  return {
    ...buildQueryTools(ctx),
    ...buildCreateTools(ctx),
    ...buildUpdateTools(ctx),
    ...buildActionTools(ctx),
    ...buildMemoryTools(ctx),
    ...buildIntelligenceTools(ctx),
    ...buildSkillsTools(ctx),
  };
}
```

Key ordering invariant: **later spread overrides earlier.** If a tool name collides (it shouldn't, per AC2), later wins. The aggregator's spread order is therefore meaningful — keep it stable.

## API contracts

### route.ts after refactor

```ts
export async function POST(req: Request) {
  // auth, rate limit, messages parse, model selection, context assembly
  // (unchanged from pre-refactor, only tool definition is moved)

  const toolCtx: ToolContext = {
    tenantId: authCtx.tenantId,
    userId: authCtx.appUserId,
    authCtx,
    settings: tenantSettings,
    agentApprovalMode,
  };
  const chatTools = buildAllChatTools(toolCtx);

  const result = await tracedStreamText({
    model, system: systemPrompt, messages, tools: chatTools,
    // ...
  });
  return result.toTextStreamResponse();
}
```

## Data flow

```
User message
    │
    ▼
POST /api/chat
    │
    ├─► getAuthContext → authCtx
    ├─► getTenantSettings → settings
    ├─► parallel: RAG context, CRM snapshot, entity context, memories
    ├─► buildChatSystemPrompt → systemPrompt
    ├─► buildAllChatTools(ctx) → chatTools  ← THIS IS THE NEW BIT
    └─► tracedStreamText({ model, system, messages, tools: chatTools })
         │
         ▼
    tool-call → execute(input) from lib/chat/tools/<category>.ts
         │
         ▼
    result streamed back to client
```

## Failure handling

1. **Import cycles** — tools can import from `@/lib/*` (existing libs) and `@/db` but **never** from `@/app/api/*`. If a tool needs endpoint logic, extract it to `@/lib/<domain>/*`.
2. **Dynamic imports preserved** — skills tools currently use `await import("@/skills/runner")` lazily. Keep this pattern to avoid pulling 20+ skill modules into every chat request.
3. **Closure hygiene** — no tool should capture `authCtx` across files (security risk). The context object is the only allowed handle on auth state. If `authCtx.appUserId` is needed, use `ctx.userId`.
4. **Type safety** — `makeTool<I>` generic preserves the zod-derived input type. Don't widen to `any` in new tools.

## Security considerations

No new surface in CHAT-01 refactor. The tool-level auth is unchanged: every tool reads `ctx.tenantId` and scopes DB queries by it. The capability resolver (CHAT-02) adds an additional filter layer on top.

**Guardrail preserved**: the existing `agentApprovalMode` branches in `createContact/Account/Deal` stay intact — the refactor does not alter the approval-gate semantics.

## Test strategy

- Snapshot test of `Object.keys(buildAllChatTools(fakeCtx))` sorted — catches accidental deletions.
- Per-category unit test mocking `db` + `authCtx` — assert tool runs against a simulated call, tenant-isolation verified.
- Regression: existing 264 tests already exercise many flows; they stay green.

## Out of scope (reminder)

- Capability resolver (CHAT-02)
- Surfaces + side-panel chat (CHAT-03)
- Undo + persistence (CHAT-04)
