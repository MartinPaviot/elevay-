# S13 — settings-knowledge (`/settings/knowledge`) — audit d'hydratation

**Verdict global : H1 (fidèle).** The Knowledge settings page is faithfully wired to real tenant-scoped data. Every data-bearing control (topic title, content, stage chips) loads its current value from GET /api/settings/knowledge, which selects knowledgeEntries strictly scoped by eq(tenantId) plus scope/createdBy, and every mutation (POST/PUT/DELETE plus per-chip stage toggle) round-trips through the same tenant-scoped route with a refetch or local-state update. Loading skeleton, written empty state, and error handling are all present, matching the Home-page reference bar.

Entrée : `app/apps/web/src/app/(dashboard)/settings/knowledge/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Knowledge topics list (sections grouped by stage) | app/apps/web/src/app/(dashboard)/settings/knowledge/page.tsx:303-340 | GET /api/settings/knowledge → db.select knowledgeEntries (route.ts:20-36) | H1 | yes | skeleton | handled | global | once | faithful — fetched on mount (fetchTopics, page:26-48,84-86), loading skeleton (304-309), written empty state (310-317), error catch (43-44) |
| Topic title input | app/apps/web/src/app/(dashboard)/settings/knowledge/page.tsx:196-201 | value from fetched k.title (page:36); persists via POST/PUT title (route.ts:110-122,193-216) | H1 | yes | skeleton | handled | global | once | faithful — current value loaded from tenant config, save round-trips (saveTopic 113-144 + fetchTopics refetch) |
| Topic content textarea | app/apps/web/src/app/(dashboard)/settings/knowledge/page.tsx:203-209 | value from fetched k.content (page:37); persists via POST/PUT content (route.ts:202-211) | H1 | yes | skeleton | handled | global | once | faithful — loaded value, content-hash dedupe on PUT, re-embeds on change |
| Consumption-stage chips (Used in:) | app/apps/web/src/app/(dashboard)/settings/knowledge/page.tsx:218-246 | active state from fetched k.stages (page:38, effectiveStages route.ts:48); persists immediately via PUT stages (page:100-110, route.ts:199) | H1 | yes | skeleton | handled | global | once | faithful — chip active state reflects stored/derived stages, toggle persists per-entry instantly and updates local state |
| Per-stage section count badge | app/apps/web/src/app/(dashboard)/settings/knowledge/page.tsx:330-332 | derived from fetched topics filtered by stage (page:323) | H1 | yes | skeleton | handled | n/a | once | faithful — real count of tenant entries whose primary stage matches |
| Generate-from-website summary + gaps | app/apps/web/src/app/(dashboard)/settings/knowledge/page.tsx:283-301 | POST /api/settings/knowledge/generate → runCompanyIntake (generate/route.ts:53-59), tenant domain via getTenantSettings(tenantId) | H1 | yes | spinner | n/a | global | once | faithful — action-result panel built from real intake response (pages read, created/updated counts, gaps); refetches topics after; tenant-scoped + admin-gated + rate-limited |
| Unsaved badge / temp-row hint | app/apps/web/src/app/(dashboard)/settings/knowledge/page.tsx:185-195,213-216 | static (derived from temp- id) | H0 | n/a | none | n/a | n/a | static | faithful — pure UI affordance for unsaved local rows, no data source needed |
| Header title/subtitle help copy | app/apps/web/src/app/(dashboard)/settings/knowledge/page.tsx:269-272 | static | H0 | n/a | none | n/a | n/a | static | faithful — pure help copy, correctly hardcoded |

## Pires défauts

1. Minor: a failed PUT title/content edit (route.ts:213-216) is not followed by a refetch — after the optimistic local edit, a server-side reject could leave the UI ahead of the DB (page:132-138). POST and stage-toggle paths refetch/persist correctly, so overall fidelity stays H1.
2. GET non-ok (non-throwing) response is swallowed silently: res.ok===false (page:29) leaves topics empty with no error shown, so a 500 from route.ts:57-63 renders the empty state instead of an error — minor empty-vs-error ambiguity.
3. No defects at the H3/H4/H5 level — no mock/sample data, no unwired controls, no tenant leak (every query carries eq(tenantId)).
