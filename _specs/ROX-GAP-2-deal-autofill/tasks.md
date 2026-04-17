# ROX-GAP-2 — Tasks

## T1: Create `syncSignalsToDeal` Inngest function
- File: `src/inngest/deal-signal-sync.ts`
- Trigger: `enrichment/signals-extracted`
- Input: `{ tenantId, activityId, contactId, signals }`
- Logic: find open deals for contact → merge signals into `deal.properties`
- Verify: function compiles, no TS errors

## T2: Fire event from enrichment extraction
- File: `src/inngest/enrichment-email-extract-functions.ts`
- After successful extraction in `enrichmentEmailExtractFunction`
- Fire: `inngest.send({ name: "enrichment/signals-extracted", data: { tenantId, activityId, contactId, signals } })`
- Verify: event fires only when signals are non-empty

## T3: Register in Inngest route
- File: `src/app/api/inngest/route.ts`
- Import and add `syncSignalsToDeal` to the functions array
- Verify: route compiles

## T4: Write merge logic with append semantics
- In `deal-signal-sync.ts`
- budget_mentions → `properties.budget` (latest) + `properties.budgetHistory` (append)
- next_steps → `properties.nextSteps` (accumulate, dedup)
- objections → `properties.objections` (accumulate, dedup)
- competitor_mentions → `properties.competitors` (accumulate, dedup)
- Set `properties.lastSignalUpdate` timestamp
- Verify: existing manual values NOT overwritten

## T5: Write unit test
- File: `src/__tests__/deal-signal-sync.test.ts`
- Test merge logic: append behavior, dedup, no overwrite
- Test: no deal found → no-op
- Test: multiple deals → picks most recently updated
- Verify: all tests pass
