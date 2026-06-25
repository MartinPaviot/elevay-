# T15 — legal-sub-processors (`/sub-processors`) — audit d'hydratation

**Verdict global : H0 (statique).** Legal sub-processors disclosure page. Server component that imports a checked-in static JSON file (src/data/dpas.json) at build time and renders it as a table (provider, purpose, data residency, operator jurisdiction, CLOUD Act exposure, DPA status) plus notification-policy copy and a subscribe-by-email section. No runtime fetch, no server action, no per-tenant data — and correctly so. This is exactly the right pattern for a public legal disclosure: a versioned source-of-truth config bundled at build time, which the page copy itself frames as never able to drift from the application config. Legitimately static = H0, not a defect.

Entrée : `app/apps/web/src/app/(legal)/sub-processors/page.tsx`.

## Éléments

| Élément | file:line | Source | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---|---|---|---|---|---|---|---|---|---|
| Last updated date | app/apps/web/src/app/(legal)/sub-processors/page.tsx:39 | dpas.lastUpdated (static JSON import) | H0 | n/a | none | n/a | n/a | static | Build-time static value from src/data/dpas.json. Correct for a legal disclosure. |
| Notification policy text | app/apps/web/src/app/(legal)/sub-processors/page.tsx:51 | dpas.notificationPolicy (static JSON import) | H0 | n/a | none | n/a | n/a | static | Static legal copy from JSON. |
| Sub-processors table rows | app/apps/web/src/app/(legal)/sub-processors/page.tsx:77-108 | dpas.subProcessors[] (static JSON import, line 3/31) | H0 | n/a | none | handled | n/a | static | Maps over a checked-in JSON array (name, purpose, region, jurisdiction, CLOUD Act, DPA url/status). Versioned source-of-truth config, intended to be static. Has empty fallback (?? []) at line 31. |
| CLOUD Act badge | app/apps/web/src/app/(legal)/sub-processors/page.tsx:22-28,91 | sp.cloudActExposure (static JSON) | H0 | n/a | none | n/a | n/a | static | Pure presentational badge from static field value. |
| Subscribe / cross-link section | app/apps/web/src/app/(legal)/sub-processors/page.tsx:113-134 | hardcoded copy + Link hrefs | H0 | n/a | none | n/a | n/a | static | Static mailto guidance and internal links to /privacy and /security. |

## Pires défauts

_Aucun — statique par design ou fidèle._
