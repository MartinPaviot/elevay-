# F002 — Agent State Machine: Tasks

## T1: Create `agent_work_items` table migration
- Add Drizzle schema for `agent_work_items`
- Generate migration
- Verify: table created with correct indexes

## T2: Create work item CRUD utilities
- New file: `lib/agent-state/work-items.ts`
- Functions: `upsertWorkItem()`, `getWorkItem()`, `getTopWorkItems()`, `archiveWorkItem()`
- `upsertWorkItem`: create or update based on (tenantId, entityType, entityId)
- `getTopWorkItems(tenantId, limit=10)`: ordered by priority then updated_at
- `archiveWorkItem(id, reason)`: set status=archived
- Test: unit tests for each function

## T3: Create context serializer
- New file: `lib/agent-state/serialize.ts`
- Function: `serializeWorkQueue(items): string` — for chat prompt
- Function: `serializeWorkItem(item): string` — for reactor context
- Budget: work queue serialization <800 tokens for 10 items
- Test: serialization output matches expected format

## T4: Integrate with agent reactor (F001)
- After reactor decision: upsert work item
- Before reactor decision: load existing work item for entity
- Include work item in reactor context
- Test: reactor event → work item created/updated

## T5: Integrate with chat system prompt
- Modify: `lib/prompts/chat-system-prompt.ts`
- Add "Active Work Queue" section with top 10 items
- Load via `getTopWorkItems()` in chat route context loading
- Test: chat response references work queue naturally

## T6: Create archival triggers
- Inngest event handler: `deal_won` / `deal_lost` → archive work item
- Cron: monthly stale work item cleanup (no eval in 30 days)
- Chat tool: `pauseWorkItem` / `archiveWorkItem` for user override
- Test: deal closure → work item archived

## T7: Write integration test
- Test: full lifecycle — event creates work item → subsequent event updates → deal closes → archived
- Test: chat loads work queue → agent references it in response
- Test: stale archival works correctly
