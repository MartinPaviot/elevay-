# T02 — sign-up (`/sign-up`) — audit d'hydratation

**Verdict global : H1 (fidèle).** Server component (async) that loads real state on render: it awaits auth() for the session (redirects authed users), validateInviteToken() (real DB lookup with hashed token, status/expiry check), and hasBetaAccess() (cookie check) to gate account creation. It then reflects that real state in the UI — invited email is read from the invite row and locked into a read-only field, and the correct contextual banner (invite vs beta) renders. All form paths are action-driven server actions ("use server") that write real authUsers/authAccounts rows, run password strength + HIBP pwned checks, issue a real verification token, send a real verify email, and auto-sign-in. OAuth buttons trigger real signIn() with inline failure handling. No mock/faked data. This is a correctly-wired, action-driven auth form — H1, not a defect.

Entrée : `app/apps/web/src/app/sign-up/page.tsx`.

## Éléments

| Élément | file:line | Source | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---|---|---|---|---|---|---|---|---|---|
| Session gate (redirect if authed) | app/apps/web/src/app/sign-up/page.tsx:78-81 | auth() session | H1 | yes | none | handled | global | once | Real session read; authed users redirected to invite/callback destination. |
| Invite gating + locked email field | app/apps/web/src/app/sign-up/page.tsx:87-96,439-464 | validateInviteToken() -> pendingInvites DB row | H1 | yes | none | handled | global | once | Real DB lookup (hashed token, status/expiry). invitedEmail and lockEmail derived from the actual invite row; email field locked/read-only to the invited address. |
| Beta-access gate | app/apps/web/src/app/sign-up/page.tsx:88-91 | hasBetaAccess() cookie | H1 | no | none | handled | global | once | Real cookie check; visitors with neither invite nor beta cookie redirected to /. Defense-in-depth re-check inside the action. |
| Invite / beta context banner | app/apps/web/src/app/sign-up/page.tsx:382-408 | inviteToken / betaAccess state | H1 | yes | none | handled | n/a | once | Banner choice reflects real gating state. Generic copy (does not name the actual workspace/inviter though tenantId is available) — personalization gap, not a data-fidelity defect; page does not fake the name. |
| Error messages (field + global banners) | app/apps/web/src/app/sign-up/page.tsx:35-73,340-380,465-510 | searchParams.error from server-action redirects | H1 | no | none | handled | independent | once | Real error codes (EmailExists, PasswordTooShort, PasswordPwned, MissingFields, OAuthUnavailable) routed to the offending field; unknown errors fall back to a global banner. |
| Credentials sign-up action | app/apps/web/src/app/sign-up/page.tsx:106-224 | server action -> authUsers/authAccounts insert + email send | H1 | yes | none | n/a | independent | n/a | Action-driven: real password policy + HIBP pwned check, real DB inserts, real verify-token issue + verify-email send (best-effort), auto-sign-in. No mock. |
| Google / Microsoft OAuth buttons | app/apps/web/src/app/sign-up/page.tsx:250-332 | signIn() server action | H1 | no | none | n/a | independent | n/a | Real signIn() to provider; NEXT_REDIRECT rethrown, real failures land back inline with OAuthUnavailable. Static SVG logos are presentational (H0), not data. |

## Pires défauts

_Aucun — statique par design ou fidèle._
