# Tasks — Network activation

Ordered. Each task: implement → verify → test → commit.

- [x] **T1 — Pure parser** `lib/network/linkedin-connections.ts`
  - `parseLinkedInConnections(csv)` + exported helpers `normalizeLinkedInUrl`,
    `parseConnectedOn`, `findHeaderIndex`, `stripBom`.
  - Verify: `vitest run` on `__tests__/network-linkedin-connections.test.ts` green.
  - Test: ≥12 cases (preamble+BOM, no-preamble, dedup url-variants, empty email
    kept, no-identity skipped, date formats, CRLF, garbage → headerFound false).

- [x] **T2 — Import endpoint** `app/api/network/import/route.ts`
  - Pure planner `lib/network/import-plan.ts` (dedup vs tenant by linkedinUrl|email,
    row shaping) + service `lib/network/import-service.ts` (parse → company
    upsert-by-name → contact insert tagged `properties.network` +
    `networkConnectedOn`) + thin route (auth, rate-limit "bulk", 5MB cap, JSON/file).
  - Verified: planner 7 tests + route 5 tests (mocked service, no fragile db mock);
    27 network tests total green; tsc clean.

- [x] **T3 — Wire ICP scoring** (folded into the import service)
  - `import-service` loads active ICPs + `scoreContactIcpBatch(tenantId, ids,
    activeIcps)` after insert; missing/empty ICP is non-fatal (`scored:0`, contacts
    kept for the next recompute).

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
T1+T2+T3 DONE this session (parse → dedup → upsert → ICP score, behind
auth/rate-limit; 27 unit tests, tsc clean). Remaining: T4 contacts filter,
T5 call-list source, T6 cohort enrich, T7 upload UI, T8 regression + rebase
onto origin/main (for #251 reachability on the cohort rows).
