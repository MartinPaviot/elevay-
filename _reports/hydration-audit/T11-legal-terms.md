# T11 — legal-terms (`/terms`) — audit d'hydratation

**Verdict global : H0 (statique).** The /terms page is a fully static server component rendering hardcoded Terms of Service legal copy. It imports only Next.js Metadata type, fetches no data, references no tenant/user state, and has no child components or API routes. The "Last updated: April 1, 2026" date and all section content are literal strings. This is correct and expected for a legal page (H0). No data-hydration defect.

Entrée : `app/apps/web/src/app/(legal)/terms/page.tsx`.

## Éléments

| Élément | file:line | Source | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---|---|---|---|---|---|---|---|---|---|
| Last updated date | app/apps/web/src/app/(legal)/terms/page.tsx:15 | hardcoded string "April 1, 2026" | H0 | n/a | n/a | n/a | n/a | static | Static legal-copy date; appropriate to hardcode. |
| All ToS section bodies (1-15) | app/apps/web/src/app/(legal)/terms/page.tsx:20-313 | hardcoded JSX copy | H0 | n/a | n/a | n/a | n/a | static | Legal text legitimately static; no state should be reflected. |
| Contact email / company / country | app/apps/web/src/app/(legal)/terms/page.tsx:302-312 | hardcoded (legal@elevay.dev, Elevay, France) | H0 | n/a | n/a | n/a | n/a | static | Static contact info; correct for legal page. |

## Pires défauts

_Aucun — statique par design ou fidèle._
