# F003 — Outcome Tracking: Tasks

## T1: Create `action_outcomes` table migration
- Add Drizzle schema
- Generate migration
- Verify: table and indexes created

## T2: Create outcome watcher creation utility
- New file: `lib/outcomes/create-watcher.ts`
- Function: `createOutcomeWatcher(actionId, reactionId, entityType, entityId, actionType, triggerType, entitySnapshot)`
- Auto-calculates window based on action type (email=7d, deal=14d, task=7d)
- Test: watcher created with correct window

## T3: Create outcome detector cron
- New Inngest function: `outcome-detector`
- Cron: `*/15 * * * *` (every 15 minutes)
- Checks watching outcomes: query relevant tables for each type
- Resolves or expires outcomes
- Fires `outcome/resolved` event on resolution
- Test: email opened → outcome resolved with positivity

## T4: Wire real-time outcome detection
- In Resend webhook: check for watching outcomes on email open/click
- In EmailEngine webhook: check for watching outcomes on reply
- In activity creation: check for watching outcomes on deal stage change
- Test: webhook fires → outcome resolved immediately (not waiting for cron)

## T5: Wire outcome creation into agent reactor (F001)
- After reactor dispatches action: create outcome watcher
- Include reaction_id and entity snapshot
- Test: reactor action → watcher created

## T6: Create aggregation queries
- New file: `lib/outcomes/stats.ts`
- Functions: `getAgentHitRate()`, `getBestCombinations()`, `getOutcomesByTrigger()`
- Test: correct aggregation with test data

## T7: Fire trust model event on resolution
- On outcome resolved: fire `outcome/resolved` event with action_type + positivity
- This event consumed by F005 Learned Trust
- Test: event fired with correct payload

## T8: Write integration test
- Full cycle: action → watcher → event → outcome resolved → event fired
- Expiry: action → watcher → window expires → expired status
- Cancellation: action reversed → watcher cancelled
