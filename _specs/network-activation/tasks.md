# Tasks — Network activation

Ordered. Each task: implement → verify → test → commit.

- [x] **T1 — Pure parser** `lib/network/linkedin-connections.ts`
  - `parseLinkedInConnections(csv)` + exported helpers `normalizeLinkedInUrl`,
    `parseConnectedOn`, `findHeaderIndex`, `stripBom`.
  - Verify: `vitest run` on `__tests__/network-linkedin-connections.test.ts` green.
  - Test: ≥12 cases (preamble+BOM, no-preamble, dedup url-variants, empty email
    kept, no-identity skipped, date formats, CRLF, garbage → headerFound false).

- [ ] **T2 — Import endpoint** `app/api/network/import/route.ts`
  - parse → company upsert-by-name (tenant) → contact upsert dedup (linkedinUrl|email)
    → tag `properties.network` + `networkConnectedOn` → collect ids.
  - Verify: POST a fixture export; assert tenant inserts + dedup against a pre-seeded
    contact + company linkage.
  - Test: route test with a seeded duplicate.

- [ ] **T3 — Wire ICP scoring**
  - After insert, load active ICPs (existing loader) and call
    `scoreContactIcpBatch(tenantId, ids, activeIcps)`; return `scored`.
  - Verify: imported ids have non-null `score`.

- [ ] **T4 — Contacts filter** `?fNetwork=true`
  - Extend `app/api/contacts/route.ts` (condition + count). Add a "Mon réseau"
    quick-filter chip in the Contacts UI.
  - Test: filter returns only the cohort.

- [ ] **T5 — Call list source** (`SprintAudience.network`)
  - Extend `lib/voice/sprint-audience.ts` + `sprintAudienceConditions()` in
    `lib/voice/call-sprint.ts`; allow a "Mon réseau" saved list.
  - Test: audience builder includes the network condition.

- [ ] **T6 — Enrich the top-of-ICP slice**
  - Reuse `enqueueFullEnrichForContacts` on network contacts with `score >= grade
    threshold` that lack a mobile. (Optional: cost-preview gate — reco #3.)

- [ ] **T7 — Upload UI**
  - Contacts page: "Importer mon réseau LinkedIn" → file input → `POST
    /api/network/import` → toast `imported/duplicates/skipped` + deep-link to
    `?fNetwork=true`. Include a one-line "how to export" helper
    (LinkedIn → Settings → Data privacy → Get a copy of your data → Connections).

- [ ] **T8 — Regression + docs**
  - `vitest run` + `tsc --noEmit` green; update product-spec if surfaced.
  - Rebase branch onto `origin/main` (picks up PR #251 reachability so the cohort
    rows can show call-readiness facts).

## Status
T1 in progress this session (parser + tests). T2–T8 sequenced after.
