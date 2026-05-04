# Knowledge UX Page

## User Story
As a founder using Elevay, I want to manage my business knowledge from a dedicated page so that the AI agent has context about my company, ICP, objection handling, and sales methodology.

## Acceptance Criteria

### AC1: Top-level navigation
GIVEN I am logged in
WHEN I look at the sidebar
THEN I see a "Knowledge" entry with a BookOpen icon next to Skills
AND clicking it navigates to `/knowledge`

### AC2: Two-scope listing
GIVEN I am on the Knowledge page
WHEN the page loads
THEN I see two collapsible sections: Workspace, Personal
AND Workspace shows entries from `knowledgeEntries` where scope = "workspace"
AND Personal shows entries where scope = "personal" and createdBy = current user
AND each entry shows title and category

### AC3: Knowledge detail panel
GIVEN I am on the Knowledge page
WHEN I click an entry in the left panel
THEN the right panel shows: title, category, scope badge, content (editable markdown textarea), timestamps
AND I can edit the content inline and save

### AC4: Add knowledge
GIVEN I am on the Knowledge page
WHEN I click "+ Add knowledge"
THEN a form opens with: title, category, scope (workspace/personal), content (textarea)
AND submitting POSTs to `/api/settings/knowledge`
AND the new entry appears in the appropriate section

### AC5: File upload
GIVEN I am creating or editing a knowledge entry
WHEN I drop a file (PDF, TXT, MD) on the drop zone
THEN the file content is parsed and inserted into the content textarea
AND the source filename is displayed

### AC6: Auto-injection into chat
GIVEN knowledge entries exist with isActive = true
WHEN I use the chat agent
THEN the system prompt includes all active knowledge entries under a "Knowledge Base" section
AND the agent can reference this knowledge in responses

## Edge Cases
- Empty sections show "No files" placeholder with "+ Add knowledge" CTA
- Large files (>100KB) show a warning before parsing
- Duplicate titles within same scope show a validation error
- Deleting a knowledge entry removes it from chat context immediately

## Evaluation Steps
1. Navigate to `/knowledge` — page loads, two sections visible
2. Click "+ Add knowledge" — form opens, fill title/content, submit — entry appears
3. Edit an entry — change content, save — changes persist on reload
4. Drop a .txt file — content populates in textarea
5. Open chat, ask "What do you know about my business?" — agent references knowledge entries
