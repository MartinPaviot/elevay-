# ROX-GAP-4 — Tasks

## T1: Change cron from weekly to daily
- File: `src/inngest/skill-crons.ts`
- Change `weeklySignalScan` trigger from `"0 8 * * 1"` to `"0 7 * * 1-5"`
- Rename function ID from `cron-weekly-signal-scan` to `cron-daily-signal-scan`
- Verify: cron expression is valid for weekdays 7am UTC

## T2: Add incremental scan filter
- File: `src/inngest/skill-crons.ts`
- In `weeklySignalScan` (now daily), filter companies by `lastSignalScanAt`
- Only scan companies not scanned in last 24h OR never scanned
- Cap at 100 companies per tenant per run (sorted by score desc)
- After scan, update `properties.lastSignalScanAt` for each scanned company
- Verify: second run within 24h scans 0 companies (all recently scanned)

## T3: Fire signal event after enrichment
- File: `src/inngest/functions.ts`
- In `enrichCompany`, after Apollo data is saved
- If funding or employee count data is present, fire `signals/company-enriched`
- Verify: event fires only when relevant data is returned

## T4: Handle enrichment-triggered signal check
- Add handler in `src/inngest/skill-crons.ts` or new file
- Trigger: `signals/company-enriched`
- Runs signal scanner for just that one company
- Fires `signals/deal-alert-check` if signals found and company has open deals
- Verify: enriching a company with funding data triggers an alert on linked deals

## T5: Test incremental behavior
- Scan tenant → note companies scanned
- Wait or manually set `lastSignalScanAt` to >24h ago on one company
- Re-run scan → only that one company re-scanned
- Verify: scan count matches expected
