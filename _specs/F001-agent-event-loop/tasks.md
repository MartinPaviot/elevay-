# F001 — Agent Event Loop: Tasks

## T1: Create `agent_reactions` table migration
- Add new Drizzle schema for `agent_reactions` table
- Generate migration with `drizzle-kit generate`
- Verify: migration file exists in `drizzle/` directory
- Test: table can be created in dev DB

## T2: Create agent reactor Inngest function
- New file: `inngest/agent-reactor.ts`
- Subscribe to `agent/react` event
- Implement deduplication check (60min window)
- Implement context loading (entity + activities + sequences + signals + past actions)
- Implement LLM decision call (Haiku 4.5, structured output)
- Implement rule-based fallback heuristics
- Implement action dispatch through `enforceAgentApprovalMode`
- Record decision to `agent_reactions` table
- Verify: function registered in Inngest serve route
- Test: unit test with mocked event → correct decision recorded

## T3: Create context loader utility
- New file: `lib/agent-reactor/context-loader.ts`
- Function: `loadReactorContext(tenantId, entityType, entityId)`
- Returns: entity data, recent activities, active sequences, signals, past actions, ICP
- Budget: <4000 tokens serialized
- Verify: context loads in <500ms for typical entity
- Test: unit test with known entity → correct context shape

## T4: Create decision prompt
- New file: `lib/agent-reactor/decision-prompt.ts`
- System prompt for the reactor agent (concise, structured)
- User prompt template with context slots
- JSON schema for decision output
- Verify: prompt fits in 1500 tokens
- Test: prompt generates valid decisions for each trigger type

## T5: Wire emitters — Resend webhook
- Modify: `app/api/webhooks/resend/route.ts`
- After processing open/click/bounce: fire `agent/react` event
- Include deduplication key, entity references
- Verify: webhook still processes normally
- Test: simulate webhook → `agent/react` event fired

## T6: Wire emitters — EmailEngine webhook
- Modify: `app/api/webhooks/emailengine/route.ts`
- After processing messageNew: fire `agent/react` with trigger=`email_replied` or `inbound_email`
- After processing messageBounce: fire `agent/react` with trigger=`email_bounced`
- Verify: existing reply handling still works
- Test: simulate webhook → event fired

## T7: Wire emitters — Signal detection
- Modify: `inngest/signal-to-sequence.ts` or signal evaluation functions
- After signal detected: fire `agent/react` with trigger=`signal_detected`
- Before existing auto-enroll logic (agent reactor may handle enrollment itself)
- Verify: signal detection still works
- Test: signal fire → event emitted

## T8: Wire emitters — Enrichment completion
- Modify: `inngest/functions.ts` enrichCompany / enrichContact
- After enrichment completes: fire `agent/react` with trigger=`contact_enriched`
- Verify: enrichment flow unchanged
- Test: enrichment complete → event fired

## T9: Create daily sweep for deal staleness
- New Inngest cron function in `agent-reactor.ts`
- Cron: `0 8 * * *` (daily 8am UTC)
- Query deals with no activity in >7 days
- Fire `agent/react` for each with trigger=`deal_stale`
- Skip deals already evaluated in last 24h
- Verify: only stale deals without recent evaluation are processed
- Test: stale deal → event fired, fresh deal → skipped

## T10: Downgrade existing autonomous-pipeline cron to fallback
- Modify: `inngest/autonomous-pipeline.ts`
- Add check: skip deals that have an `agent_reactions` entry in last 24h
- Log: "skipped — already evaluated by event loop"
- Verify: cron still runs for deals without events
- Test: deal with recent reaction → skipped, deal without → processed

## T11: Register in Inngest serve route
- Add new functions to `app/api/inngest/route.ts`
- Verify: functions appear in Inngest dashboard
- Test: deploy and verify registration

## T12: Write integration test
- New file: `__tests__/agent-reactor.test.ts`
- Test scenarios:
  - Email opened → agent evaluates, records reaction
  - Duplicate event within 60min → skipped
  - Signal detected → agent creates deal or enrolls
  - Deal stale → agent creates follow-up task
  - LLM unavailable → fallback heuristics work
  - Approval mode respected (review-each → action queued)
- Verify: all tests pass
