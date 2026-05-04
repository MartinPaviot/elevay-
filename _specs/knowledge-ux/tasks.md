# Knowledge UX — Tasks

## 1. Create Knowledge page route
- Create `app/(dashboard)/knowledge/page.tsx` as client component
- Fetch entries from `/api/settings/knowledge` on mount
- Split into workspace / personal groups
- Two-panel layout matching Skills page pattern
- **Verify:** Navigate to `/knowledge` — page loads with sections
- **Test:** API returns entries, grouping is correct

## 2. Build knowledge sidebar
- Left panel: Workspace / Personal collapsible sections
- Each entry: title + category badge, click to select
- Empty sections: "No files" + CTA button
- **Verify:** Click entries to select, sections collapse/expand
- **Test:** Empty state shows placeholder

## 3. Build knowledge detail panel
- Right panel: title (editable input), category (select), content (markdown textarea), scope badge, timestamps
- Save button: PUT to `/api/settings/knowledge`
- Delete button with confirmation
- **Verify:** Edit content, save — changes persist on reload
- **Test:** PUT request sends correct payload

## 4. Build add knowledge dialog
- "+ Add knowledge" button opens form
- Fields: title, scope (workspace/personal), category, content (textarea)
- File drop zone below content area
- Submit: POST to `/api/settings/knowledge`
- **Verify:** Create entry — appears in correct section
- **Test:** New entry visible after page reload

## 5. Add file upload parsing
- Drop zone accepts .txt, .md, .pdf files
- TXT/MD: read as UTF-8 via FileReader
- PDF: use pdfjs-dist to extract text pages
- Paste extracted text into content textarea
- Show filename badge when file is source
- **Verify:** Drop a .txt file — content appears in textarea
- **Test:** PDF text extraction produces readable content

## 6. Add schema columns for file source
- In `schema.ts`, add to knowledgeEntries: `sourceType` (text, default 'text'), `sourceFilename` (text, nullable)
- Generate migration
- **Verify:** Migration runs without errors
- **Test:** New entries with sourceType/sourceFilename persist correctly

## 7. Wire knowledge into chat system prompt
- In `api/chat/route.ts`, replace the `tenantSettings.knowledge` read (line ~498) with a DB query:
  `SELECT * FROM knowledgeEntries WHERE tenantId = ? AND isActive = true`
- Format: `## Your Knowledge Base\n### {title}\n{content}` per entry
- Include workspace entries for all users, personal entries only for the current user
- **Verify:** Add a knowledge entry, then ask the chat "What do you know about my business?" — agent references the entry
- **Test:** Knowledge context appears in system prompt
