# A2: Dashboard Intelligence — Design

## System Fit
The API already returns `founderMetrics` — the only change is frontend consumption.

## Data Model Changes
None.

## API Changes
None — `GET /api/dashboard/summary` already returns everything needed.

## Component Changes

### `home/page.tsx`

1. **Extend `DashboardSummary` interface** to include `founderMetrics`:
```ts
founderMetrics?: {
  pipelineValue: number;
  activeDeals: number;
  wonValue: number;
  winRate: number | null;
  totalContacts: number;
  totalAccounts: number;
  emailsSent7d: number;
  openRate: number | null;
  dealsAtRisk: Array<{
    id: string; name: string; stage: string;
    value: number | null; daysSilent: number;
  }>;
};
```

2. **Weekly summary card**: Conditional rendering:
   - If `ws.sequencesLaunched + ws.responsesReceived + ws.meetingsBooked + ws.opportunitiesClosed > 0` → show outbound stats (current behavior)
   - Else if `fm.totalAccounts > 0` → show founder stats
   - Else → don't show the card

3. **Deals at risk section**: New section between weekly summary and two-column layout, only if `fm.dealsAtRisk.length > 0`.

4. **Empty state replacement**: Replace "No actions right now. Your pipeline is clear." with contextual CTAs.

## Failure Handling
- If `founderMetrics` is undefined (old API version / error), fall back to current behavior
- All conditional checks use optional chaining
