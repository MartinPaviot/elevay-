# T1-F10 — PostHog typed events — Tasks

- [x] Extend `src/lib/analytics.ts` with `EventCatalog`, `posthogEvents`, `KnownEventName`, `KNOWN_EVENT_NAMES`.
- [x] Keep legacy `AnalyticsEvent` + `captureEvent` API intact.
- [x] Replace silent `catch {}` blocks inside `captureEvent` / `identifyUser` with `logger.warn` breadcrumbs (closes the BUGFIX-06 gap on this file).
- [x] Vitest coverage (5 cases): catalog shape sanity, happy path, missing-key no-op, reject-swallow, legacy API intact.
- [x] Typecheck green.
- [x] Kiro spec.
- [x] Commit on feat/T1-found-posthog-events.
- [ ] Merge to main.

## Post-tasks
- [x] Typecheck ok
- [x] Vitest ok (326/326 total, +5 new)
- [ ] No call sites migrated yet — done progressively as Phase 2 items land.
