# T06 — verify-email-sent (`/verify-email-sent`) — audit d'hydratation

**Verdict global : H1 (fidèle).** Post-signup "Check your inbox" page. Server component reads the real session via auth(); redirects signed-out users to /sign-in; renders the actual signed-in email address; derives webmail deep-link buttons from the real email domain via resolveInboxDeepLinks(); resend is a client island hitting a real API route with proper sending/sent/error/cooldown states. Faithfully wired to real state — no faked or unwired data.

Entrée : `app/apps/web/src/app/verify-email-sent/page.tsx`.

## Éléments

| Élément | file:line | Source | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---|---|---|---|---|---|---|---|---|---|
| Email address display | app/apps/web/src/app/verify-email-sent/page.tsx:36,61 | session.user.email via auth() | H1 | yes | none | handled | global | once | Renders the real signed-in user's email from the session; redirects to /sign-in if absent (lines 29-34). |
| Inbox deep-link buttons | app/apps/web/src/app/verify-email-sent/page.tsx:37,67-87 | resolveInboxDeepLinks(email) from inbox-deep-links.ts | H1 | yes | none | handled | n/a | static | Provider buttons derived from the real email domain (detectInboxProvider); falls back to Gmail+Outlook for corp/unknown domains. Real, deterministic mapping — not faked. |
| Resend verification button | app/apps/web/src/app/verify-email-sent/resend-button.tsx:26-42 | POST /api/auth/verify-email/send | H1 | yes | spinner | n/a | independent | once | Client island posting to a real endpoint; idle/sending/sent/error + 30s cooldown all handled. |
| Static helper copy (spam/expiry, headings, skip/sign-out) | app/apps/web/src/app/verify-email-sent/page.tsx:55-99,103-126 | hardcoded copy + signOut server action + sanitized next link | H0 | n/a | none | n/a | n/a | static | Legitimately static instructional copy; sign-out is a server action, Skip uses sanitizeCallbackUrl(next). Correct by design. |

## Pires défauts

_Aucun — statique par design ou fidèle._
