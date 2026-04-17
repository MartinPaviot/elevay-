# ROX-GAP-3 — Tasks

## T1: Create API routes for plays CRUD
- Files: `src/app/api/settings/plays/route.ts` (GET + POST)
- File: `src/app/api/settings/plays/[id]/route.ts` (PUT + DELETE)
- Auth: `getAuthContext()` + tenant-scoped
- GET: list all plays for tenant, ordered by category then name
- POST: create, auto-generate slug from name, set version=1
- PUT: update fields, increment version, set updatedAt
- DELETE: hard delete
- Verify: all routes compile, return correct status codes

## T2: Create settings page UI
- File: `src/app/(dashboard)/settings/plays/page.tsx`
- List view: cards with name, category badge, version, active toggle
- Empty state with "Add your first play" CTA
- "Add play" button opens create modal
- Click card opens edit modal
- Verify: page renders, matches settings design language

## T3: Create/Edit modal component
- Inline in the page (pattern matches workflows page)
- Fields: name, category (select), description, guidelines (textarea), trigger, examples (textarea)
- Save fires POST or PUT depending on mode
- Cancel closes modal
- Verify: create + edit work, form validates name required

## T4: Add active toggle
- In the list card, toggle switch calls PUT with `isActive` flip
- Visual: active = accent color, inactive = muted
- Verify: toggle persists after reload

## T5: Add to settings sidebar
- File: `src/app/(dashboard)/settings/settings-sidebar.tsx`
- Add "Plays" link under appropriate section
- Icon: `Layers` or `BookOpen` from lucide
- Verify: sidebar link visible, navigates to `/settings/plays`

## T6: Agent integration — load custom plays in skill handlers
- Files: `src/skills/intelligence/draft-proposal/handler.ts`, `handle-objection/handler.ts`, `scope-poc/handler.ts`, `re-engage-stalled/handler.ts`
- Before the LLM call, query `customSkillTemplates` for matching category + isActive
- If found, append guidelines + examples to prompt
- Verify: custom play content appears in LLM output when a play is active

## T7: Write tests
- File: `src/__tests__/plays-crud.test.ts`
- Test: create play → list includes it
- Test: update play → version increments
- Test: delete play → list excludes it
- Test: inactive play not loaded by agent
- Verify: all tests pass
