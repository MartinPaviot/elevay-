# T03 — forgot-password (`/forgot-password`) — audit d'hydratation

**Verdict global : H1 (fidèle).** Action-driven password-reset form. On mount it loads no tenant/server state (correct for an auth page) and renders a static email-entry form. On submit it POSTs the typed email to /api/auth/forgot-password (route verified to exist) and unconditionally shows a "check your inbox" confirmation that echoes back the user-typed email. The "If an account exists for {email}" wording is intentional anti-enumeration design (route returns 200 regardless), not faked data. No genuine hydration defect: this page has no real state it should reflect but doesn't.

Entrée : `app/apps/web/src/app/forgot-password/page.tsx`.

## Éléments

| Élément | file:line | Source | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---|---|---|---|---|---|---|---|---|---|
| Email input field | app/apps/web/src/app/forgot-password/page.tsx:89-104 | local useState (user input) | H1 | n/a | none | n/a | n/a | static | Controlled input; no data to hydrate, action-driven form field. |
| Send reset link submit -> /api/auth/forgot-password | app/apps/web/src/app/forgot-password/page.tsx:12-31 | POST /api/auth/forgot-password (route.ts verified to exist) | H1 | n/a | spinner | n/a | silent | once | Genuinely wired to a real API route; loading state + error catch handled. Correctly shows success even on fetch failure to prevent account enumeration. |
| 'Check your inbox' confirmation echoing {email} | app/apps/web/src/app/forgot-password/page.tsx:52-68 | local state (echoes user-typed email) | H1 | n/a | none | n/a | n/a | static | Echoes the user's own input, not server data. 'If an account exists' wording is deliberate anti-enumeration, not faked data. |
| Elevay logo + brand heading | app/apps/web/src/app/forgot-password/page.tsx:47-50 | static asset/copy | H0 | n/a | none | n/a | n/a | static | Legitimately static branding. |

## Pires défauts

_Aucun — statique par design ou fidèle._
