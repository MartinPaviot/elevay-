# T07 — accept-invite (`/accept-invite`) — audit d'hydratation

**Verdict global : H1 (fidèle).** Action-driven invite-acceptance page that faithfully loads and renders real state. On mount it fetches GET /api/auth/invite/[token], which validates the SHA-256-hashed token against pending invites and returns the real workspace name (tenants.name), role, invited email, expiry, and an authUsers existence check. The UI shows the actual inviting workspace and inviter-assigned role (NOT a generic placeholder), branches CTAs on whether the email already has an account, and covers loading/invalid(with specific reasons)/valid/accepting/accepted/wrong_account states. Accept POST handles 401 (redirect to sign-in), 403 (wrong account, shows invited email), and requiresReauth (sign out to refresh stale-tenant JWT). Exemplary H1 with no fabricated or unwired data.

Entrée : `app/apps/web/src/app/accept-invite/page.tsx`.

## Éléments

| Élément | file:line | Source | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---|---|---|---|---|---|---|---|---|---|
| Workspace name header (Join {workspace}) | app/apps/web/src/app/accept-invite/page.tsx:144,146 | GET /api/auth/invite/[token] -> tenants.name (real DB) | H1 | yes | none | handled | global | once | Real tenant name from DB via validateInviteToken + tenants lookup; falls back to 'the workspace' only if name null |
| Inviter role (as a {role}) | app/apps/web/src/app/accept-invite/page.tsx:147 | invite.role from pending invite record | H1 | yes | none | n/a | global | once | Real role from invite record |
| Invited email (Invitation for {email}) | app/apps/web/src/app/accept-invite/page.tsx:150 | invite.email from validated token | H1 | yes | none | n/a | global | once | Real invited address from token validation |
| hasAccount branch (sign-in vs create-account CTA) | app/apps/web/src/app/accept-invite/page.tsx:141,151-156 | authUsers lookup by invited email | H1 | no | none | handled | global | once | Real account-existence check drives the correct primary action |
| Invalid-state reason copy | app/apps/web/src/app/accept-invite/page.tsx:129-135,259-268 | API reason code (expired/cancelled/accepted/not_found/missing_token) | H1 | n/a | none | n/a | independent | once | Reflects the real validation outcome with specific friendly messages |
| Accept result / requiresReauth redirect | app/apps/web/src/app/accept-invite/page.tsx:90-98,200-209 | POST /api/auth/invite/accept (requiresReauth flag) | H1 | yes | none | n/a | independent | once | Reflects real accept outcome; signs out for stale-tenant JWT when moving workspaces |
| wrong_account guard (403) | app/apps/web/src/app/accept-invite/page.tsx:69-76,211-230 | POST accept 403 + invited email | H1 | yes | none | n/a | independent | once | Real server-enforced identity mismatch surfaced with the invited address |

## Pires défauts

_Aucun — statique par design ou fidèle._
