# T14 — legal-acceptable-use (`/acceptable-use`) — audit d'hydratation

**Verdict global : H0 (statique).** Acceptable Use Policy legal page. A single default-exported server component rendering hardcoded legal copy. No imports beyond Next's Metadata type, no child components, no data fetching, no API routes or server actions. The only dynamic-looking values (Last updated date, abuse/legal email addresses, company/country) are static legal facts, correctly hardcoded. Legitimately static by design (H0); not a defect.

Entrée : `app/apps/web/src/app/(legal)/acceptable-use/page.tsx`.

## Éléments

| Élément | file:line | Source | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---|---|---|---|---|---|---|---|---|---|
| Page title + last-updated date | app/apps/web/src/app/(legal)/acceptable-use/page.tsx:11-16 | hardcoded legal copy | H0 | n/a | none | n/a | n/a | static | Static heading and 'Last updated: April 1, 2026' literal. Legal versioning date is correctly static, not a data fetch. |
| Policy body sections (1-9) | app/apps/web/src/app/(legal)/acceptable-use/page.tsx:18-270 | hardcoded legal copy | H0 | n/a | none | n/a | n/a | static | All AUP clauses, prohibited-content lists, compliance sections, contact emails (abuse@elevay.dev, legal@elevay.dev), company/country are static text. No state should reflect here. |

## Pires défauts

_Aucun — statique par design ou fidèle._
