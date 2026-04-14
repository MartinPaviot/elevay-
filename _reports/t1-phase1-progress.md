# T1 Phase 1 — Foundations — Progress report (partial)

**Session ended at:** 2026-04-13 (same session as T0).
**Status:** 4 of 13 foundations merged to main.

## Completed

| ID | SHA | Title |
|---|---|---|
| F7 | `82a15b4` | feat(ui): EmptyState now has 5 canonical variants |
| F8 | `59c1501` | feat(hooks): useOptimisticMutation + pure runOptimisticMutation |
| F1 | `43b0d57` | feat(hooks): usePaginatedList + PaginatedResponse<T> canonical shape |
| F10 | `02b03ec` | feat(analytics): typed PostHog event helpers |

## Test state

- Typecheck: clean (only the pre-existing node10 deprecation warning).
- Vitest: **326/326 passing** (38 files). Gained 33 new cases from
  Phase 1:
  - 7 chunk-bulk (T0.5 — already counted earlier)
  - 7 use-optimistic-mutation
  - 14 paginated-response
  - 5 analytics-events

## Deferred / not started

| ID | Reason |
|---|---|
| F6 inline-edit hook | Requires extending `components/ui/toast.tsx` to support action buttons (Undo) first. The current toast API is message+variant only. A small refactor to accept an optional `action: { label, onClick }` unblocks this. |
| F2 VirtualTable | Requires `@tanstack/react-virtual` install + DOM env for meaningful tests. |
| F3 BulkActionsBar + useSelection | Pure React component; doable without DOM env but needs a caller to be truly useful; better bundled with the first Phase 2 list migration. |
| F4 FilterBuilder | Biggest component (~10h). Requires the `saved_views` table migration + `/api/views` endpoint. |
| F5 DisplayPanel | Requires `/api/user-preferences` endpoint + table migration. |
| F9 Keyboard shortcuts | Needs `react-hotkeys-hook` install + a registry pattern; standalone. |
| F11 A11y pack | Small; next natural addition. Needs jsdom for useFocusTrap tests. |
| F12 Responsive primitives | Small; standalone. |
| F13 Sentry | Needs `@sentry/nextjs` install + env vars + prod rollout plan. |

## Recommendations for next session

Order by leverage (most unlocks per hour):

1. **Install jsdom + @testing-library/react** (~5 min) so hook-level
   tests for F8/F1/F6 become possible and a11y (F11) focus-trap tests
   can land.
2. **F11 A11y pack** (~2-3h once DOM env is installed). SkipLink,
   LiveRegion, useFocusTrap, :focus-visible styles in globals.css.
3. **Toast action API extension** (~1h). Pure refactor of
   `components/ui/toast.tsx` to accept `toast(message, variant, {
   action: { label, onClick } })`. Unblocks F6.
4. **F6 inline-edit hook** (~2h).
5. **F13 Sentry** (~5-6h once the env vars + DSN are decided).
6. **F9 keyboard shortcuts** (~3h).
7. **F2 VirtualTable + F3 BulkActions + F5 DisplayPanel + F4 FilterBuilder**
   as they become needed by the first Phase 2 list migration
   (`feat/T1-accounts-A1-A3` is the natural first consumer).

## Important constraint for future sessions

`npx vitest run` and `npx tsc --noEmit -p .` must be invoked with cwd
= `app/apps/web`. Running from `/c/Users/marti/leads` (the repo
root) silently fails to resolve the `@/…` alias and the suite appears
broken. Check via `pwd` at the start of each Bash call or always `cd`
before the command.
