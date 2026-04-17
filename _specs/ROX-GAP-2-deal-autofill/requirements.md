# ROX-GAP-2 — Auto-Fill Deal Fields from Conversations

## User Story

As a founder, I want my deal fields (budget, timeline, decision process, next steps) to be automatically populated from my email conversations and meeting transcripts, so I never have to manually update deal properties.

## Background

Rox auto-fills opportunity fields from call transcripts and emails. Elevay already extracts signals via `enrichment-email-extract` (objections, next_steps, champion_signals, budget_mentions, competitor_mentions) but these signals sit in `activities.metadata.extractedSignals` — they don't flow back to the `deals` table's `properties` field.

## Acceptance Criteria

### AC1: Email signals populate deal properties
GIVEN an email is synced and signals are extracted via enrichment-email-extract
WHEN the email is linked to a contact who has an open deal
THEN the deal's `properties` JSONB is updated with:
  - `budget` from budget_mentions (latest value)
  - `timeline` from timeline_mentions
  - `nextSteps` array from next_steps
  - `objections` array from objections
  - `competitors` array from competitor_mentions
  - `lastSignalUpdate` timestamp

### AC2: Meeting transcript signals populate deal properties
GIVEN a meeting transcript is processed and structured notes extracted
WHEN the meeting activity is linked to a deal (directly or via contact)
THEN the deal's `properties` is updated with the same fields

### AC3: No overwrite of manually-set fields
GIVEN a user has manually set `properties.budget` on a deal
WHEN a new email mentions a different budget figure
THEN the auto-fill appends to a `properties.budgetHistory` array instead of overwriting
AND the primary `properties.budget` is NOT changed

### AC4: Deal summary auto-refresh
GIVEN deal properties have been auto-updated from signals
WHEN the user views the deal
THEN the `deal.summary` reflects the latest signals (regenerated if stale >24h)

## Edge Cases

- Signal from an email not linked to any deal → store in contact properties, not deal
- Multiple open deals for same contact → attach signals to the most recent active deal
- Conflicting signals (email says $50K, meeting says $100K) → keep both in history, latest wins for primary field
