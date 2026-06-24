# 30 — notes (`/notes`) — audit d'hydratation

**Verdict global : H2 (partiel).** The /notes page is mostly faithful: every data-bearing element (note rows, header count, entity badges) is wired to real tenant-scoped data via GET /api/notes, which filters by eq(notes.tenantId) + isNull(deletedAt). It has a loading skeleton and two distinct written empty states (no notes vs no search match). It falls short of H1 because the client swallows fetch errors silently (a 500 from the route renders as the 'No notes yet' empty state, masking failures), data is fetched only once on mount with no refresh-on-focus/poll, and the entity-name resolution queries are not tenant-filtered.

Entrée : `app/apps/web/src/app/(dashboard)/notes/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Header note count subtitle | app/apps/web/src/app/(dashboard)/notes/page.tsx:145 | notes.length from GET /api/notes (route.ts:23-28, tenant-scoped) | H1 | yes | none | handled | silent | once | Real count; shows 0 during load (no loading state on the subtitle) but converges. Faithful. |
| Notes list (rows: title, content preview, timestamp) | app/apps/web/src/app/(dashboard)/notes/page.tsx:239-279 | GET /api/notes -> db.select().from(notes).where(eq(tenantId)+isNull(deletedAt)) (route.ts:23-28) | H2 | yes | skeleton | handled | silent | once | Real tenant-scoped rows, skeleton + two written empty states (no notes / no match). Downgraded to H2: fetch error is swallowed (catch->console.warn, route.ts/page.tsx:99) so a 500 renders as the 'No notes yet' empty state, not an error; and data only fetched once on mount (no refocus/poll refresh). |
| Entity link badge (company/contact/deal name) | app/apps/web/src/app/(dashboard)/notes/page.tsx:254-265 | entityName resolved server-side via companies/contacts/deals lookups (route.ts:46-78) | H2 | no | none | handled | silent | once | Name resolution joins companies/contacts/deals by id WITHOUT a tenantId filter (route.ts:51,60,71) — only safe because note.entityId is already tenant-scoped; still an un-scoped lookup. Also: inline-created notes get entityType='general' (POST default, route.ts:12,110) which is truthy, so they render a stray 'general' badge with no icon/link (entityIcon/entityHref return null). Minor display defect. |
| Search result count | app/apps/web/src/app/(dashboard)/notes/page.tsx:175-179 | client-side filter over fetched notes (page.tsx:121-130) | H1 | yes | none | n/a | n/a | once | Derived count over real data. Faithful. |

## Pires défauts

1. Silent error masquerading as empty: list fetch catch only console.warns and leaves loading=false (page.tsx:98-100), so a route 500 (route.ts:83) shows the 'No notes yet' empty state instead of an error state.
2. Un-tenant-scoped entity-name lookups: companies/contacts/deals are queried by id with no tenantId filter (route.ts:51,60,71); relies entirely on note.entityId already being tenant-bound rather than enforcing it in the join.
3. Stray 'general' badge: inline notes are stored with entityType='general' (POST default, route.ts:12,110), which is truthy at render (page.tsx:254) so they show a meaningless 'general' badge with no icon or link.
