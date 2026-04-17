# ROX-GAP-4 — Design: Continuous Signal Monitoring

## System Fit

Existing: `weeklySignalScan` in `src/inngest/skill-crons.ts` runs Monday 8am.

## Change

### 1. Cron frequency: weekly → daily
```typescript
// Before
triggers: [{ cron: "TZ=UTC 0 8 * * 1" }] // Monday 8am

// After
triggers: [{ cron: "TZ=UTC 0 7 * * 1-5" }] // Weekdays 7am
```

### 2. Incremental scan
Add `lastSignalScanAt` tracking:
```typescript
// Only scan companies not scanned in last 24h
const companyRows = await db.select({ id: companies.id })
  .from(companies)
  .where(and(
    eq(companies.tenantId, tenantId),
    or(
      isNull(sql`properties->>'lastSignalScanAt'`),
      lt(sql`(properties->>'lastSignalScanAt')::timestamptz`, new Date(Date.now() - 86400000))
    )
  ))
  .orderBy(desc(companies.score))
  .limit(100);
```

After scan, update: `properties.lastSignalScanAt = new Date().toISOString()`

### 3. Event-driven on enrichment
In `src/inngest/functions.ts` → `enrichCompany`, after Apollo returns:
```typescript
// If funding/hiring data changed, trigger immediate signal check
if (apolloData.latest_funding_stage || apolloData.organization_num_employees_ranges) {
  await inngest.send({
    name: "signals/company-enriched",
    data: { tenantId, companyId, companyName }
  });
}
```

New function `onCompanyEnrichedSignalCheck` handles this event and runs the signal scanner for just that one company.

## Files to Change

1. `src/inngest/skill-crons.ts` — change cron, add incremental filter, update lastSignalScanAt
2. `src/inngest/functions.ts` — fire event after enrichment
3. `src/app/api/inngest/route.ts` — register new function (if separate)

## No schema changes needed
`properties` is JSONB — `lastSignalScanAt` is a dynamic field.
