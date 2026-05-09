# Company Brain — tasks

## Phase 1 — read API (this commit)

- [x] Add `lib/company-brain/types.ts` with `CompanyBrain`,
      `GetCompanyBrainOpts`, per-layer types.
- [x] Add `lib/company-brain/freshness.ts` pure helper +
      unit tests (5 cases).
- [x] Add `lib/company-brain/get-brain.ts` :
      single function, parallel `Promise.all` for 6 layers,
      additional queries for transcript-chunk counts +
      stall predictions, multi-tenant guard, capping +
      truncation flags, dossier=null Phase 1.
- [x] Add `lib/company-brain/__tests__/get-brain.test.ts`
      with 7 cases : multi-tenant filter, missing tenantId
      throws, missing companyId throws, empty layers happy
      path, meetings derived from activities, truncation
      flag flip, deal property metadata coercion (new vs
      legacy bare values).
- [x] Add `app/api/brain/[companyId]/route.ts` GET handler
      with admin-or-tenant scoped access, query params for
      caps, 404 on cross-tenant, 401 unauth.
- [x] Verify : `npx tsc --noEmit` 0 errors, `npx vitest
      run` 210 files / 2611 tests pass / 1 skip.
- [x] Verify : `dossier-builder` not modified, no
      schema/migration, no Inngest worker added.

## Phase 2 — materialised cache (NOT in this commit)

Triggered when : Phase 1 read latency > 200ms p95 OR chat
panel calls `getCompanyBrain` per message and observed cost
dominates.

- [ ] New migration `0051_entity_brain_snapshots.sql` :
      table with `(tenant_id, entity_type, entity_id)`
      unique key + jsonb brain payload + TTL.
- [ ] New Inngest worker `materialiseEntityBrain`
      triggered by `brain/refresh-requested` event.
- [ ] Update `getCompanyBrain` to check cache first +
      fall back to live aggregation when stale.
- [ ] Cache-invalidation hooks on key write paths
      (deal property write, signal extracted, transcript
      indexed).

## Phase 3 — surfaces

- [x] **3a** Chat tool `getCompanyBrain` registered in the
      chat tool registry + tool-router + orchestrator.
      Triggered by "tell me about X" / "what do we know
      about X" / "brain on Y" / "summarise our
      relationship with Z" / "full picture on W".
- [x] **3b** Meeting prep (`generateMeetingPrep` Inngest
      function) consumes the brain via
      `composeMeetingPrepContext` instead of per-attendee
      contact + company + 5-row activities composition.
- [x] **3c** Brain page UI at `/accounts/[id]/brain`
      consuming the API : overview card + 7 collapsible
      sections (contacts, deals, activities, meetings,
      knowledge, graph facts, memories) with per-layer
      freshness ; "View brain" link added in account
      header.

## Status (2026-05-09)

- Phase 1 : **DONE** — read API + endpoint shipped (commit
  691fbce).
- Phase 2 : **open**, not blocking — wait for measured
  latency pressure before committing to materialised
  cache.
- Phase 3 : **DONE** — chat tool (3a, f8753ec), meeting
  prep migration (3b, d486637), brain UI page (3c, this
  commit).
