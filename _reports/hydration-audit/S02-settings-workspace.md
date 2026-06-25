# S02 — settings-workspace (`/settings/workspace`) — audit d'hydratation

**Verdict global : H1 (fidèle).** This page is faithfully data-hydrated. All three data-bearing controls (workspace name, logo, domains) load their current value from the real tenant-scoped GET /api/settings/workspace (eq(tenants.id, authCtx.tenantId)) and persist via a permission-gated PUT that round-trips back into local state (logo re-reads fresh URL; domains use optimistic write with revert-on-failure; name re-sets and shows Saved). Errors surface in independent banners. The only gaps are cosmetic: no loading skeleton/spinner during the initial fetch and no written empty state for an empty domains list. The danger-zone delete is correctly static (H0).

Entrée : `app/apps/web/src/app/(dashboard)/settings/workspace/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Workspace name input | app/apps/web/src/app/(dashboard)/settings/workspace/page.tsx:201 | GET /api/settings/workspace -> tenant.name (route.ts:32); PUT persists name (route.ts:78) | H1 | yes | none | handled | independent | once | Value loaded from real tenant-scoped tenant.name; save round-trips (setName(trimmed) on 200, saveWorkspaceName page.tsx:63-86) and shows Saved; error banner on failure. Minor: no loading indicator while initial fetch resolves (input shows empty briefly). |
| Workspace logo (Avatar preview + upload/replace/remove) | app/apps/web/src/app/(dashboard)/settings/workspace/page.tsx:224 | GET -> logoUrl via workspaceLogoUrl(settings) (route.ts:40); PUT logoDataUrl persists, validated (route.ts:150-163) | H1 | yes | spinner | handled | independent | once | Preview src from tenant-scoped versioned logoUrl; saveLogo re-reads fresh URL + router.refresh so sidebar updates (page.tsx:117-131); logoSaving spinner on button, logoError banner, falls back to initials when null. |
| Domains tag list + add input | app/apps/web/src/app/(dashboard)/settings/workspace/page.tsx:257 | GET -> merged companyDomains (route.ts:24-39); PUT companyDomains with primary-strip sync (route.ts:81-87) | H1 | yes | none | blank | independent | once | List rendered from real tenant-scoped companyDomains (primary domain merged in). Optimistic add/remove with revert-on-failure (saveDomains page.tsx:163-177) and error banner. Empty list renders no tags / no written empty copy, but help text explains the section. |
| Danger zone - Delete workspace | app/apps/web/src/app/(dashboard)/settings/workspace/page.tsx:285 | static - button permanently disabled, copy 'Contact support to delete' | H0 | n/a | none | n/a | n/a | static | Pure chrome: disabled button + help copy, no data source and intentionally no action. Correctly H0. |

## Pires défauts

1. No loading state during the initial GET: page.tsx:34-43 populates state only after fetch resolves, so name/domains/logo render empty (not a skeleton) until data lands — minor stale-blank flash, not a defect of data correctness.
2. Domains empty list has no written empty state: page.tsx:256-262 renders zero tags with no 'no domains yet' copy (the section help text at 252-255 partially mitigates).
3. Initial-fetch error only sets a banner via the shared error state (page.tsx:42); a load failure and a save failure both write to the same 'error' string, so a transient load error can be visually conflated with name-save errors.
