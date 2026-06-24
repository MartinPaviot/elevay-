# T05 — verify-email (`/verify-email`) — audit d'hydratation

**Verdict global : H1 (fidèle).** Pure server-component verification flow that faithfully reflects real verification state. It reads the emailed token from searchParams, hashes + validates it against the email_verification_tokens table (rejecting missing/used/expired), stamps auth_user.emailVerified, consumes the token, then redirects based on the real auth() session (signed-in -> /home?verified=1, else /sign-in?reason=email-verified). On failure it renders a friendly error screen whose copy reflects the actual failure reason (missing vs invalid/expired). No faked data; all state is real DB-backed. H1, no defects.

Entrée : `app/apps/web/src/app/verify-email/page.tsx`.

## Éléments

| Élément | file:line | Source | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---|---|---|---|---|---|---|---|---|---|
| Token validation result (success vs error branch) | app/apps/web/src/app/verify-email/page.tsx:35-47 | validateVerifyToken -> db.select from emailVerificationTokens (real DB lookup by SHA-256 hash, un-used + non-expired) | H1 | n/a | none | handled | throws | once | Real token validated against DB; success path stamps emailVerified + consumes token + redirects, failure path renders error screen. Faithful to real verification result. |
| Redirect target (session-aware) | app/apps/web/src/app/verify-email/page.tsx:43-47 | auth() session.user.id compared to row.userId | H1 | yes | none | n/a | throws | once | Redirect reflects real session: signed-in -> /home?verified=1, signed-out -> /sign-in?reason=email-verified. |
| VerifyError screen (missing/invalid reason) | app/apps/web/src/app/verify-email/page.tsx:50-100 | reason prop derived from real token state (no token vs validation null) | H1 | n/a | none | handled | n/a | static | Error title/body reflect the genuine failure mode; CTAs link to sign-in and resend. Static chrome (logo/links) is H0-by-design. |

## Pires défauts

_Aucun — statique par design ou fidèle._
