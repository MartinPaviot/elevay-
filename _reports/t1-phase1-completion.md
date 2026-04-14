# T1 Phase 1 — Foundations — Completion report

**Status:** 13/13 foundations merged to main.
**Completed:** 2026-04-13

## Commits

| ID | SHA | Title |
|---|---|---|
| F7 | `82a15b4` | EmptyState now has 5 canonical variants |
| F8 | `59c1501` | useOptimisticMutation + pure runOptimisticMutation |
| F1 | `43b0d57` | usePaginatedList + PaginatedResponse<T> canonical shape |
| F10 | `02b03ec` | Typed PostHog event helpers |
| Prep | `7301ed1` | Install happy-dom + @testing-library |
| Toast | `5773c86` | Toast supports action buttons, custom duration, a11y |
| F11 | `8230d04` | SkipLink, LiveRegion, useFocusTrap + focus-visible styles |
| F6 | `c388f9e` | useInlineEdit with 10s undo toast |
| F12 | `9318cd2` | Responsive primitives — useBreakpoint, ResponsiveStack, ResponsiveTable |
| F9 | `bc0d602` | useHotkey + shortcut registry + ShortcutHelp overlay |
| F3 | `80b548a` | useSelection + BulkActionsBar |
| F5 | `d8b737b` | DisplayPanel + /api/user-preferences + user_preferences table |
| F4 | `3ec6658` | FilterBuilder + saved_views + /api/views |
| F2 | `7271887` | VirtualTable on @tanstack/react-virtual |
| F13 | `8931830` | @sentry/nextjs integration + logger forward |

## Verification

- **Typecheck:** `npx tsc --noEmit -p .` → exit 0 (only the pre-existing
  node10 deprecation warning).
- **Vitest:** 41 test files, **382 tests passing**. Gain from Phase 1: +56
  cases across 11 new test files.
- **Silent catches in src:** still zero bare `catch {}` (the one in
  `lib/safe-fetch.ts` is a doc comment).
- **Build deps added:** happy-dom, @testing-library/react,
  @testing-library/dom, @types/react-dom, @vitejs/plugin-react,
  @tanstack/react-virtual, @sentry/nextjs.

## Schema additions (3 new tables)

| Migration | Table | Purpose |
|---|---|---|
| `0009_broad_golden_guardian.sql` | `password_reset_tokens` | Credentials reset flow (T0.8) |
| `0010_dashing_human_robot.sql`   | `user_preferences` | DisplayPanel persistence (F5) |
| `0011_fast_rictor.sql`           | `saved_views` | FilterBuilder named views (F4) |

Plus `drizzle/manual/0001_fix_challenge_label.sql` — data-only cleanup
(needs to be applied to each env once).

## New primitives available to Phase 2

**Hooks** (all in `src/hooks/`):
- `useOptimisticMutation(config)` + `runOptimisticMutation` (pure)
- `usePaginatedList<T>(options)`
- `useInlineEdit<T>(config)`
- `useFocusTrap(active)`
- `useBreakpoint()` + `breakpointFor` + `isAtLeast` (pure helpers)
- `useHotkey(combo, handler, opts)`
- `useSelection<T>()`

**Components** (all in `src/components/`):
- `EmptyState` (5 variants)
- `ResponsiveStack` / `ResponsiveTable`
- `ShortcutHelp` overlay
- `BulkActionsBar`
- `DisplayPanel`
- `FilterBuilder`
- `VirtualTable`
- `a11y/SkipLink` / `a11y/LiveRegion`

**Utilities** (all in `src/lib/`):
- `api/paginated-response.ts` (types + `buildListQuery` + `isPaginatedResponse`)
- `filters.ts` (FilterCondition model + serialisation)
- `hotkey-registry.ts` (shared shortcut registry)
- `analytics.ts` extended with typed `posthogEvents.<name>()`

**API endpoints**:
- `GET/PUT /api/user-preferences` (F5)
- `GET/POST/DELETE /api/views` (F4)

**Toast extensions**:
- Optional `action: { label, onClick }` for Undo-style affordances
- `durationMs` override (including Infinity for sticky)
- `useToast()` now returns `{ toast, dismiss }`

## Important for future sessions

1. Use `pnpm test` or `./node_modules/.bin/vitest run` — `npx vitest`
   resolves to the npm-cache version which can't find the project-local
   `happy-dom` and fails `*.dom.test.tsx` files.

2. Tests that need a DOM environment declare `@vitest-environment happy-dom`
   on line 1, or use the `.dom.test.ts(x)` filename convention. The
   default env is still `node` for speed.

3. `@vitejs/plugin-react` is required for `.tsx` test files — the repo's
   `jsx: "preserve"` tsconfig is incompatible with vite's default esbuild
   parser.

4. Sentry config short-circuits when the DSN env var is absent. Safe to
   merge and deploy without setting up the Sentry project first.

## Next: T1 Phase 2

12 branches, 23 items CRITIQUE, ~140h estimated. Order recommended in
`_specs/REQUIREMENTS/NEXT_SESSION_PROMPT.md` §5.1 — first branch is
`feat/T1-signin-I1-I2-I4` (3h). All foundations required by the plan are
now in place, so Phase 2 is unblocked.
