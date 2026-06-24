# T04 — reset-password (`/reset-password`) — audit d'hydratation

**Verdict global : H1 (fidèle).** Client-side, action-driven password reset form. Reads the reset token from the URL query string (useSearchParams) and POSTs {token, password} to /api/auth/reset-password, then redirects to sign-in on success. No on-mount tenant/state fetch is expected here. Handles the missing-token case with an "Invalid reset link" state and the error/loading/match-validation states. This is the correct shape for an auth form (H1) — not a data-hydration defect.

Entrée : `app/apps/web/src/app/reset-password/page.tsx`.

## Éléments

| Élément | file:line | Source | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---|---|---|---|---|---|---|---|---|---|
| Reset token (from URL) | app/apps/web/src/app/reset-password/page.tsx:9-11,51-70 | useSearchParams() query param ?token= | H1 | n/a | n/a | handled | independent | static | Real value pulled from URL; missing-token branch renders an 'Invalid reset link' state with a link to /forgot-password. Correct. |
| Password reset submission | app/apps/web/src/app/reset-password/page.tsx:17-49,83-152 | POST /api/auth/reset-password (action-driven) | H1 | n/a | spinner | n/a | independent | n/a | Action-driven write; client-side validation (match + clientAcceptable), loading button state, role=alert error surface, redirect to /sign-in?reason=password-reset-success on success. Correct for an auth form. |
| Brand header (logo + name) | app/apps/web/src/app/reset-password/page.tsx:182-185 | static asset / copy | H0 | n/a | none | n/a | n/a | static | Legitimately static branding chrome. |

## Pires défauts

_Aucun — statique par design ou fidèle._
