# T12 — legal-privacy (`/privacy`) — audit d'hydratation

**Verdict global : H0 (statique).** Static legal page rendering the Privacy Policy. The only data-bearing elements are the "Last updated" date and the sub-processors table, both sourced from a static build-time JSON import (@/data/dpas.json) — the canonical source also used by the /sub-processors page. There is no per-tenant or runtime state this page should reflect; legal copy is identical for all visitors. This is legitimately static (H0), which is correct for a legal page. No defects.

Entrée : `app/apps/web/src/app/(legal)/privacy/page.tsx`.

## Éléments

| Élément | file:line | Source | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---|---|---|---|---|---|---|---|---|---|
| Last updated date | app/apps/web/src/app/(legal)/privacy/page.tsx:31 | static import dpas.lastUpdated from @/data/dpas.json | H0 | no | none | n/a | n/a | static | Legal-copy versioning field from the canonical static DPA registry. Build-time constant; no runtime/tenant state to reflect. |
| Sub-processors table | app/apps/web/src/app/(legal)/privacy/page.tsx:254-261 | static import dpas.subProcessors from @/data/dpas.json | H0 | no | none | handled | n/a | static | Maps the canonical sub-processor list from the bundled JSON. Same source as the dedicated /sub-processors page. Identical for all visitors; correctly static legal disclosure, not tenant data. |
| Privacy policy body (controller, rights, retention, transfers, cookies, contacts) | app/apps/web/src/app/(legal)/privacy/page.tsx:34-424 | hardcoded JSX copy | H0 | no | none | n/a | n/a | static | Static legal prose. Legitimately hardcoded; no state to hydrate. |

## Pires défauts

_Aucun — statique par design ou fidèle._
