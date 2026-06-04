# PROPOSAL-003: Trust stack (confidence + abstention + citations)

Makes "proofread-only" honest. Each filled component carries a confidence, may
abstain instead of fabricating, and cites the exact source interactions it drew
from. The review UX triages low-confidence first. No migration —
`proposal_components.confidence` + `.source` (jsonb) were reserved in 002.

## Requirements (GIVEN/WHEN/THEN)
**AC1 (field confidence)** GIVEN a field component, WHEN filled, THEN confidence is
`high` if its dataKey resolved to a non-empty value, else `low` + `abstained=true`
(the field could not be sourced — never a fabricated value).
**AC2 (section confidence + abstention)** GIVEN a section, WHEN generated, THEN the
LLM returns its own `confidence` and, if NO grounding exists in the provided source
interactions, sets `abstained=true` with empty content (never invents facts).
**AC3 (citations)** GIVEN a generated section, THEN it lists the ids of the source
interactions it used; each resolves to `{type, date, label, snippet}` (which
email/meeting/note). Fields cite their dataKey source.
**AC4 (persist)** WHEN fill completes, THEN each `proposal_components` row stores
`confidence` and `source = { citations, abstained }`, tenant-scoped.
**AC5 (surface + triage)** THEN the fill output, the detail route, and the UI expose
per-component confidence + abstained + citations, and the review list is ordered
**low-confidence first** so the proofreader hits the risky parts first.

### Edge cases
- No interactions on file → sources block is empty; every section abstains low.
- LLM cites an id that isn't in the source set → dropped (only valid ids resolve).
- Field-only template → all-deterministic confidence, no LLM call.

## Design
- `lib/proposals/sources.ts` — `collectCitableSources(tenantId, {dealId, companyId,
  contactId})`: tenant-scoped activities + notes → enumerated `[A1]/[N1]` sources +
  an LLM-ready block + an id→source map.
- `lib/proposals/fill.ts` — `generateSections` now returns
  `{ content, confidence, citationIds, abstained }` per section (LLM schema +
  prompt updated to cite + self-rate + abstain). `buildProposalFill` resolves field
  confidence, resolves section citationIds→Citation[], persists `confidence` +
  `source`; `FilledComponent` gains `confidence|abstained|citations`.
- Detail route returns `confidence` + `source`. Skill output schema extended.
- UI: confidence badge (green/amber/red) + abstained flag + citations per component;
  filled list sorted low-confidence first.

## Tasks
1. `sources.ts` (+ test, mocked db).
2. `fill.ts` trust refactor (+ updated fill.test).
3. proposal-fill skill output schema; detail route confidence/source.
4. UI: badges + citations + low-confidence-first triage.
5. tsc + full regression. PASS → 003 done.
