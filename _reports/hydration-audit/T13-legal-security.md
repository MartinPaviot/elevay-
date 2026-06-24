# T13 — legal-security (`/security`) — audit d'hydratation

**Verdict global : H0 (statique).** Static security/compliance documentation page. The entry file is a single default-exported server component rendering hardcoded prose (architecture, encryption, access control, compliance roadmap, vuln reporting) plus a `metadata` export. No imports of data-bearing components, no fetch/await, no server actions, no props, no client hooks. The only dynamic-looking elements are two next/link to /sub-processors. This is legitimately static copy by design (H0) — there is no real product state this page should reflect, and it makes no claim to render live data.

Entrée : `app/apps/web/src/app/(legal)/security/page.tsx`.

## Éléments

| Élément | file:line | Source | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---|---|---|---|---|---|---|---|---|---|
| Page metadata (title/description) | app/apps/web/src/app/(legal)/security/page.tsx:4-8 | hardcoded static literal | H0 | n/a | n/a | n/a | n/a | static | Static SEO metadata constant; correct for a legal page. |
| "Last updated" date (2026-05-19) | app/apps/web/src/app/(legal)/security/page.tsx:16-18 | hardcoded literal | H0 | n/a | n/a | n/a | n/a | static | Manually maintained date string. Legitimate for a policy doc; not data hydration. |
| Architecture / data-residency list (hosting, DB region, LLM, email, observability) | app/apps/web/src/app/(legal)/security/page.tsx:30-77 | hardcoded prose | H0 | n/a | n/a | n/a | n/a | static | Descriptive compliance copy; not meant to reflect live infra state. |
| Encryption / access control / app-security / backups / logging sections | app/apps/web/src/app/(legal)/security/page.tsx:79-199 | hardcoded prose | H0 | n/a | n/a | n/a | n/a | static | Static documentation of controls; correct as static. |
| Compliance roadmap (ISO/SOC2/GDPR targets) | app/apps/web/src/app/(legal)/security/page.tsx:242-265 | hardcoded prose | H0 | n/a | n/a | n/a | n/a | static | Forward-looking roadmap text; legitimately static. |
| Sub-processors page links | app/apps/web/src/app/(legal)/security/page.tsx:71-72,207-208 | static next/link to /sub-processors | H0 | n/a | n/a | n/a | n/a | static | Plain navigation links; no data binding. |

## Pires défauts

_Aucun — statique par design ou fidèle._
