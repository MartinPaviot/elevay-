# S37 — settings-docs (`/settings/docs`) — audit d'hydratation

**Verdict global : H0 (statique).** This is "The Method" — a static documentation index, not a settings/config page. It renders entirely from hardcoded content libraries (docSteps assembled from static step files in lib/docs/steps/*) with zero tenant-scoped data, no API/loader, no persisted config, and no controls to save. It is pure reference/help copy, correctly H0. The page is also gated behind DOCS_PAGE_ENABLED (notFound in production), so it 404s in prod entirely.

Entrée : `app/apps/web/src/app/(dashboard)/settings/docs/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Phase section headers + taglines (Phase 1..N labels) | app/apps/web/src/app/(dashboard)/settings/docs/page.tsx:33-37 | static PHASE_TAGLINES + docsByPhase() from lib/docs/content.ts:17-43 (hardcoded) | H0 | n/a | n/a | n/a | n/a | static | Pure static reference copy; no data source intended. Faithful as chrome. |
| Doc step rows (title, description, step number, read-minutes, link) | app/apps/web/src/app/(dashboard)/settings/docs/page.tsx:42-83 | static docSteps from lib/docs/content.ts:26-32 (foundationSteps/buildSteps/runSteps/closeSteps/learnSteps); estimateReadMinutes computed from static text | H0 | n/a | n/a | n/a | n/a | static | Hardcoded methodology content, identical for every tenant by design. Help/reference copy => correctly H0, not a defect. |
| SettingsHeader title/subtitle | app/apps/web/src/app/(dashboard)/settings/docs/page.tsx:22-25 | static string literals (subtitle interpolates docSteps.length, a static count) | H0 | n/a | n/a | n/a | n/a | static | Static chrome. Faithful. |

## Pires défauts

1. No data-bearing/config elements exist on this page — it is a static documentation index, so there are no hydration defects. (page.tsx:15-89)
2. Page is fully gated off in production via DOCS_PAGE_ENABLED (notFound) — lib/docs/page-visibility.ts:16 — so it is internal-only, not a tenant settings surface.
3. No tenant-scoped data, no loader, no persistence anywhere; correctly H0, nothing to fix.
