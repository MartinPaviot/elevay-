# ROX-GAP-4 — Continuous Signal Monitoring

## User Story

As a founder, I want buying signals (funding, hiring, tech adoption, champion job changes) to be detected daily instead of weekly, so I can act on opportunities before they go stale.

## Background

Rox monitors accounts continuously. Elevay runs signal scans weekly via `weeklySignalScan` (Monday 8am cron). A 7-day delay means a funding announcement on Tuesday isn't surfaced until the following Monday — by then, competitors have already reached out.

## Acceptance Criteria

### AC1: Daily signal scan
GIVEN the signal scan cron exists
WHEN the schedule is updated
THEN it runs daily at 7am UTC (weekdays) instead of weekly

### AC2: Event-driven signals on enrichment
GIVEN a company is enriched via Apollo
WHEN the enrichment returns new funding data, hiring signals, or tech changes
THEN a signal check is triggered immediately for that company
AND linked deals are notified via `signalToDealAlert`

### AC3: Incremental scan (not full rescan)
GIVEN a daily scan runs
WHEN checking for signals
THEN it only checks companies that haven't been scanned in the last 24h
AND uses `properties.lastSignalScanAt` timestamp to skip recently-scanned companies

### AC4: Rate limit respect
GIVEN Apollo API has rate limits
WHEN the daily scan runs across all tenant companies
THEN it processes in batches of 20 with 1s delay between batches
AND respects the tenant's Apollo credit budget

## Edge Cases

- 500+ companies in tenant → scan top 100 by score, skip the rest
- Apollo API down → log warning, retry next day, don't crash
- Signal detected for company with no deal → store as TAM signal only
