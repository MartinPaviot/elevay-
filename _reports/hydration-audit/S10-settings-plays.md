# S10 — settings-plays (`/settings/plays`) — audit d'hydratation

**Verdict global : H2 (partiel).** A genuinely well-wired tenant-scoped CRUD page. The plays list loads from the real custom_skill_templates table scoped by eq(tenantId), create/edit/toggle/delete all persist via tenant-scoped API routes and round-trip back through fetchPlays(). Loading skeleton and a written empty state are both present. The only meaningful defect is error handling: a non-ok or thrown fetch is swallowed (console.warn / setLoading without surfacing), so a 401/500 silently collapses into the "No plays yet" empty state rather than an error UI.

Entrée : `app/apps/web/src/app/(dashboard)/settings/plays/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Plays list (cards: name, category badge, version, description) | app/apps/web/src/app/(dashboard)/settings/plays/page.tsx:181-230 | GET /api/settings/plays -> db.select().from(customSkillTemplates).where(eq(tenantId)) (app/apps/web/src/app/api/settings/plays/route.ts:10-16) | H2 | yes | skeleton | handled | silent | once | Real tenant-scoped data + loading skeleton (page.tsx:160-165) + written empty state (page.tsx:166-178). But fetch errors are swallowed (catch -> console.warn; non-ok response ignored, page.tsx:52-60), so a 401/500 silently renders the empty state instead of an error -> H2. |
| isActive toggle (per play) | app/apps/web/src/app/(dashboard)/settings/plays/page.tsx:209-220 | value from play.isActive (loaded via GET); persist PUT /api/settings/plays/[id] {isActive} (app/apps/web/src/app/api/settings/plays/[id]/route.ts:37,44-48) | H1 | yes | none | n/a | global | once | faithful — switch position reflects persisted isActive; PUT is tenant-scoped (and/eq tenantId) and re-fetches; toggle failure toasts. |
| Create/Edit modal fields (name, category select, description, guidelines, trigger) | app/apps/web/src/app/(dashboard)/settings/plays/page.tsx:247-291 | edit prefills from selected play (openEdit, page.tsx:71-81); persist POST/PUT /api/settings/plays(/[id]) (route.ts:35-48; [id]/route.ts:31-48) | H1 | yes | none | n/a | independent | once | faithful — form is hydrated from the stored play on edit; save round-trips (tenant-scoped insert/update + fetchPlays); validation + error toasts on failure. |
| Delete action | app/apps/web/src/app/(dashboard)/settings/plays/page.tsx:221-227 | DELETE /api/settings/plays/[id] -> db.delete().where(and(eq(id), eq(tenantId))) ([id]/route.ts:62-69) | H1 | yes | none | n/a | independent | once | faithful tenant-scoped delete + re-fetch + toast. |
| Header title/subtitle + category options | app/apps/web/src/app/(dashboard)/settings/plays/page.tsx:150-153,26-33 | static | H0 | n/a | n/a | n/a | n/a | static | pure chrome/help copy and a fixed enum of categories — correctly static. |

## Pires défauts

1. List fetch errors are swallowed: catch -> console.warn and non-ok responses are ignored (app/apps/web/src/app/(dashboard)/settings/plays/page.tsx:52-60), so a 401/500 silently renders the 'No plays yet' empty state instead of an error UI — conflates error with empty.
2. handleToggle and handleDelete only catch network throws; a non-ok HTTP response (e.g. 404/500 from PUT/DELETE) is treated as success — the toast says deleted/toggled and fetchPlays runs without surfacing the failure (page.tsx:123-144).
