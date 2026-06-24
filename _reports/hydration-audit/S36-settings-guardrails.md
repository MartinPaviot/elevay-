# S36 — settings-guardrails (`/settings/guardrails`) — audit d'hydratation

**Verdict global : H1 (fidèle).** The Guardrails settings page is faithfully hydrated. Every data-bearing control loads its current value from real tenant-scoped persisted config (both GET routes scope on authCtx.tenantId), the approval-mode selector round-trips through a PUT with optimistic rollback, and the sending-infra summary degrades to an explicit 'Couldn't load' empty state. The only blemish is a silent non-ok branch on the workspace GET that can leave the approval section with no button highlighted and no error toast; otherwise this matches the Home-page reference bar.

Entrée : `app/apps/web/src/app/(dashboard)/settings/guardrails/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Approval mode selector (review-each / batch-daily / auto-high-confidence buttons) | app/apps/web/src/app/(dashboard)/settings/guardrails/page.tsx:213-254 | GET /api/settings/workspace → tenant.settings via readApprovalMode (app/apps/web/src/app/api/settings/workspace/route.ts:18,38; lib/guardrails/approval-mode.ts:41); persist PUT /api/settings/workspace (route.ts:88-100) called from saveApprovalModeValue (page.tsx:132-154) | H1 | yes | spinner | n/a | silent | once | Faithful: current value loaded from real tenant-scoped settings, optimistic PUT round-trips with rollback, loading spinner present. Minor: if workspaceRes is non-ok (not a thrown error), approvalMode stays null and no button is highlighted with no error message shown (page.tsx:107-110). |
| Sending infra — Mode | app/apps/web/src/app/(dashboard)/settings/guardrails/page.tsx:279-284 | GET /api/settings/sending-infra → getTenantSettings(tenantId).sendingMailboxMode (app/apps/web/src/app/api/settings/sending-infra/route.ts:33,48) | H1 | yes | none | handled | silent | once | Read-only summary; tenant-scoped real value with loading + 'Couldn\'t load' error fallback (page.tsx:304-308). Edits happen on the linked /settings/sending-infrastructure page. |
| Sending infra — Daily cap (primary) | app/apps/web/src/app/(dashboard)/settings/guardrails/page.tsx:285-290 | GET /api/settings/sending-infra → settings.sendingDailyCapPrimary (route.ts:49) | H1 | yes | none | handled | silent | once | Faithful read-only summary, tenant-scoped, with shared loading/error fallback. |
| Sending infra — Cold on primary (Allowed/Blocked) | app/apps/web/src/app/(dashboard)/settings/guardrails/page.tsx:291-296 | GET /api/settings/sending-infra → settings.sendingAllowColdOnPrimary (route.ts:50) | H1 | yes | none | handled | silent | once | Faithful read-only summary, tenant-scoped. |
| Sending infra — Instantly (Connected/Not connected) | app/apps/web/src/app/(dashboard)/settings/guardrails/page.tsx:297-302 | GET /api/settings/sending-infra → !!settings.instantlyCredentialsEncrypted (route.ts:51-57) | H1 | yes | none | handled | silent | once | Faithful: derived from real tenant-scoped encrypted-credential presence, never returns the key. |
| LLM budget card (copy + Configure link) | app/apps/web/src/app/(dashboard)/settings/guardrails/page.tsx:313-329 | static — hardcoded help copy + link to /settings/llm-budget (no fetch) | H0 | n/a | n/a | n/a | n/a | static | Pure chrome/help text by design — intentionally delegates live spend to /settings/llm-budget. Correctly H0. |

## Pires défauts

1. Silent error gap: in load(), a non-ok (non-thrown) workspace GET leaves approvalMode=null with no highlighted option and no error message — only thrown errors toast (app/apps/web/src/app/(dashboard)/settings/guardrails/page.tsx:107-119).
2. Approval-mode section has no error UI distinct from loading: after a failed load it renders the buttons with none active rather than a written error state like the sending-infra card has (page.tsx:206-256).
3. Sending-infra summary load errors are swallowed into a single generic 'Couldn't load' line with no retry affordance (page.tsx:304-308).
