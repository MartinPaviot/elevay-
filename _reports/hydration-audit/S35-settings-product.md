# S35 — settings-product (`/settings/product`) — audit d'hydratation

**Verdict global : H1 (fidèle).** Fully faithful settings page. All four controls (product description, sales motion, primary challenge, AI tone) load their current value from real tenant-scoped persisted config via GET /api/settings/product, which reads tenants.settings JSONB scoped by authCtx.tenantId. Saves PUT back through updateTenantSettings (DB write + cache invalidation) and reflect via a Saved badge; loading and error states are both handled. The only nit is the load gate rendering null (blank) rather than a skeleton.

Entrée : `app/apps/web/src/app/(dashboard)/settings/product/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Product description (Textarea) | app/apps/web/src/app/(dashboard)/settings/product/page.tsx:73-79 | GET /api/settings/product -> getTenantSettings(authCtx.tenantId).productDescription (route.ts:21-27); persists via PUT -> updateTenantSettings (route.ts:30-51, tenant-settings.ts:560-574) | H1 | yes | none | blank | global | once | faithful — loaded from real tenant config, save round-trips and reflects Saved badge |
| Sales motion (Select) | app/apps/web/src/app/(dashboard)/settings/product/page.tsx:80-88 | GET /api/settings/product -> s.salesMotion (route.ts:24); options from SALES_MOTIONS constant; persists via PUT (route.ts:42-50) | H1 | yes | none | blank | global | once | faithful — value loaded from persisted config; unset tenants fall back to DEFAULTS.salesMotion (Founder-led sales), which is the intended config default, not a fake value |
| Primary challenge (Textarea) | app/apps/web/src/app/(dashboard)/settings/product/page.tsx:89-95 | GET /api/settings/product -> s.primaryChallenge (route.ts:25); persists via PUT (route.ts:42-50) | H1 | yes | none | blank | global | once | faithful |
| AI tone (Select) | app/apps/web/src/app/(dashboard)/settings/product/page.tsx:96-108 | GET /api/settings/product -> s.aiTone (route.ts:26); persists via PUT (route.ts:42-50) | H1 | yes | none | blank | global | once | faithful — unset tenants fall back to DEFAULTS.aiTone (Direct), the intended config default |
| Save button + Saved/error feedback | app/apps/web/src/app/(dashboard)/settings/product/page.tsx:110-116 | PUT /api/settings/product -> updateTenantSettings(authCtx.tenantId, updates) (route.ts:30-51) | H1 | yes | spinner | n/a | global | n/a | faithful — disabled+Saving while in flight, Saved badge on 200, error text on failure |

## Pires défauts

1. Load gate renders null (blank screen) instead of a skeleton/spinner while fetching — page.tsx:63; minor loading-state polish, not a data defect
