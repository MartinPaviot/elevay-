# S16 — settings-llm-budget (`/settings/llm-budget`) — audit d'hydratation

**Verdict global : H1 (fidèle).** This page is fully and faithfully data-hydrated. Every data-bearing element reads from real tenant-scoped sources: the cap value loads from tenants.settings.llmMonthlyCostCapUsd (eq(tenants.id,tenantId)) and the spend cards/breakdown sum usage_events.metadata.estimatedCost (eq(usageEvents.tenantId,tenantId)). The monthly-cap setting is a genuine H1 control — its current value is seeded from the loaded config, the PUT persists via updateTenantSettings + invalidates the 30s budget cache and re-fetches, and it is admin-gated with validation on both ends. Loading (spinner) and error (toast) states are handled; the by-feature section degrades to a hidden/empty state. No defects found.

Entrée : `app/apps/web/src/app/(dashboard)/settings/llm-budget/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Loading state (spinner) | app/apps/web/src/app/(dashboard)/settings/llm-budget/page.tsx:100-103 | local loading flag set around fetch /api/settings/llm-budget (page.tsx:37-54) | H1 | n/a | spinner | n/a | global | once | faithful — shows 'Loading budget…' spinner while load() runs, replaced by data on resolve |
| This month spend card ($ + tokens + monthStart) | app/apps/web/src/app/(dashboard)/settings/llm-budget/page.tsx:107-117 | GET /api/settings/llm-budget → getTenantCost(tenantId, startOfMonthUtc) summing usage_events.metadata.estimatedCost (route.ts:26-39; cost-tracker.ts:61-94, scoped eq(usageEvents.tenantId,tenantId):69-74) | H1 | yes | spinner | handled | global | once | faithful — real tenant-scoped sum of usage_events for current UTC month; $0/0 tokens is a legitimate zero, not a fake value |
| Cap card (cap $ + percent used / 'No cap') | app/apps/web/src/app/(dashboard)/settings/llm-budget/page.tsx:119-142 | GET → getLlmBudgetStatus(tenantId) reading getTenantSettings.llmMonthlyCostCapUsd (llm-budget.ts:69-128; tenant-settings.ts:542-557 eq(tenants.id,tenantId)) | H1 | yes | spinner | handled | global | once | faithful — capUsd from tenants.settings, percentUsed computed from real spend; 'No cap' is the honest state for unset config |
| Status card (Allowed/Blocked + reason) | app/apps/web/src/app/(dashboard)/settings/llm-budget/page.tsx:144-166 | GET → status.allowed/reason from getLlmBudgetStatus (llm-budget.ts:115-124) | H1 | yes | spinner | handled | global | once | faithful — derived from real spent<cap comparison; human-readable reason on block |
| Monthly cap input ($ / month) + Save | app/apps/web/src/app/(dashboard)/settings/llm-budget/page.tsx:178-191 | initial value seeded from payload.status.capUsd (page.tsx:47); persists via PUT /api/settings/llm-budget → updateTenantSettings({llmMonthlyCostCapUsd}) (route.ts:42-87; tenant-settings.ts:560-574), then reflects back via await load() (page.tsx:78) | H1 | yes | none | handled | independent | once | faithful setting — current value loaded from tenant config, save persists to tenants.settings JSONB + invalidates 30s cache + re-fetches; admin-gated PUT, validation on both client and server |
| Spend by feature bars | app/apps/web/src/app/(dashboard)/settings/llm-budget/page.tsx:196-222 | GET → breakdown.byFeature from getTenantCost grouping usage_events.metadata.feature (cost-tracker.ts:79-88) | H1 | yes | spinner | handled | global | once | faithful — real per-feature cost breakdown; section hidden when empty (byFeatureEntries.length>0), a clean implicit empty state |
| Header title/subtitle + help copy | app/apps/web/src/app/(dashboard)/settings/llm-budget/page.tsx:94-97,171-174 | static (SettingsHeader props + literal description) | H0 | n/a | n/a | n/a | n/a | static | faithful — pure help/label chrome, correctly hardcoded |

## Pires défauts

1. Minor: a load() failure only surfaces a toast and leaves the page on the permanent 'Loading budget…' spinner (no inline error/retry), since status stays null (page.tsx:100-103 + 41-53) — cosmetic, not a hydration-fidelity defect.
2. Minor: GET is not admin-gated (only PUT is), so non-admins see the spend numbers; acceptable as read-only tenant data but worth noting (route.ts:22-40 vs 47-49).
