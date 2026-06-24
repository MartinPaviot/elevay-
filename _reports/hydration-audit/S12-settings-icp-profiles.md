# S12 — settings-icp-profiles (`/settings/icp-profiles`) — audit d'hydratation

**Verdict global : H0 (statique).** This route is a pure server-side redirect (Next `redirect("/settings/icp")`) with no UI and no data-bearing elements. The rule-builder that once lived here was unified into /settings/icp; this file survives only to preserve old links. The redirect target (app/apps/web/src/app/(dashboard)/settings/icp/page.tsx) exists, so the redirect is valid and there is nothing to hydrate here.

Entrée : `app/apps/web/src/app/(dashboard)/settings/icp-profiles/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Redirect to /settings/icp (no rendered UI) | app/apps/web/src/app/(dashboard)/settings/icp-profiles/page.tsx:11 | static — redirect() to /settings/icp; target exists at app/apps/web/src/app/(dashboard)/settings/icp/page.tsx:1 | H0 | n/a | n/a | n/a | n/a | static | faithful — pure routing redirect, no data source, no UI elements; redirect target file confirmed to exist |

## Pires défauts

_Aucun — page fidèle._
