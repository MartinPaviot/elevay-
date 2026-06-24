# T08 — landing (`/landing`) — audit d'hydratation

**Verdict global : H1 (fidèle).** /landing is a 5-line server component that does nothing but redirect("/") to the root. It renders no UI and bears no data. There is no hydration surface to assess — it is a routing shim, not a page. Legitimately stateless (H0/H1 boundary; effectively H1 since redirect is the correct action). No defect.

Entrée : `app/apps/web/src/app/landing/page.tsx`.

## Éléments

| Élément | file:line | Source | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---|---|---|---|---|---|---|---|---|---|
| page body (redirect only) | app/apps/web/src/app/landing/page.tsx:3-5 | none — calls redirect("/") | H1 | n/a | n/a | n/a | n/a | n/a | Server component LandingRedirect immediately redirect("/"). No data fetch, no rendered markup, nothing to hydrate. Correct by design. |

## Pires défauts

_Aucun — statique par design ou fidèle._
