# S29 — settings-capture-approvals (`/settings/capture-approvals`) — audit d'hydratation

**Verdict global : H1 (fidèle).** This Settings page is data-faithful end to end. The capture-mode toggle and per-field hybrid rules load their current values from the tenant's real persisted settings blob (tenants.settings.captureApprovalMode / captureFieldModes) and PATCH them back with optimistic rollback; the pending-approvals queue lists real tenant-scoped capture_approvals rows; approve/reject persist (insert activity / mark status). Every data source is tenant-scoped via getAuthContext().tenantId, loading/empty/error states are all handled, and the empty state is mode-aware. No placeholder, mock, or unwired controls found.

Entrée : `app/apps/web/src/app/(dashboard)/settings/capture-approvals/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Capture mode toggle (auto/review/hybrid) | app/apps/web/src/app/(dashboard)/settings/capture-approvals/page.tsx:193-211 | GET /api/capture-approvals → getCaptureApprovalMode(tenant.settings) (route.ts:25); persisted via PATCH set captureApprovalMode (route.ts:60-70); initial value set in refresh() page.tsx:58 | H1 | yes | none | n/a | independent | once | Current value loaded from real tenant settings, optimistic PATCH round-trips with rollback on failure; reflects stored mode. Faithful. |
| Per-field hybrid rule toggles (meddic/callIntel/callProfile/evidence) | app/apps/web/src/app/(dashboard)/settings/capture-approvals/page.tsx:226-259 | GET returns fieldModes = tenant.settings.captureFieldModes (route.ts:26); persisted via PATCH captureFieldModes merge (route.ts:61-66); loaded into state at page.tsx:59 | H1 | yes | none | n/a | independent | once | Dev-only (QUALIFICATION_EXTRAS_ENABLED gate, prod-hidden) but fully wired: current per-field value from real settings, PATCH persists + rolls back on error. Faithful. |
| Pending approvals queue (cards: kind, activityType, summary, createdAt) | app/apps/web/src/app/(dashboard)/settings/capture-approvals/page.tsx:279-327 | GET /api/capture-approvals → listPendingApprovals(tenantId) (route.ts:18, approval.ts:123-130) scoped by eq(tenantId)+status pending | H1 | yes | spinner | handled | independent | once | Real tenant-scoped rows, mode-aware empty state, Loading… text, error toast. Faithful. |
| Approve / Reject buttons | app/apps/web/src/app/(dashboard)/settings/capture-approvals/page.tsx:305-321 | POST /api/capture-approvals/[id] → approveCapture/rejectCapture (approval.ts:133-181) tenant-scoped; inserts activity / marks status | H1 | yes | spinner | n/a | independent | once | Persists (insert activity on approve, status update on reject), optimistic list removal, error toast surfaces route error. Faithful. |
| Capture mode description copy | app/apps/web/src/app/(dashboard)/settings/capture-approvals/page.tsx:181-185 | static; switches on loaded mode value | H0 | n/a | n/a | n/a | n/a | static | Help text; mode-derived branch is fine. Correctly static. |
| Page header (title/subtitle) | app/apps/web/src/app/(dashboard)/settings/capture-approvals/page.tsx:165-168 | static SettingsHeader props | H0 | n/a | n/a | n/a | n/a | static | Pure chrome. Correctly static. |

## Pires défauts

1. No meaningful defects. Minor: list/mode are fetched once on mount/refresh with no live freshness (acceptable for a settings page). page.tsx:51-70
2. Minor: the GET handler has no try/catch around the DB reads, so a settings/list query failure 500s the route (caught client-side as an error toast, not a leak). app/apps/web/src/app/api/capture-approvals/route.ts:18-27
