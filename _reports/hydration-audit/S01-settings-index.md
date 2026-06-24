# S01 — settings-index (`/settings`) — audit d'hydratation

**Verdict global : H2 (partiel).** The /settings page is the Profile tab and is largely faithful: every editable control (first/last name, language, timezone) loads its current value from real, tenant/user-scoped persisted config (users table + tenants.settings JSONB, both filtered by authCtx.appUserId / authCtx.tenantId) and saves via PUT that round-trips on next load. Error handling is inline and independent. The only meaningful weakness is the timezone select, which silently substitutes the browser's resolved timezone when no value is persisted, so it can display a value that was never saved (H2 silent-default). Loading state is a blank `return null` rather than a skeleton, a minor degradation.

Entrée : `app/apps/web/src/app/(dashboard)/settings/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| First name input | app/apps/web/src/app/(dashboard)/settings/page.tsx:71-75 | GET /api/settings/profile → users.firstName (route.ts:14, eq users.id=appUserId :16); PUT persists users.firstName (route.ts:113,116) | H1 | yes | none | handled | independent | once | Value loaded from real user record + save round-trips (Saved badge). Loading = return null (blank, not skeleton) — minor. |
| Last name input | app/apps/web/src/app/(dashboard)/settings/page.tsx:78-82 | GET /api/settings/profile → users.lastName (route.ts:14); PUT persists users.lastName (route.ts:114,116) | H1 | yes | none | handled | independent | once | Loaded from real user record + save round-trips. faithful. |
| Email input (disabled) | app/apps/web/src/app/(dashboard)/settings/page.tsx:87 | GET /api/settings/profile → users.email (route.ts:14,94) | H1 | yes | none | handled | independent | once | Read-only display of real user email; intentionally not editable here. faithful. |
| Language select | app/apps/web/src/app/(dashboard)/settings/page.tsx:93-109 | GET /api/settings/profile → getTenantSettings.language (route.ts:89,95; tenant-settings.ts:542 eq tenants.id=tenantId); PUT writes tenants.settings.language (route.ts:124,126) | H1 | yes | none | handled | independent | once | Current value loaded from tenant settings JSONB + save persists & reflects on next load. faithful. |
| Timezone select | app/apps/web/src/app/(dashboard)/settings/page.tsx:113-126 | GET /api/settings/profile → getTenantSettings.timezone (route.ts:96); PUT writes tenants.settings.timezone (route.ts:125,126) | H2 | yes | none | blank | independent | once | Loaded from tenant settings + saves, BUT when unset it silently defaults to the BROWSER timezone (page line 30 + route.ts:96), so the control shows a value that was never persisted — borderline stale/defaulted current value. Otherwise round-trips. |
| Update button + Saved/error feedback | app/apps/web/src/app/(dashboard)/settings/page.tsx:130-136 | PUT /api/settings/profile (route.ts:105-134) | H1 | yes | spinner | n/a | independent | once | Saving state, success Badge (3s), and per-form error message all handled inline. faithful. |
| Mail & Calendar nav card | app/apps/web/src/app/(dashboard)/settings/page.tsx:140-165 | static — Link to /settings/mail-calendar with hardcoded copy | H0 | n/a | none | n/a | n/a | static | Pure navigation chrome/help copy, correctly static. |

## Pires défauts

1. Timezone defaults to the browser-resolved zone when unset (page.tsx:30 and route.ts:96) instead of an explicit empty/unset state, so the control shows a value the tenant never persisted — silently stale/defaulted (app/apps/web/src/app/(dashboard)/settings/page.tsx:113-126).
2. Loading state is `if (!loaded) return null` (app/apps/web/src/app/(dashboard)/settings/page.tsx:59) — a blank flash rather than a skeleton, unlike the Home reference bar.
3. On GET failure only a generic 'Failed to load profile' is set and the page still renders empty inputs with no retry affordance (app/apps/web/src/app/(dashboard)/settings/page.tsx:33).
