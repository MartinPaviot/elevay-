# 28 — knowledge (`/knowledge`) — audit d'hydratation

**Verdict global : H1 (fidèle).** The /knowledge page is essentially faithful: every data-bearing element (sidebar list, section counts, entry rows, detail fields, scope/stale badges, timestamps, edit affordances) is wired to real tenant-scoped data via GET /api/settings/knowledge, which scopes by tenantId + (workspace OR user/createdBy) and re-enforces capability/ownership on POST/PUT/DELETE. Loading shows a skeleton, empty states are written (per-section 'No entries yet' + 'Select an entry'), and mutations throw-on-error to surface failures. The single meaningful gap is the page-level GET error path, which is swallowed silently and degrades to an indistinguishable empty list with no error banner (unlike the Home reference bar's independent error degradation).

Entrée : `app/apps/web/src/app/(dashboard)/knowledge/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Knowledge sidebar list (Workspace + Personal sections) | app/apps/web/src/components/knowledge/knowledge-sidebar.tsx:225 | GET /api/settings/knowledge → db.select(knowledgeEntries) tenant-scoped; fetched in page.tsx:38-50 | H1 | yes | skeleton | handled | silent | once | Real tenant+user-scoped data (eq tenantId + scope workspace OR user/createdBy, route.ts:23-35). Loading skeleton (page.tsx:254-285), per-section empty state (EmptySection, knowledge-sidebar.tsx:222). Only gap: page-level fetch error is swallowed (page.tsx:45-46) → renders as empty list, no error UI. |
| Section count badges (Workspace N / Personal N) | app/apps/web/src/components/knowledge/knowledge-sidebar.tsx:71-79 | derived from entries.length (filtered by scope, knowledge-sidebar.tsx:173-174) | H1 | yes | skeleton | handled | silent | once | Faithful count of real scoped data. |
| Entry row (title + category badge) | app/apps/web/src/components/knowledge/knowledge-sidebar.tsx:96-131 | entry.title / entry.category from GET payload (route.ts:43-45) | H1 | yes | skeleton | handled | silent | once | Real per-entry data; category label/variant mapped from canonical set, falls back to raw value. |
| Knowledge detail (title/category/content fields) | app/apps/web/src/components/knowledge/knowledge-detail.tsx:150-176 | selectedEntry from entries (page.tsx:56); fields from GET payload (route.ts:43-46) | H1 | yes | skeleton | handled | throws | once | Real entry data; empty (no selection) → KnowledgeDetailEmpty (page.tsx:325). Save/delete throw on error, surfaced by Button loading state. |
| Scope badge (Workspace/Personal) | app/apps/web/src/components/knowledge/knowledge-detail.tsx:109-111 | entry.scope (route.ts:50) | H1 | yes | skeleton | n/a | throws | once | Real scope value from DB. |
| Stale badge | app/apps/web/src/components/knowledge/knowledge-detail.tsx:112-117 | entry.isStale computed server-side (route.ts:52, STALENESS_DAYS=90) | H1 | yes | skeleton | n/a | throws | once | Real freshness flag from updatedAt vs 90-day threshold. |
| Created/Updated timestamps | app/apps/web/src/components/knowledge/knowledge-detail.tsx:183-184 | entry.createdAt/updatedAt ISO from DB (route.ts:53-54) | H1 | yes | skeleton | handled | throws | once | Real timestamps; null → formatDate returns 'Unknown' (detail:27-28). |
| Edit affordances (Save/Delete buttons, field disabled state) | app/apps/web/src/components/knowledge/knowledge-detail.tsx:120-142 | entry.isEditable computed server-side (route.ts:51: createdBy===userId \|\| role admin) | H1 | yes | skeleton | n/a | throws | once | Real authz-derived editability gates the controls; PUT/DELETE re-enforce capability + ownership server-side (route.ts:153,185,245,271). |
| Page header title 'Knowledge' + search input | app/apps/web/src/app/(dashboard)/knowledge/page.tsx:290-307 | static label; search is client-side filter over fetched entries (page.tsx:58-65) | H0 | n/a | none | n/a | n/a | static | Pure chrome; search filters real data client-side. Faithful for a label. |

## Pires défauts

1. Fetch error on GET /api/settings/knowledge is silently swallowed (page.tsx:45-46): a 500/network failure renders an empty list identical to a genuinely empty knowledge base, with no error state — H2 on the list lane vs the Home bar which degrades each lane to a distinct written state.
2. No page-level distinction between 'loading done, zero entries' and 'fetch failed': loading flips to false in finally (page.tsx:48) regardless of res.ok, so a non-OK response also yields the empty UI (page.tsx:41-43 only reads body when ok).
3. Data is fetched once on mount with no refetch on focus/poll (page.tsx:52-54); freshness='once' so concurrent edits from another session/user are not reflected until manual reload — acceptable for a settings-style page but below a realtime bar.
