# S25 — settings-inbox-memory (`/settings/inbox-memory`) — audit d'hydratation

**Verdict global : H1 (fidèle).** A fully faithful, cleanly-wired settings page. Every data-bearing control (standing-instruction list, sign-off name, company line) loads its current value from a real owner-scoped store (user_preferences JSONB, resource "inbox"/key "memory") via GET /api/inbox/memory and round-trips through PUT, which clamps and reflects the saved value back into local state. Loading (spinner), empty (written "None yet" copy), and error (fail-soft catch) states are present; no placeholder/mock data anywhere.

Entrée : `app/apps/web/src/app/(dashboard)/settings/inbox-memory/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Page intro / approval-gating help copy | app/apps/web/src/app/(dashboard)/settings/inbox-memory/page.tsx:131-137 | static (hardcoded copy) | H0 | n/a | n/a | n/a | n/a | static | Pure help text describing the feature; correctly static chrome. |
| Standing instructions list (editable rows + add/remove) | app/apps/web/src/app/(dashboard)/settings/inbox-memory/page.tsx:149-178 | GET /api/inbox/memory -> getInboxMemory(userId) (lib/inbox/ai-memory.ts:102-120); persists via PUT -> saveInboxMemory (ai-memory.ts:122-132), reflected back at page.tsx:108-112 | H1 | yes | spinner | handled | silent | once | Faithful. Loaded from owner-scoped user_preferences JSONB (eq userId); save clamps caps/blanks and returns persisted shape set back into state. |
| Standing-instructions empty state ('None yet...') | app/apps/web/src/app/(dashboard)/settings/inbox-memory/page.tsx:144-148 | derived from loaded memory.standingInstructions.length === 0 | H0 | yes | n/a | handled | n/a | once | Written empty state tied to real loaded data. |
| Sign off as (text input) | app/apps/web/src/app/(dashboard)/settings/inbox-memory/page.tsx:188-195 | memory.aboutMe.signOffName from GET /api/inbox/memory (ai-memory.ts:102-120); persisted via PUT saveInboxMemory+clampMemory (ai-memory.ts:65-71,122-132) | H1 | yes | spinner | handled | silent | once | Faithful: current value loaded from owner-scoped config; save round-trips (clamped to 80 chars, reflected back). |
| One line about your company (text input) | app/apps/web/src/app/(dashboard)/settings/inbox-memory/page.tsx:199-206 | memory.aboutMe.companyLine from GET /api/inbox/memory (ai-memory.ts:102-120); persisted via PUT saveInboxMemory+clampMemory (ai-memory.ts:65-71,122-132) | H1 | yes | spinner | handled | silent | once | Faithful: loaded from owner-scoped store, save clamps to 200 chars and reflects persisted value back. |
| Save button + 'Saved.' confirmation | app/apps/web/src/app/(dashboard)/settings/inbox-memory/page.tsx:211-221 | PUT /api/inbox/memory (api/inbox/memory/route.ts:19-35) -> saveInboxMemory (ai-memory.ts:122-132) | H1 | yes | spinner | n/a | silent | once | Save persists to owner-scoped store and sets returned (clamped) memory back into state; saving/saved feedback present. PUT failure swallowed silently (no error toast) — minor. |

## Pires défauts

1. Minor (H2-adjacent, not page-defining): GET/PUT failures are fail-soft swallowed with no visible error state (page.tsx:64 catch{}; page.tsx:114-116 catch{}) — a failed load leaves the form blank as if empty, and a failed save shows no error, only the absence of 'Saved.'
2. Note (not a defect): defaultCc and keyColleagues exist in the store/prompt (ai-memory.ts:31,93) but have no UI control here — incomplete surfacing of the model, not unwired data.
