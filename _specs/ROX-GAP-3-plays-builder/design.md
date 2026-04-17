# ROX-GAP-3 — Design: Plays Builder UI

## System Fit

- DB table `customSkillTemplates` already exists (Sprint 2 schema)
- Settings page pattern established (18 existing settings pages)
- Sidebar nav under Settings

## Pages & Routes

### Settings page: `/settings/plays`
- File: `src/app/(dashboard)/settings/plays/page.tsx`
- Pattern: matches existing settings pages (data-model, workflows, knowledge)

### API routes
- `GET /api/settings/plays` — list all plays for tenant
- `POST /api/settings/plays` — create a new play
- `PUT /api/settings/plays/[id]` — update an existing play
- `DELETE /api/settings/plays/[id]` — delete a play

## UI Components

```
/settings/plays
├── PageHeader "Sales Plays" + "Add play" button
├── EmptyState (if no plays)
└── Play list (cards or table)
    ├── Play card: name, category badge, version, active toggle, edit/delete
    └── Click → edit modal or slide-over

Edit Modal
├── Name (text input)
├── Category (select: qualification/discovery/proposal/objection/closing/re_engage)
├── Description (text input)
├── Guidelines (textarea, markdown)
├── Trigger (optional text — when to suggest this play)
├── Examples (optional textarea — few-shot examples for the LLM)
├── Save / Cancel buttons
```

## Agent Integration

In `src/skills/intelligence/draft-proposal/handler.ts` (and similar skills):
```typescript
// Load custom play if exists for this category
const [play] = await db.select().from(customSkillTemplates)
  .where(and(
    eq(customSkillTemplates.tenantId, options.tenantId),
    eq(customSkillTemplates.category, "proposal"),
    eq(customSkillTemplates.isActive, true),
  ))
  .orderBy(desc(customSkillTemplates.version))
  .limit(1);

if (play) {
  // Inject play guidelines + examples into the LLM prompt
  prompt += `\n\n## Sales Play: ${play.name}\n${play.guidelines}`;
  if (play.examples) prompt += `\n\nExamples:\n${JSON.stringify(play.examples)}`;
}
```

## Sidebar Addition

Add "Plays" link under Settings → Developer section in settings sidebar.
