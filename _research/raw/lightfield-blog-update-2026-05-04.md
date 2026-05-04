# Lightfield Blog & Feature Tracking Update - 2026-05-04

Last research: 2026-05-01. This update captures all new and previously uncaptured posts.

## Pricing Snapshot (as of 2026-05-04)

| Plan    | Price              | Records  | Workflow events/mo |
|---------|--------------------|----------|--------------------|
| Startup | $79/user/mo        | 30,000   | 1,000              |
| Pro     | $199/user/mo (ann) | 100,000  | 20,000             |
| Growth  | Custom (annual)    | Custom   | Custom              |

**Key gating:** Custom objects, custom dashboards, advanced permissions, HIPAA, migration services = Pro+. Account scoring, automated sequencing, email deliverability, warm intro paths, forward-deployed team = Growth only.

Note: No changelog or updates page exists (both /changelog and /updates return 404). All updates ship as blog posts.

---

## NEW Posts Since Last Capture (reverse chronological)

### 1. Email conversations rollout and agent tooling improvements (May 1, 2026)

**Slug:** `email-conversations-rollout-and-agent-tooling-improvements`

**Features:**
- **Email Conversations GA** - Threaded replies and attachments from record views, now available across ALL workspaces. Chat-based reply + file attachment launching the following week.
- **Automations (Preview)** - Run any user-defined process on a schedule or trigger. Leverages Lightfield agent, Skills, and external tool integrations.
- **Token efficiency improvements** - Complex agent operations (e.g., CSV upload) are faster and more dependable.
- **Onboarding skill** - New skill that conducts user interviews and generates knowledge files automatically.

**Competitive relevance:** Automations preview is significant - this is their entry into workflow automation beyond simple triggers. The onboarding skill that auto-generates knowledge is a smart zero-config approach.

---

### 2. Four Skills to turn Objections into Opportunities (Apr 30, 2026)

**Slug:** `four-skills-to-turn-objections-into-opportunities`

**Content type:** How-to guide (not a feature release)

**Four Skills described:**
1. **Objection Pattern Library** - Scans active + closed-lost deals (90 days), extracts objections from call notes/emails/meeting summaries, groups by theme (pricing, integration, timing, competitor preference, internal priority), ranks by frequency.
2. **Messaging Gap Identifier** - Analyzes objection themes against public-facing content (website, pricing pages, docs, blog, reviews). Rates coverage as yes/partially/no.
3. **Objection-Stage-Persona Mapper** - Cross-references objections against deal stage, contact role, deal size. Flags patterns in 3+ deals.
4. **Counter-Playbook Generator** - Extracts successful responses from closed-won deals with similar objections. Surfaces verbatim language that worked.

**Competitive relevance:** Shows the depth of their Skills system - these are sophisticated multi-step agent workflows that combine CRM data analysis with external content analysis. This is essentially a "deal coaching" layer built from composable Skills.

---

### 3. Email replies and attachments, custom objects (Apr 24, 2026)

**Slug:** `email-replies-and-attachments-custom-objects`

**Features:**
- **Email Replies & Attachments** - Messages organized in conversations, threaded replies to existing messages, file attachments on send. Rollout over several days as prior records migrate to conversation structure (recent conversations prioritized).
- **Custom Objects & Relationships (Preview, Pro only)** - Admins create/customize objects. Preconfigured with relationships to notes, tasks, files. Can establish custom relationships with other object types.
- **ICP Definition Skill** - Added to knowledge base.
- **CSV import 2x faster** - Significantly reduced error rates.
- **GPT 5.5 model** - Added to model selector.
- **Bulk email drafting tool** - New agent tool for drafting multiple emails.

**Competitive relevance:** Custom Objects is a BIG move - this takes them from a fixed-schema CRM to a flexible data model competitor. GPT 5.5 support shows they're model-agnostic (Claude, GPT, Gemini).

---

### 4. Skills & Knowledge improvements, Claude Opus 4.7 (Apr 17, 2026)

**Slug:** `improvements-to-skills-and-knowledge-support-for-claude-opus-4-7`

**Features:**
- **Knowledge File Upload via API/SDK** - Upload files into Knowledge directory programmatically. Enables rapid importation of large knowledge collections.
- **Claude Opus 4.7** - Latest Claude model in workspace chat. "Improved document understanding, more precise instruction following, higher-quality output vs Opus 4.6."
- **Automated Record Field Updates** - Auto-populate and refresh record fields WITHOUT requiring human approval during processing.
- **All-format file downloads** - Previously limited to PDFs.
- **Knowledge file metadata** - Basic metadata including modification tracking.

**Competitive relevance:** Knowledge API is important for enterprise onboarding. Auto field updates without approval = moving toward fully autonomous CRM. They're on Claude 4.7 while we're building on 4.6.

---

### 5. API additions, improved data visualizations (Apr 3, 2026)

**Slug:** `api-additions-improved-data-visualizations-skills-and-knowledge-coming-soon`

**Features:**
- **API List Filtering** - Get filtered lists of objects, enabling "find or create" functionality.
- **Notes API** - Create and retrieve notes via API.
- **Historical Meeting Logging** - Log past meetings with transcript attachments via API.
- **New Chart Types** - Area, stacked area, scatter, radar, gauge, heatmap.
- **Skills & Knowledge Preview** - Dedicated directories for business context and procedural info. Auto-migration from Settings. Cross-referenced skill and knowledge files. Managed automatically.

**Competitive relevance:** Six new chart types is a substantial visualization upgrade. API becoming more capable for integrations.

---

### 6. Table column math, agent data model tools (Mar 27, 2026)

**Slug:** `table-column-math-agent-data-model-tools`

**Features:**
- **Column Math** - Configurable math operations in table/kanban view footers. Pipeline values at a glance.
- **Agent Data Model Tools** - Agent can read existing data model config and suggest draft data model changes during import or on demand.

**Competitive relevance:** Agent suggesting schema changes is clever - it's the CRM evolving its own data model based on what users import.

---

### 7. Lists, background agent tasks, HIPAA, API beta (Mar 13, 2026)

**Slug:** `lists-background-agent-tasks-hipaa-api-beta`

**Features:**
- **Lists** - Create lists of record objects (accounts, opportunities, contacts). Add via bulk selection, individual pages, or agent. 
- **Background Agent Tasks** - Agent handles extended operations, logs progress, resumes when able. Status indicators + notifications for completion or user input needed.
- **HIPAA Compliance** - Ready to execute BAAs with healthcare customers.
- **REST API Beta** - Public beta launch.
- **"Next interaction" field** - For accounts and opportunities, pulled from scheduled meetings.
- **Telephone custom field type** - New data type.

**Competitive relevance:** Background agent tasks with progress logging and resume is a significant infrastructure investment. HIPAA is an enterprise selling point. Lists feature is table-stakes CRM functionality they were missing.

---

### 8. Bulk delete, agent record operations, REST API (Mar 6, 2026)

**Slug:** `bulk-delete-agent-record-operations-rest-api`

**Features:**
- **Bulk Deletion** - Select and remove multiple items from tables. Currently accounts + opportunities, expanding to all objects.
- **Agent Record Operations Overhaul** - New interface for mass creation/modifications. Respond to suggestions conversationally or disable approval requirement.
- **REST API Beta** - Entering beta testing.
- **GPT 5.4 model** - Added to model selector.
- **PDF export size** - Agent-generated PDFs ~70% smaller.
- **Agent response 25% faster** - Optimization.
- **CSV import dedup** - Better handling of multiple accounts sharing domains.
- **Account creation** - No longer requires website domain.
- **Automation triggers** - Contact creation and update triggers.

**Competitive relevance:** Disable approval requirement for agent record operations = they're building toward fully autonomous CRM. 25% response speed improvement matters for UX.

---

## Previously Uncaptured Posts (older, now captured for completeness)

### Contact and account data model improvements (Feb 27, 2026)
- Contacts: multiple email addresses, multi-account associations
- Accounts: multiple domains
- Improved chat comprehension of artifact edits
- Enhanced markdown formatting in chat
- Renameable chat titles
- Granola MCP integration improvements
- PDF exports merge into one continuous document

### Improved chat, data model flexibility (Feb 20, 2026)
- Code execution launch (agent generates and runs code)
- Contacts can link to multiple accounts
- Meetings filterable by workspace member ID
- Delete individual/multiselect field options from data model settings

### Shareable meetings, code generation (Feb 13, 2026)
- Public shareable meeting views (external access without workspace membership)
- Code generation preview (file execution leveraging CRM data for customizable views)
- CSV import progress indicator improved

### MCP connectors, member pages (Feb 6, 2026)
- MCP connectors: Granola, Notion, Linear (in Settings)
- Work in agent chat AND workflow automation
- Workspace member profile pages (accounts, opportunities, meetings, tasks, activity timeline)
- Scheduled workflow triggers
- Workflow can create/update opportunities
- Claude Opus 4.6 with 1M token context
- Email sender preference persistence
- Copy functionality for meeting transcripts

### Dark mode, workflow triggers, task management (Jan 30, 2026)
- Dark mode
- Workflow triggers on CRM object creation/modification (meetings, tasks, notes)
- Editable task creation instructions
- Tasks in "Up next" organized by opportunity + deal amount

### Agentic workflows, record export (Jan 23, 2026)
- Agent step in workflow builder (query records, create/edit records, web research)
- Record export: CSV, XLSX, JSON
- Improved suggested task deduplication
- App reopens to last visited view

---

## Competitive Intelligence Summary

### Major capability gaps to track:

1. **Automations (Preview)** - Schedule/trigger-based processes using agent + Skills + external tools. This is their workflow automation play.

2. **Custom Objects & Relationships** - Flexible data model, not just contacts/accounts/opportunities. Pro tier only.

3. **Skills ecosystem maturing fast** - Objection analysis, ICP definition, onboarding. These are reusable, composable agent workflows.

4. **Model-agnostic strategy** - Support Claude 4.7, GPT 5.5, GPT 5.4, Gemini 3 Pro. User picks their model.

5. **Knowledge API** - Programmatic knowledge upload = enterprise onboarding path.

6. **Background agent tasks with resume** - Long-running agent operations that survive interruption.

7. **HIPAA compliance** - Healthcare vertical unlocked.

8. **Email conversations GA** - Threaded email with attachments, fully rolled out.

9. **Autonomous record updates** - No human approval required for field updates.

10. **Agent-driven schema evolution** - Agent suggests data model changes based on imports.

### Pricing intelligence:
- $79/user/mo Startup tier is their entry point
- Growth tier (custom pricing) gates account scoring, automated sequencing, email deliverability, warm intro paths
- These Growth-only features overlap heavily with our core value proposition

### Shipping velocity:
- 8 substantive product posts in ~2 months (Mar 6 - May 1)
- Average: one feature release per week
- Mix of infrastructure (HIPAA, API, background tasks) and user-facing (email, custom objects, Skills)

### Posts removed or renamed:
- `reevo-vs-lightfield` (previously in our captured list) no longer appears on the blog index. May have been retitled or removed.
