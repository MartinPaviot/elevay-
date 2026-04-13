# T1-F1 — Server-side pagination hook — Tasks

- [x] Create `src/lib/api/paginated-response.ts` with `PaginatedResponse<T>`, `PaginationMeta`, `isPaginatedResponse` type guard, `buildListQuery` pure helper.
- [x] Create `src/hooks/use-paginated-list.ts` — React hook with request-id guarding against stale responses.
- [x] Tests: 14 vitest cases on the pure helpers (query building, defaults, clamps, filter array serialisation, null drop, empty-string retain, boolean/number coercion, URL encoding; type guard accept/reject for every invalid branch).
- [x] Typecheck green.
- [x] Kiro spec in `_specs/T1-found-pagination/`.
- [x] Commit on feat/T1-found-pagination.
- [ ] Merge to main.

## Post-tasks
- [x] Typecheck ok
- [x] Vitest ok
- [ ] No page migrated yet — accounts + contacts + opportunities migrations are the first callers and happen in T1 Phase 2.

## Future work

- Hook-level tests (render + fetch mocking) once jsdom is introduced.
- Server-side migration of list endpoints to the `PaginatedResponse<T>` shape — tracked per endpoint as we land each Phase 2 page.
- A URL-state adapter (reads `useSearchParams`, writes via `router.push`) can wrap the hook. Keeping the hook URL-agnostic by design so non-URL contexts (modals, drawers) can reuse it.
