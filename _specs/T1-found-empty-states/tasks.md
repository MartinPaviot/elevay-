# T1-F7 — Empty states foundation — Tasks

- [x] Extend `components/ui/empty-state.tsx` with variant + secondary action.
- [x] Keep legacy API (icon required only when variant not provided ; now both optional with variant falling back to default icon).
- [x] Typecheck green.
- [ ] Component tests deferred — no DOM environment configured in vitest. Will be added once jsdom is introduced for hook tests (T1-F8 / T1-F1).
- [x] Kiro spec created.
- [x] Commit on feat/T1-found-empty-states.
- [ ] Merge to main.

## Post-tasks
- [x] Typecheck ok
- [x] Vitest ok (300/300 — no regression; no new tests added because of DOM env)
- [ ] Regression pass: manual smoke test on `/accounts` and `/contacts` empty states (deferred until a page is migrated).
