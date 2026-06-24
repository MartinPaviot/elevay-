# S09 — settings-workflows (`/settings/workflows`) — audit d'hydratation

**Verdict global : H2 (partiel).** This is a genuinely wired Settings page: the workflow list, toggles, run counts, and editor all load from and persist to the tenant's real config at tenants.settings.workflows, fully tenant-scoped via eq(tenants.id, authCtx.tenantId) on both GET and PUT, with proper loading/empty/error states. The two defects are both on the error path: optimistic mutations (toggle/delete/save) deliberately do NOT revert on a failed PUT, so the UI silently diverges from the DB; and the AI builder silently substitutes a hardcoded sample workflow when LLM parsing fails, presenting it as a 'Parsed Workflow'. Core data hydration is faithful (H1); these silent-stale/silent-fallback behaviors make the meaningful worst state H2.

Entrée : `app/apps/web/src/app/(dashboard)/settings/workflows/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Workflow list (cards) | app/apps/web/src/app/(dashboard)/settings/workflows/page.tsx:599 | GET /api/settings/workflows -> tenants.settings.workflows, eq(tenants.id, authCtx.tenantId) (route.ts:7-15) | H1 | yes | skeleton | handled | global | once | faithful; tenant-scoped GET, loading skeleton (line 572) + empty state (line 582) + error (line 390) all handled |
| Enable/Pause toggle (Play/Pause) | app/apps/web/src/app/(dashboard)/settings/workflows/page.tsx:613 | reads wf.enabled from loaded config; persists via PUT persist() (page.tsx:260-264, route.ts:72-95) | H2 | yes | none | n/a | silent | once | value loaded from real tenant config and PUT round-trips, but optimistic update never reverts on PUT failure (persist() comment line 170) -> UI shows new state while DB keeps old = silent stale on error |
| Run count / last-run / created date | app/apps/web/src/app/(dashboard)/settings/workflows/page.tsx:656-670 | wf.runCount / wf.lastRunAt / wf.createdAt from tenants.settings.workflows (route.ts:14) | H1 | yes | skeleton | handled | global | once | faithful; rendered from persisted tenant config |
| Steps counter | app/apps/web/src/app/(dashboard)/settings/workflows/page.tsx:650-654 | wf.actions.length from loaded config (route.ts:14) | H1 | yes | skeleton | handled | global | once | faithful; derived from persisted workflow actions |
| Editor: Name / trigger / condition / action params | app/apps/web/src/app/(dashboard)/settings/workflows/page.tsx:400-565 | prefilled via workflowToDraft(wf) on edit (page.tsx:80-95, 182-186); save -> PUT (page.tsx:240-258, route.ts:72) | H1 | yes | none | handled | global | once | on edit, all fields hydrate from the persisted workflow; saveDraft persists via tenant-scoped PUT and the list reflects it |
| Trigger/Action type select option lists | app/apps/web/src/app/(dashboard)/settings/workflows/page.tsx:430-435,511-516 | static const TRIGGER_TYPES / ACTION_TYPES (page.tsx:37-61) | H0 | n/a | none | n/a | n/a | static | static enumerations of supported event/action kinds (chrome), not tenant data -- correct |
| Build with AI (NL parser) result | app/apps/web/src/app/(dashboard)/settings/workflows/page.tsx:765-819 | POST /api/chat (real LLM) with hardcoded fallback workflow on failure (page.tsx:272-314) | H2 | yes | spinner | n/a | silent | once | real LLM call, but on parse failure/non-JSON it silently substitutes a hardcoded default workflow presented as 'Parsed Workflow' -- fallback masks failure with sample-shaped data |
| Beta badge + page help copy | app/apps/web/src/app/(dashboard)/settings/workflows/page.tsx:364-369 | static (page.tsx:365,369) | H0 | n/a | none | n/a | n/a | static | pure help/label chrome -- correct |

## Pires défauts

1. Optimistic toggle/delete/save never reverts on PUT failure (persist() swallows the error and keeps local state -- comment 'Don't revert local state' at page.tsx:170, callers page.tsx:260-269): UI shows the new enabled/deleted state while tenants.settings.workflows still holds the old value = silent stale.
2. AI workflow builder silently falls back to a hardcoded sample workflow (deal_stage_changed + send_notification with raw input as title) on any parse failure or non-JSON LLM response, then renders it under the 'Parsed Workflow' panel as if successfully parsed (page.tsx:296-311).
3. Toggle/delete have no per-row pending/error feedback -- failures only surface via the shared top-level error banner, and because state isn't reverted the row keeps the optimistic value (page.tsx:260-270, 390-394).
