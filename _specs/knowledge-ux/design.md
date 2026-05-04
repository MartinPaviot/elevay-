# Knowledge UX — Design

## System Fit
Two knowledge systems exist:
1. **tenantSettings.knowledge** — JSONB array of `{ topic, content }` in tenant settings. Currently used by chat route (line 498 of `api/chat/route.ts`): `tenantSettings.knowledge.slice(0, 5)` injected under `## Business Knowledge (world model)`.
2. **knowledgeEntries table** — Proper table with id, tenantId, createdBy, scope, title, category, content, contentHash, isActive. Has API at `/api/settings/knowledge` (GET/POST/PUT/DELETE).

**Decision:** Migrate chat to read from `knowledgeEntries` table instead of `tenantSettings.knowledge`. The table is more structured (scope, isActive, per-user) and already has CRUD API.

## Data Flow
```
Page load:
  GET /api/settings/knowledge → returns KnowledgeEntry[]
  Client groups: Workspace (scope=workspace) / Personal (scope=personal, createdBy=me)

Create entry:
  POST /api/settings/knowledge { title, category, scope, content }
  → inserts into knowledgeEntries → refetch list

Edit entry:
  PUT /api/settings/knowledge { id, content, title }
  → updates knowledgeEntries → refetch

Chat injection (CHANGE NEEDED):
  In api/chat/route.ts, replace tenantSettings.knowledge read with:
  SELECT * FROM knowledgeEntries WHERE tenantId = ? AND isActive = true
  Format: "## Your Knowledge Base\n### {title}\n{content}" for each entry
```

## Components
- `app/(dashboard)/knowledge/page.tsx` — Main page (client component)
- `components/knowledge/knowledge-sidebar.tsx` — Left panel with 2 sections
- `components/knowledge/knowledge-detail.tsx` — Right panel with editable content
- `components/knowledge/add-knowledge-dialog.tsx` — Create dialog with file drop zone

## Schema Change
Add two optional columns to `knowledgeEntries`:
```sql
sourceType TEXT DEFAULT 'text'    -- 'text' | 'file' | 'url'
sourceFilename TEXT               -- original filename if uploaded
```

## File Upload
Client-side parsing only (no server-side file storage):
- TXT/MD: read as UTF-8 text
- PDF: use pdf.js to extract text
- Content stored in `knowledgeEntries.content` as plain text

## Security
- Workspace entries visible to all tenant members
- Personal entries visible only to creator
- Chat injects workspace entries for all users, personal entries only for creator
