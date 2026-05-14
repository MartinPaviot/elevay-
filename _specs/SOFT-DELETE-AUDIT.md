# Soft-delete read audit — May 2026

Goal: every user-facing read in the web API must filter
`isNull(<table>.deletedAt)` so tombstoned rows stop bleeding into surfaces
the user sees. This doc tracks what was patched, what is intentionally
unfiltered, and what is still on the punch list.

## Schema baseline

Soft-delete columns exist on six entity tables (see
`app/apps/web/src/db/schema/core.ts`):
`companies`, `contacts`, `deals`, `activities`, `notes`, `tasks`.

All six are subject to the audit. Lookup tables (`tenants`, `users`,
sequences, etc.) are not soft-deleted today and are out of scope.

## Done (4 batches, 41 routes, 213/213 tests green)

- **Batch 1 (548534e)** — 12 account/deal/meeting detail routes
- **Batch 2 (28f8244)** — 11 dashboard/search/inbox routes
- **Batch 3 (908d619)** — 7 forecast/TAM/scoring routes
- **Batch 4 (61916e8)** — 11 deal/meeting/opportunity routes

Brain stack (`company-brain/*`, contact + deal brains, all brain API
routes) was patched earlier in `bd05e60` + `8cb2ab1`.

Test mocks: every `vi.mock("drizzle-orm", ...)` in suites that import a
patched route now exposes `isNull` (and `and` where it was missing).

## Intentionally NOT filtered (SKIP set)

These routes must keep seeing tombstoned rows. Filtering them would
either break a compliance flow, hide audit history, or silently corrupt
downstream behavior.

- **`admin/purge-fake-data`** — purge job operates on soft-deleted rows
  by definition. Filtering would make the purge a no-op.
- **`audit`** — audit log surface; needs the full historical record,
  including activity on rows that were later deleted.
- **`gdpr/export`** — GDPR right-of-access: the export must include
  every record the tenant ever had, deleted or not.
- **`export`** — admin/data export; same rationale as `gdpr/export`
  (operator may need the full set for migrations or compliance).
- **`unsubscribe`** — one-click unsubscribe must work even if the
  contact row was deleted between the email send and the click. Legal
  requirement.
- **`cron/world-model`** — long-running aggregation that snapshots the
  tenant's historical state; needs deleted rows so historical metrics
  don't shift retroactively.
- **`webhooks/inbound`, `webhooks/recall`** — write-mostly ingestion
  endpoints. They look up entities to attach incoming events; if a
  contact was soft-deleted between send and webhook callback, dropping
  the event would silently lose data. They should resolve to the
  tombstoned row and let downstream code decide.
- **`recall-test`** — internal smoke-test endpoint, not user-facing.

## Pending — next batches

The audit isn't finished. These 30+ routes still have unfiltered reads
and should be patched in subsequent batches. Grouped by surface so each
batch stays reviewable.

### Batch 5 — user-facing outcomes
- `chat/route.ts` — chat tool surface (some tools already use the
  brain stack which filters, but raw reads here need review)
- `contacts/merge/route.ts` — merging contacts; the source contact may
  be soft-deleted, but target reads should filter
- `deals/[id]/property-source/[fieldName]/route.ts`
- `sequences/[id]/autopilot/route.ts`
- `sequences/[id]/enroll/route.ts`
- `sequences/[id]/suggestions/route.ts`
- `sequences/drafts/[id]/context/route.ts`
- `outbound/review/route.ts`
- `warm-leads/draft/route.ts`
- `campaigns/generate/route.ts`
- `campaigns/[sequenceId]/preview/route.ts`
- `meetings/opt-out/route.ts`

### Batch 6 — background processing
- `enrich/route.ts`, `enrich-contacts/route.ts`
- `score/route.ts`, `score/contacts/route.ts`, `score-contacts/route.ts`
- `tam/build/route.ts`
- `embed/route.ts`
- `email/sync/route.ts`, `email/status/route.ts`
- `cron/stale-deals/route.ts`, `cron/email-sync/route.ts` (despite
  being crons, they should skip deleted entities — these are not in
  the SKIP set)
- `calendar/sync/route.ts`, `calendar/sync/microsoft/route.ts`

### Batch 7 — onboarding + admin internals
- `onboarding/status/route.ts`
- `onboarding/icp-prefill/route.ts`
- `onboarding/find-contacts/route.ts`
- `onboarding/email-intelligence/route.ts`
- `admin/company-logo/resolutions/route.ts`
- `import/smart/commit/route.ts`

## Pattern used

Every patched route follows the same shape:

```ts
import { eq, and, isNull /* + existing */ } from "drizzle-orm";

await db.select().from(contacts).where(and(
  eq(contacts.id, id),
  eq(contacts.tenantId, authCtx.tenantId),
  isNull(contacts.deletedAt),
));
```

For aggregate queries with joins, the `isNull(...deletedAt)` clause is
added to both the `where` and to each `innerJoin` predicate that
references a soft-deleted table, so joins don't smuggle deleted rows
back in.

Update statements that previously matched only by primary key now also
scope by `tenantId + deletedAt` so a stale ID can't silently overwrite a
tombstoned record.

## Why this matters

A soft-delete column with no read-side enforcement is a tombstone leak:
the user deletes a row in the UI, the row stays on disk, and every
analytics surface that doesn't filter on `deletedAt` keeps reporting it.
Pipeline value stays inflated; activity feeds resurrect ghosts; signal
detection fires on dead contacts; forecast scores include deals the
user thought they had killed. The fix is mechanical but unfortunately
case-by-case — there is no global `WHERE deleted_at IS NULL` we can
attach at the ORM layer without breaking the legitimate use cases
listed in the SKIP set above.
