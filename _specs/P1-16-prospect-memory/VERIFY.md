# P1-16 — prospect-memory — Verification (2026-06-22)

Branch `feat/agentic-p1`. The schema-less memory graph already existed
(`context-graph.ts` + `enriched-prospect-context.ts`) but its per-contact read
was BROKEN. This fixes the bug and exposes a public loader. No migration
(the tables exist).

## What shipped (deploy-safe core)
- **Critical bug fix (T2)**: `enriched-prospect-context.ts:223` used
  `eq(contextGraphEdges.tExpired, null)` — i.e. `t_expired = NULL` in SQL, which
  is ALWAYS false, so `loadGraphFacts` returned NOTHING. Replaced with
  `isNull(...)`. The existing memory graph now actually returns facts.
- **Public loader (T3)**: `loadGraphFactsForContact(contactId, tenantId)` — valid
  facts only, sorted confidence desc then date desc, capped at 8. Ready for the
  draft "Why this draft" route (T6) and the generation prompt (T4).

## Tests (2 new, 13 in run, green) + tsc 0
- `enriched-context-facts.test.ts` — no nodes → []; valid facts sorted by
  confidence desc + capped at 8 (lowest dropped). Existing
  enriched-prospect-context suite still green (the isNull fix doesn't break it).

## Deferred (mechanical follow-up — the payoff of the fix)
- T1: resolve CRM `entityId` at ingestion (`resolveCrmEntityId` in
  context-graph.ts) so episodes attach to the right contact/company.
- T4: use `formatEnrichedContextForPrompt` in `buildGenerationPrompt` when the ctx
  is enriched (memory affects generation).
- T5: build the enriched context in the generateSequence call-sites
  (`withTimeout(buildEnrichedContext, 4000)` + fallback).
- T6: surface `memoryFacts = loadGraphFactsForContact(...)` in the draft context
  route (the "Why this draft" panel) — the NL-citable memory the charter promises.
The bug fix is the unlock; T4/T5/T6 are the wiring that makes it visible/active.
