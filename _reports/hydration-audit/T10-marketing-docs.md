# T10 — marketing-docs (`/docs`) — audit d'hydratation

**Verdict global : H0 (statique).** The /docs index page is a static marketing/educational surface ("The Method" — Elevay's founder-led sales playbook). All data-bearing elements (phase groups, step titles/descriptions, read-time estimates) are derived synchronously from local TypeScript content modules (lib/docs/content.ts aggregating steps/{foundations,build,run,close,learn}). No tenant fetch, no API route, no server action, no claim of rendering "real" product data. It is a hardcoded curriculum, legitimately static by design. Gated to non-production via DOCS_PAGE_ENABLED (notFound() in prod), which is a publishing flag, not a hydration concern. No genuine hydration defect.

Entrée : `app/apps/web/src/app/(marketing)/docs/page.tsx`.

## Éléments

| Élément | file:line | Source | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---|---|---|---|---|---|---|---|---|---|
| Phase groups + step rows (title, description, slug links) | app/apps/web/src/app/(marketing)/docs/page.tsx:42-83 | Static local content modules via docsByPhase() / docSteps from lib/docs/content.ts (steps/*.ts) | H0 | no | none | n/a | n/a | static | Hardcoded method curriculum; correct to be static — educational copy, not tenant state. |
| Per-step read-time estimate (`{n} min`) | app/apps/web/src/app/(marketing)/docs/page.tsx:76-78 | estimateReadMinutes(step) computed from static block strings | H0 | no | none | n/a | n/a | static | Deterministic computation over static content; legitimately static. |
| Phase taglines | app/apps/web/src/app/(marketing)/docs/page.tsx:52 | PHASE_TAGLINES constant (lib/docs/content.ts:17-23) | H0 | no | none | n/a | n/a | static | Static constant map; correct. |
| Page visibility gate (DOCS_PAGE_ENABLED → notFound) | app/apps/web/src/app/(marketing)/docs/page.tsx:20 | process.env.NODE_ENV (lib/docs/page-visibility.ts:16) | H0 | no | none | n/a | n/a | static | Build-time publishing flag (hidden in prod, visible on dev). Not a data-hydration element. |

## Pires défauts

_Aucun — statique par design ou fidèle._
