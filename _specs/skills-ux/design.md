# Skills UX — Design

## System Fit
The skills page surfaces two existing systems:
1. **System skills** — 28 skills in `skills/register-all.ts` registered via `SKILL_REGISTRY` Map. Type: `SkillDefinition` with slug, name, category, description, costEstimate, inputSchema, outputSchema, handler.
2. **Custom skills** — `customSkillTemplates` table with scope (workspace/personal), steps[], constraints[], parameters[], guidelines, outputFormat.

API routes already exist at `/api/settings/skills` (GET/POST) and `/api/settings/skills/[id]` (GET/PUT/DELETE). The executor has `listAvailableSkills()` and `forkSkill()`.

## Data Flow
```
Page load:
  GET /api/settings/skills → returns { systemSkills: SkillDefinition[], customSkills: CustomSkill[] }
  Client groups: System / Workspace (scope=workspace) / Personal (scope=personal, createdBy=me)

Create skill:
  POST /api/settings/skills { name, description, scope, steps, constraints, parameters }
  → inserts into customSkillTemplates → refetch list

Fork skill:
  POST /api/settings/skills { forkFromId: systemSkillSlug, scope: "workspace" }
  → copies system skill fields into customSkillTemplates → refetch list

Run skill:
  Navigate to /chat?skill={slug} → chat page reads query param → pre-fills message
```

## Components
- `app/(dashboard)/skills/page.tsx` — Main page (client component)
- `components/skills/skill-sidebar.tsx` — Left panel with 3 sections
- `components/skills/skill-detail.tsx` — Right panel with skill info
- `components/skills/create-skill-dialog.tsx` — Create/edit dialog
- `components/skills/explore-grid.tsx` — Card grid for explore view

## Navigation Change
In `sidebar.tsx`, insert before the "CRM" section:
```ts
{
  label: "AI",
  items: [
    { label: "Knowledge", href: "/knowledge", icon: BookOpen },
    { label: "Skills", href: "/skills", icon: Wand2 },
  ],
}
```

## API Contract
No new API endpoints needed. Existing `/api/settings/skills` already returns both system and custom skills with the right shape.

## Security
- Workspace skills visible to all tenant members
- Personal skills visible only to creator
- System skills read-only (fork creates a copy)
- Tenant isolation via existing auth middleware
