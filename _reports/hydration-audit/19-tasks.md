# 19 — tasks (`/tasks`) — audit d'hydratation

**Verdict global : H2 (partiel).** The /tasks page is almost fully faithful: every data-bearing element (task list, title, entity badge, priority, due date, header count, pending/overdue badges, filter-tab counts, entity group headers) is wired to real tenant-scoped data from GET /api/tasks (tasks table filtered by eq(tenantId)+isNull(deletedAt)), with proper skeleton loading and two distinct written empty states (no-tasks vs no-match), and mutations refetch. The one meaningful defect is error handling: fetchTasks swallows any fetch failure (500/401) with console.warn and leaves tasks=[], so a backend error renders the 'No tasks yet' empty state — a silent error→empty conflation with no error UI (H2). A secondary concern is that the entity-name resolution joins companies/contacts/deals by id without a tenantId filter (defensive cross-tenant gap, not an active leak since IDs originate from tenant-scoped tasks).

Entrée : `app/apps/web/src/app/(dashboard)/tasks/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Header subtitle (task count) | app/apps/web/src/app/(dashboard)/tasks/page.tsx:436 | tasks.length from GET /api/tasks → tasks table (app/apps/web/src/app/api/tasks/route.ts:24-29) | H1 | yes | none | handled | silent | once | Real count; updates after each mutation refetch. |
| Pending count badge | app/apps/web/src/app/(dashboard)/tasks/page.tsx:438-440 | derived tasks.filter status!=completed (page.tsx:291) | H1 | yes | none | handled | silent | once | Self-hides when 0 (pendingCount>0 guard). Faithful. |
| Overdue count badge | app/apps/web/src/app/(dashboard)/tasks/page.tsx:441-443 | derived tasks.filter(isOverdue) (page.tsx:292,45-48) | H1 | yes | none | handled | silent | once | Self-hides when 0. Faithful. |
| Filter tab counts (All / Due today / Overdue) | app/apps/web/src/app/(dashboard)/tasks/page.tsx:357-362,460-462 | derived counts (page.tsx:291-293,358) | H1 | yes | none | handled | silent | once | Counts hidden when 0; real derived data. |
| Task row — title | app/apps/web/src/app/(dashboard)/tasks/page.tsx:380-387 | tasks.title from GET /api/tasks (route.ts:24-29,76-81) | H1 | yes | skeleton | handled | silent | once | Real tenant-scoped task; skeleton on load, written empty states for no-tasks/no-match. |
| Task row — entity badge (resolved name) | app/apps/web/src/app/(dashboard)/tasks/page.tsx:390-397 | task.entityName resolved via companies/contacts/deals lookup (route.ts:45-79) | H1 | unknown | skeleton | handled | silent | once | Name lookups query id=ANY(ids) WITHOUT tenantId filter (route.ts:47-74). IDs come from tenant-scoped tasks so no active leak, but defensive gap — names resolved cross-tenant if a task.entityId ever points cross-tenant. Falls back to entityType label when unresolved. |
| Task row — priority badge | app/apps/web/src/app/(dashboard)/tasks/page.tsx:399-415 | tasks.priority from GET /api/tasks | H1 | yes | skeleton | handled | silent | once | Real; click cycles via PATCH (route.ts:36 tenant-scoped). |
| Task row — due date / overdue indicator | app/apps/web/src/app/(dashboard)/tasks/page.tsx:417-426 | tasks.dueDate from GET /api/tasks | H1 | yes | skeleton | handled | silent | once | Real; formatDueDate/isOverdue derived client-side. |
| Entity group headers + count | app/apps/web/src/app/(dashboard)/tasks/page.tsx:531-558 | grouped from sorted tasks (page.tsx:341-355) | H1 | yes | skeleton | handled | silent | once | Group label = resolved entityName; links to /accounts\|/contacts\|/opportunities. Faithful. |

## Pires défauts

1. Silent error→empty conflation: fetchTasks catches all errors with console.warn and sets loading=false, so a 500/401 from /api/tasks renders the 'No tasks yet' empty state instead of an error state — app/apps/web/src/app/(dashboard)/tasks/page.tsx:115-127
2. No independent error degradation / error UI anywhere on the page; the single fetch failing leaves the entire content area showing a misleading empty state — app/apps/web/src/app/(dashboard)/tasks/page.tsx:511-527
3. Entity-name resolution queries companies/contacts/deals by id=ANY(ids) without a tenantId predicate (defensive cross-tenant gap) — app/apps/web/src/app/api/tasks/route.ts:47-74
