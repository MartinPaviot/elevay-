# S19 — settings-mailbox-identity (`/settings/mailbox-identity`) — audit d'hydratation

**Verdict global : H1 (fidèle).** This settings page is faithfully data-hydrated. Both data sources (GET /api/settings/mailboxes and GET /api/inbox/mailbox-identity) are auth + tenant/owner scoped, every control (display name, signature, voice) loads its current value from persisted user_preferences JSONB on mount, and Save PATCHes then re-hydrates state from the server's echoed identity so changes round-trip and reflect back. Loading spinner and a written empty state ("No connected mailbox yet") are both handled; save errors raise a toast. Reaches the H1 reference bar.

Entrée : `app/apps/web/src/app/(dashboard)/settings/mailbox-identity/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Mailbox cards list (active connected mailboxes) | page.tsx:114-128 | GET /api/settings/mailboxes -> db.select(connectedMailboxes) eq(tenantId)+eq(userId) (api/settings/mailboxes/route.ts:21-52) | H1 | yes | spinner | handled | silent | once | Real owner+tenant-scoped mailboxes, filtered to status active (page.tsx:50). Loading spinner (91-97), written empty state (108-111). Fetch error falls back to empty list silently (.catch + r.ok?json:{mailboxes:[]}) — degrades to empty, no error surface. |
| Display name input (per mailbox) | page.tsx:133-134 | GET /api/inbox/mailbox-identity -> getMailboxIdentities(userId) from user_preferences JSONB (lib/inbox/mailbox-identity.ts:64-72); PATCH saveMailboxIdentity (route.ts:43-48 / lib:75-92) | H1 | yes | spinner | handled | independent | once | Faithful: value loaded from persisted user_preferences (idn.displayName ?? ''), save PATCHes and re-hydrates from server response (page.tsx:79), 'Saved.' confirmation, toast on error. PATCH guarded by getInboxScope so a forged mailboxId is 404'd. |
| Signature textarea (per mailbox) | page.tsx:138-139 | same as display name — user_preferences.value[mailboxId].signature (lib/inbox/mailbox-identity.ts:64-92) | H1 | yes | spinner | handled | independent | once | Faithful: loaded from persisted config, clamped/saved owner-scoped, server echo re-set into state on save (page.tsx:79). |
| Voice override textarea (per mailbox) | page.tsx:143-144 | same — user_preferences.value[mailboxId].voice (lib/inbox/mailbox-identity.ts:64-92) | H1 | yes | spinner | handled | independent | once | Faithful: loaded, saved, round-trips. scrubAutoSend strips auto-send lines server-side. |
| Mailbox header label (computed display name) | page.tsx:124-127 | derived from loaded identity displayName -> box.displayName -> box.emailAddress (both real fetched data) | H1 | yes | spinner | n/a | n/a | once | Pure derived display from real loaded data; reflects edits live. |
| Page title + helper copy | page.tsx:101-106 | static | H0 | n/a | n/a | n/a | n/a | static | Pure chrome/help text — correctly static. |

## Pires défauts

1. Fetch failures on both GETs degrade silently to empty (page.tsx:45-46,53) — a network/500 on load looks identical to a genuinely empty account, with no error banner or retry (minor H1 polish gap, not a defect in normal operation).
2. No per-card client-side validation feedback; relies on server clamp (lib/inbox/mailbox-identity.ts:37-46) — acceptable but the only error path is a generic save toast (page.tsx:82).
3. Initial load is fetch-once with no revalidation on focus/visibility (page.tsx:42-60); stale if another session edits the same user_preferences row, though save always re-reads the full map server-side so no data loss.
