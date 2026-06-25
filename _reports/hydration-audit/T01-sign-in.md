# T01 — sign-in (`/sign-in`) — audit d'hydratation

**Verdict global : H1 (fidèle).** Action-driven credentials + OAuth sign-in page. It correctly reads real state: auth() is awaited on mount to redirect already-authenticated users (I4), and contextual banners (registered, reason, error, MFA/TOTP reveal) are derived from real searchParams + NextAuth AuthError codes. Sign-in itself is a server-action form (no on-mount tenant fetch needed). No faked or unwired data. This is the correct H1 pattern for an auth page; not a defect.

Entrée : `app/apps/web/src/app/sign-in/page.tsx`.

## Éléments

| Élément | file:line | Source | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---|---|---|---|---|---|---|---|---|---|
| Already-authenticated redirect | app/apps/web/src/app/sign-in/page.tsx:43-46 | auth() session (next-auth v5) | H1 | yes | none | n/a | n/a | once | Awaits real session on mount; bounces to sanitized callbackUrl if a user exists. Reflects real auth state. |
| Registered success banner | app/apps/web/src/app/sign-in/page.tsx:48,80-92 | searchParams.registered | H1 | no | none | handled | n/a | once | Action-driven banner from post-signup redirect param. Correct. |
| Reason banner (e.g. password-reset-success) | app/apps/web/src/app/sign-in/page.tsx:49,93-105 | searchParams.reason via SIGN_IN_REASON_COPY | H1 | no | none | handled | n/a | once | Maps known reason codes to friendly copy; unknown -> null. Real param-driven. |
| Error banner | app/apps/web/src/app/sign-in/page.tsx:50,106-118 | searchParams.error via resolveSignInErrorCopy | H1 | no | none | handled | n/a | once | Reflects real NextAuth/OAuth error types surfaced through redirects. Correct. |
| TOTP/MFA field reveal | app/apps/web/src/app/sign-in/page.tsx:53-54,272-297 | searchParams.error (MfaRequired/InvalidTotp) | H1 | yes | none | handled | n/a | once | Second-factor field appears only after password cleared and account has TOTP — driven by real auth-flow error state. |
| OAuth sign-in (Google / Microsoft) | app/apps/web/src/app/sign-in/page.tsx:121-196 | server action signIn() + provider | H1 | no | none | n/a | independent | n/a | Real server-action OAuth hop with control-flow rethrow and OAuthUnavailable fallback. Action-driven, no fetch needed. |
| Credentials sign-in form | app/apps/web/src/app/sign-in/page.tsx:205-300 | server action signIn('credentials') | H1 | n/a | none | n/a | independent | n/a | Submits to real credentials provider; maps AuthError code/type to error redirect. Correct action-driven form. |
| Branding / legal links / divider copy | app/apps/web/src/app/sign-in/page.tsx:70-78,308-313 | static copy | H0 | no | none | n/a | n/a | static | Legitimately static brand + Terms/Privacy links. Correct. |

## Pires défauts

_Aucun — statique par design ou fidèle._
