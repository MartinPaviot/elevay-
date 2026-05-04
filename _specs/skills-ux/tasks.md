# Skills UX — Tasks

## 1. Add AI section to sidebar nav
- In `sidebar.tsx`, add `Wand2` and `BookOpen` imports from lucide-react
- Insert new "AI" nav section before "CRM" with Knowledge and Skills entries
- **Verify:** Navigate to app — "Knowledge" and "Skills" visible in sidebar
- **Test:** Sidebar renders both links, active state highlights correctly

## 2. Create Skills page route
- Create `app/(dashboard)/skills/page.tsx` as client component
- Fetch skills from `/api/settings/skills` on mount
- Split response into system / workspace / personal groups
- Render three-panel layout: sidebar list (left 280px) + detail panel (right fill)
- **Verify:** Navigate to `/skills` — page loads with system skills listed
- **Test:** API returns both system and custom skills, grouping is correct

## 3. Build skill sidebar component
- Create `components/skills/skill-sidebar.tsx`
- Three collapsible sections with chevron toggle (System expanded by default)
- Each skill: icon + name, click selects and shows in detail panel
- Empty sections: "No skills" text
- **Verify:** Click sections to collapse/expand, click skill to select
- **Test:** All 28 system skills appear, empty workspace/personal show placeholder

## 4. Build skill detail panel
- Create `components/skills/skill-detail.tsx`
- Shows: name, category badge, description, cost estimate
- "Run" button → `router.push('/chat?skill=' + skill.slug)`
- System skills: "Fork to customize" button
- Custom skills: "Edit" and "Delete" buttons
- **Verify:** Select a skill — detail panel populates with all fields
- **Test:** Run button navigates to chat, Fork button triggers dialog

## 5. Build create/edit skill dialog
- Create `components/skills/create-skill-dialog.tsx`
- Dialog with fields: name, description, scope (radio: workspace/personal), steps (dynamic list with add/remove), constraints (dynamic list), guidelines (textarea)
- Submit: POST to `/api/settings/skills`
- Fork mode: pre-fill fields from source skill
- **Verify:** Click "+ Create skill" — dialog opens, fill form, submit — skill appears in list
- **Test:** Created skill persists after page reload

## 6. Build explore grid view
- Create `components/skills/explore-grid.tsx`
- Tab toggle: "List" | "Explore" at top of page
- Explore shows cards in a responsive grid grouped by category
- Each card: name, description, category badge, "Use" button, "Fork" button
- **Verify:** Switch to Explore — card grid renders grouped by category
- **Test:** All categories have at least one card, buttons work

## 7. Wire chat skill pre-fill
- In `app/(dashboard)/chat/page.tsx`, read `searchParams.skill`
- If present, pre-fill the chat input with skill invocation text
- **Verify:** Navigate to `/chat?skill=pipeline-review` — chat input pre-filled
- **Test:** Sending the pre-filled message triggers the skill
