# 34 — objects (`/objects/[type]`) — audit d'hydratation

**Verdict global : H1 (fidèle).** This page is essentially faithful (H1): every data-bearing element (header title/icon, record count, the dynamically-built records table, detail modal fields, timestamps) is wired to real tenant-scoped data via GET /api/custom-objects/[type], which scopes both the record query (WHERE tenant_id = authCtx.tenantId AND object_type = type) and the object-type schema (getTenantSettings(tenantId)). Loading shows a header+row skeleton; empty shows distinct written states for no-records and no-search-match with CTAs, meeting the Home reference bar. The one gap is error degradation: a 500/network failure in fetchRecords is swallowed and rendered as the 'Object type not found' empty state, mislabeling a server error as a missing type (H2-level axis weakness, not enough to drop the page below H1).

Entrée : `app/apps/web/src/app/(dashboard)/objects/[type]/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Header title (object type name) | app/apps/web/src/app/(dashboard)/objects/[type]/page.tsx:645 | GET /api/custom-objects/[type] -> objectType from getTenantSettings(tenantId).customObjectTypes (route.ts:28-32, tenant-settings.ts:542) | H1 | yes | skeleton | handled | silent | once | Real tenant-scoped object-type def; loading skeleton + 'Object type not found' fallback. Header icon resolved from objectType.icon. |
| Header subtitle record count | app/apps/web/src/app/(dashboard)/objects/[type]/page.tsx:646 | records.length from GET /api/custom-objects/[type] (route.ts:36-42) | H1 | yes | skeleton | handled | silent | once | faithful; pluralized count of tenant-scoped records. |
| Records DataTable (rows: name, up to 4 custom fields, created_at) | app/apps/web/src/app/(dashboard)/objects/[type]/page.tsx:709-719 | records[] from custom_records WHERE tenant_id=authCtx.tenantId AND object_type=type (route.ts:36-42) | H1 | yes | skeleton | handled | silent | once | Columns built dynamically from tenant objectType.fields; values from record.properties; inline-edit + detail modal both PUT to the same tenant-scoped route. Faithful. |
| Empty state (no records / no search match) | app/apps/web/src/app/(dashboard)/objects/[type]/page.tsx:689-707 | filteredRecords (derived from real records, page.tsx:125-135) | H1 | yes | none | handled | n/a | once | Written empty copy with distinct no-records vs no-match messages + CTA to create or configure fields. Matches Home reference bar. |
| Detail modal field values + created/updated timestamps | app/apps/web/src/app/(dashboard)/objects/[type]/page.tsx:859-935 | showDetail record (from records[]) (route.ts:36-42) | H1 | yes | none | handled | n/a | once | Per-field rendering with '--' for missing values; real created_at/updated_at. |

## Pires défauts

1. Error degradation is silent and misleading: fetchRecords catches/ignores fetch failures and any non-OK non-404 response, leaving objectType=null so a route 500 renders as the 'Object type not found' empty state rather than an error state (page.tsx:103-118, fallback at 627-639).
2. No independent per-element error UI: the whole page is one fetch with no retry affordance; a partial/failed load collapses to the not-found path with no 'try again' (page.tsx:104-117).
3. Data is fetched once on mount with no refresh/poll/revalidation on focus, so the record table and count can go stale after external changes (page.tsx:120-122).
