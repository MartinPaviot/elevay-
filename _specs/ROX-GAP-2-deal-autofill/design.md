# ROX-GAP-2 — Design: Auto-Fill Deal Fields from Conversations

## System Fit

The pipeline already exists:
1. `syncEmails` ingests emails → creates activities
2. `enrichmentEmailExtractFunction` extracts signals → stores in `activities.metadata.extractedSignals`
3. **Missing link**: signals → deal properties

## Approach

Add a new Inngest function `syncSignalsToDeal` that fires after enrichment extraction and cascades signals to the associated deal's `properties` JSONB.

## Data Flow

```
syncEmails → activity created
  ↓
enrichmentEmailExtractFunction → signals extracted
  ↓ fire event: "enrichment/signals-extracted"
  ↓
syncSignalsToDeal (NEW)
  ├── Find the activity's contact
  ├── Find open deals for that contact
  ├── Merge signals into deal.properties (append, don't overwrite)
  └── Optionally refresh deal.summary if stale
```

## Changes

### 1. New file: `src/inngest/deal-signal-sync.ts`
- Inngest function triggered by `enrichment/signals-extracted`
- Receives: `{ tenantId, activityId, contactId, signals }`
- Finds open deals via `deals WHERE contactId = ? AND stage NOT IN (won, lost)`
- Merges signals into `deal.properties` using append logic

### 2. Modify: `src/inngest/enrichment-email-extract-functions.ts`
- After successful extraction, fire `enrichment/signals-extracted` event
- Pass: tenantId, activityId, contactId, extracted signals

### 3. Modify: `src/app/api/inngest/route.ts`
- Register `syncSignalsToDeal`

### 4. No schema changes
- `deal.properties` is already JSONB — flexible enough

## Merge Logic

```typescript
// Append, don't overwrite
if (signals.budget_mentions?.length) {
  props.budgetHistory = [...(props.budgetHistory || []), ...signals.budget_mentions.map(b => ({ value: b, date: new Date().toISOString() }))];
  props.budget = signals.budget_mentions[signals.budget_mentions.length - 1]; // latest
}
// Same for nextSteps, objections, competitors — accumulate, latest wins for primary
```
