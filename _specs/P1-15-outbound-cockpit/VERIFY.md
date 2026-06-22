# P1-15 — outbound-cockpit — Verification (2026-06-22)

Branch `feat/agentic-p1`. The priority brain of the "Outbound du jour" cockpit —
the pure logic that merges + orders the day's queue. No migration.

## What shipped (deploy-safe core)
- `lib/outbound/queue.ts`: `buildOutboundQueue(items, now)` + `itemPriority` —
  orders replies → overdue reminders → upcoming reminders → drafts (by
  qualityScore desc, signal-freshness tie-break). Null qualityScore uses the
  `QUALITY_SENTINEL` (0.5). Pure + deterministic (now injected); stable sort.

## Tests (5, green) + tsc 0
- replies-first then overdue/upcoming reminders then drafts; drafts by quality
  with the null sentinel; freshness tie-break; priority bands; empty → [].

## Deferred (the UI build + migration — the spec's T1/T4/T7-T11)
The MVP cockpit is a ~6-day UI build, deferred as a focused follow-up:
- **Migration**: `sequenceDrafts.qualityScore real` column + index (T1) — needed so
  the queue can sort real scores (today qualityScore is in-memory from P0-3, not
  persisted). Migration-coupled → not applied from this branch.
- T2/T3: persist score + citations at generation; expose qualityScore in the
  drafts list.
- T4: `GET /api/outbound/queue` endpoint (consumes `buildOutboundQueue`).
- T5/T6: extract `ResizeHandle` + `useDraftActions` from call-mode/review.
- T7-T10: the `/outbound-mode` page (3-col immersive, auto-advance, j/k/a/r,
  "Why this draft" with P1-11 citations, PageActions + nav).
- T11: Playwright E2E.
This commit lands the prioritization logic the endpoint + page will render.
