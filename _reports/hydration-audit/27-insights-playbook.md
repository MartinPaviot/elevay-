# 27 — insights-playbook (`/insights/playbook`) — audit d'hydratation

**Verdict global : H2 (partiel).** The Playbook page is a faithful, near-reference-bar data-hydration implementation. Every data-bearing element is fed by real tenant-scoped data from GET /api/playbook (auth via getAuthContext, eq(playbookEntries.tenantId, authCtx.tenantId)), with loading, written empty state, and an independent error banner all handled. The only meaningful gap is that the loading indicator is gated on entries.length===0, so re-fetching after a filter switch shows stale entries silently with no spinner (H2 on the refresh path); the initial load and all element wiring are H1.

Entrée : `app/apps/web/src/app/(dashboard)/insights/playbook/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Page header (title + subtitle) | app/apps/web/src/app/(dashboard)/insights/playbook/page.tsx:75 | static (hardcoded copy) | H0 | n/a | n/a | n/a | n/a | static | Pure chrome — appropriate static label/subtitle, not a data element. |
| Type filter chips (All/Objections/Hooks/Questions) | app/apps/web/src/app/(dashboard)/insights/playbook/page.tsx:82-94 | static PLAYBOOK_ENTRY_TYPES + TYPE_LABELS (lib/playbook/capture.ts:20) | H0 | n/a | n/a | n/a | n/a | static | Static filter taxonomy, not data — appropriate chrome. Drives the ?type= query. |
| Entry list (cards) | app/apps/web/src/app/(dashboard)/insights/playbook/page.tsx:144-148 | GET /api/playbook (app/apps/web/src/app/api/playbook/route.ts:27-79) → db.select from playbookEntries, tenant-scoped at route.ts:44 | H2 | yes | spinner | handled | independent | once | Real tenant-scoped data; loading + written empty + error all handled on initial load. H2 because the 'Loading…' indicator is gated on entries.length===0 (page.tsx:133), so a filter switch re-fetch shows stale entries with no loading cue (silent stale during refetch). |
| Entry type pill | app/apps/web/src/app/(dashboard)/insights/playbook/page.tsx:195 | entry.type from GET /api/playbook (route.ts:60), column playbook_entries.type (db/schema/intelligence.ts:732) | H1 | yes | spinner | handled | independent | once | Faithful — real per-row tenant-scoped field. |
| Outcome label | app/apps/web/src/app/(dashboard)/insights/playbook/page.tsx:197-201 | entry.outcomeLabel from route.ts:63, column outcome_label (intelligence.ts:743) | H1 | yes | spinner | handled | independent | once | Faithful — conditionally rendered only when present (self-hides on null). |
| Entry content body | app/apps/web/src/app/(dashboard)/insights/playbook/page.tsx:203-208 | entry.content from route.ts:61, column content (intelligence.ts:733) | H1 | yes | spinner | handled | independent | once | Faithful — real tenant-scoped text. |
| Perf badge (score %) | app/apps/web/src/app/(dashboard)/insights/playbook/page.tsx:210,217-244 | entry.perfScore from route.ts:64, column perf_score (intelligence.ts:744) | H1 | yes | spinner | handled | independent | once | Faithful — real 0..1 scalar; null renders an explicit 'unrated' state (handled empty for the field). |
| Add-entry form (write path) | app/apps/web/src/app/(dashboard)/insights/playbook/page.tsx:265-405 | POST /api/playbook (route.ts:81-123) → validatePlaybookEntry + tenant-scoped insert (route.ts:112) | H1 | yes | spinner | n/a | independent | once | Write-side wired to the real tenant-scoped insert with server-side validation; surfaces server error message and refetches on success. |

## Pires défauts

1. Loading indicator is gated on entries.length===0 (app/apps/web/src/app/(dashboard)/insights/playbook/page.tsx:133), so switching the type filter re-fetches while showing the previous filter's entries with no loading cue — a brief silent-stale window (H2).
2. List freshness is fetch-once on mount/filter-change (page.tsx:69-71) with no polling or focus revalidation, so LLM-captured entries added after page load (the documented Inngest capture sink) won't appear until manual reload.
3. No per-row stale/updatedAt surfacing despite updatedAt being selected (route.ts:66) and the schema tracking it — minor, the field is fetched but never displayed.
