# S03 — settings-members (`/settings/members`) — audit d'hydratation

**Verdict global : H1 (fidèle).** The members settings page is faithfully hydrated: the roster, member count, per-member role select, pending-invite list, and self-avatar all load from real tenant-scoped Postgres queries (every GET filters eq(users.tenantId) / eq(pendingInvites.tenantId)), and every control round-trips through a tenant-scoped mutation that reflects back into local state. Role-gated affordances are seeded from the server DB role via RoleProvider, matching server gates. The only weakness is the lack of a written empty/error state for the roster on load failure (it toasts but renders a blank list), which is a minor H2-level gap rather than a real defect since the workspace always contains the acting user.

Entrée : `app/apps/web/src/app/(dashboard)/settings/members/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Members roster (active workspace members list) | app/apps/web/src/app/(dashboard)/settings/members/page.tsx:495-564 | GET /api/settings/members route.ts:18-43 (db.select users where eq(tenantId) + isNull(deactivatedAt)) | H1 | yes | skeleton | none | global | once | Real tenant-scoped roster; loading skeleton 483-493; isSelf computed server-side. No written empty/error panel, but workspace always contains the acting user; load error only toasts. |
| Member count subtitle (N members) | app/apps/web/src/app/(dashboard)/settings/members/page.tsx:340 | derived from members.length, GET /api/settings/members route.ts:18-43 | H1 | yes | none | n/a | n/a | once | Counts the real tenant-scoped members array; hidden until !loading. |
| Per-member role Select (admin/member/viewer) | app/apps/web/src/app/(dashboard)/settings/members/page.tsx:534-543 | value=member.role from GET route.ts:36; persists via PUT /api/settings/members route.ts:50-115 (tenant-scoped update + returning + audit) | H1 | yes | skeleton | n/a | independent | once | Current value loaded from real persisted users.role; change PUTs tenant-scoped, optimistically reflects (page.tsx:135). Self-demotion blocked server-side (route.ts:73). |
| Pending invitations list (email, role, sent/expires, resend count) | app/apps/web/src/app/(dashboard)/settings/members/page.tsx:421-480 | GET /api/settings/members/invites route.ts:11-29 (db.select pendingInvites where eq(tenantId) + status=pending) | H1 | yes | none | handled | silent | once | Real tenant-scoped pending invites; section renders only when invites.length>0 (acts as empty handling); resend/cancel/copy-link persist and refresh. |
| Self avatar / profile photo (Avatar + Add/Change/Remove) | app/apps/web/src/app/(dashboard)/settings/members/page.tsx:500,516-533 | value member.avatarUrl from GET route.ts:25; persists via PUT /api/account/avatar route.ts:24-103 (user_preferences + users.avatar_url) | H1 | yes | none | handled | global | once | Loaded avatarUrl from real users row; save round-trips, updates local state (page.tsx:77) and router.refresh() to sync sidebar. |
| Invite box (email input + role select + Invite button) | app/apps/web/src/app/(dashboard)/settings/members/page.tsx:355-419 | POST /api/settings/members/invite (handleInvite page.tsx:191); visibility gated by useCan('members:invite') seeded from server DB role via RoleProvider | H1 | yes | none | n/a | independent | static | Write-only control with no stored value to hydrate; role gating sourced from real server role. Faithful. |

## Pires défauts

1. Roster has no written empty/error fallback: on GET /api/settings/members failure the page toasts but leaves a blank list with no degraded panel (page.tsx:494-565; error handled only via toast at line 117).
2. Pending-invites load failure is silent (sfetch silent:true at page.tsx:118) and the section simply does not render — no error indication to the admin (invites/route.ts:11-29).
3. Member + invite data load once on mount with no poll/refresh, so a concurrent admin's role/membership changes stay stale until manual reload (page.tsx:115-124).
