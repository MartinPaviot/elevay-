# S07 — settings-objects (`/settings/objects`) — audit d'hydratation

**Verdict global : H2 (partiel).** A genuinely faithful CRUD-on-config page. The object-types list loads from real, DB-backed, tenant-scoped persisted config (tenants.settings.customObjectTypes via getTenantSettings, filtered by the session JWT's tenantId), and create/edit/delete round-trip through the same admin-gated API with the response reflected back into local state. Loading skeleton and empty state are handled. The one fidelity gap is error handling: a failed GET (401/403/500) is swallowed into an empty array and renders the identical "No custom object types yet" empty state, so an error is indistinguishable from a real empty result (silent failure).

Entrée : `app/apps/web/src/app/(dashboard)/settings/objects/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Object types list (cards: name, icon, field count, slug) | src/app/(dashboard)/settings/objects/page.tsx:279-352 | GET /api/custom-objects (route.ts:12-25) -> getTenantSettings(authCtx.tenantId).customObjectTypes (lib/config/tenant-settings.ts:542-557); tenantId from session (lib/auth/auth-utils.ts:20-32) | H2 | yes | skeleton | handled | silent | once | Real tenant-scoped persisted data; loading skeleton + empty state handled. H2 because the loader (page.tsx:99-103) maps any non-ok response to {objectTypes:[]}, so a 401/403/500 renders as the empty state with no error surface. |
| Create/Edit modal form (names, icon picker, fields) | src/app/(dashboard)/settings/objects/page.tsx:357-586 | On edit prefilled from loaded type via openEdit (page.tsx:115-122); persists via POST/PUT -> updateTenantSettings (route.ts:32-144); response reflected into state (page.tsx:179-191) | H1 | yes | none | n/a | silent | once | faithful - edit form loads current persisted values and save round-trips + reflects back; admin-gated. |
| Delete (inline confirm) per card | src/app/(dashboard)/settings/objects/page.tsx:317-348 | DELETE /api/custom-objects -> updateTenantSettings (route.ts:151-187); list filtered locally on ok (page.tsx:199-213) | H1 | yes | none | n/a | silent | once | faithful - persists removal to tenant config and reflects back; admin-gated. |
| Header title/subtitle, field-type labels, icon palette (chrome) | src/app/(dashboard)/settings/objects/page.tsx:222-242,55-62,35-53 | static | H0 | n/a | n/a | n/a | n/a | static | faithful - pure static chrome/help copy and control option lists. |

## Pires défauts

1. Loader collapses GET errors into the empty state: any non-ok response (401/403/500) becomes {objectTypes:[]} and renders 'No custom object types yet' with no error UI - an error is indistinguishable from genuinely having none (page.tsx:99-103).
2. No error surface on any mutation: handleSave/handleDelete only console.error on failure (page.tsx:192-197, 210-212); a non-ok POST/PUT/DELETE silently does nothing - no toast or inline error (page.tsx:179-191, 206-209).
3. List is fetched once on mount with no revalidation on focus/navigation (page.tsx:98-104); a change in another tab/session won't reflect.
