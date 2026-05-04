# Skills UX Page

## User Story
As a founder using Elevay, I want to discover, create, and run agent skills from a dedicated page so that I can leverage the 70+ built-in tools and save my own repeatable workflows.

## Acceptance Criteria

### AC1: Top-level navigation
GIVEN I am logged in
WHEN I look at the sidebar
THEN I see a "Skills" entry with a Wand2 icon between Notifications and the Records section
AND clicking it navigates to `/skills`

### AC2: Three-tier skill listing
GIVEN I am on the Skills page
WHEN the page loads
THEN I see three collapsible sections: System, Workspace, Personal
AND System shows all registered system skills from the skills registry
AND Workspace shows skills from `customSkillTemplates` where scope = "workspace"
AND Personal shows skills from `customSkillTemplates` where scope = "personal" and createdByUserId = current user

### AC3: Skill detail panel
GIVEN I am on the Skills page
WHEN I click a skill in the left panel
THEN the right panel shows: name, description, category, steps (if any), parameters (if any)
AND a "Run" button that navigates to `/chat` with the skill name pre-filled as the message
AND system skills show a "Fork" button that creates an editable copy in Workspace scope

### AC4: Create skill
GIVEN I am on the Skills page
WHEN I click "+ Create skill"
THEN a dialog opens with fields: name, description, scope (workspace/personal), steps, constraints, parameters
AND submitting POSTs to `/api/settings/skills`
AND the new skill appears in the appropriate section

### AC5: Explore view
GIVEN I am on the Skills page
WHEN I click the "Explore" tab
THEN I see all system skills displayed as cards in a grid
AND cards are grouped by category
AND each card shows name + description + "Use" and "Fork" buttons

## Edge Cases
- Empty workspace/personal sections show "No skills" placeholder
- Forking a system skill pre-fills all fields and sets scope to "workspace"
- Skills with no steps still show description and "Run" button
- Long skill names truncate with ellipsis in the sidebar list

## Evaluation Steps
1. Navigate to `/skills` — page loads, three sections visible
2. Click a system skill — detail panel populates
3. Click "Run" — navigates to chat with skill name
4. Click "+ Create skill" — dialog opens, fill form, submit — skill appears
5. Fork a system skill — copy appears in Workspace
6. Click "Explore" — card grid view renders
