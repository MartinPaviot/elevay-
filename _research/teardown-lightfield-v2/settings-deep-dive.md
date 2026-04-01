# Lightfield Settings Deep Dive

**Date**: 2026-04-01
**URL**: https://crm.lightfield.app/crm/settings

## S1: Settings Navigation — Complete Tab/Section Map

Settings has a left sidebar with two major sections:

### Account (personal)
1. **Settings** (Profile) — `/crm/settings/profile`
2. **Mail and Calendar** — `/crm/settings/mail-and-calendar`
3. **Notifications** — `/crm/settings/notifications`
4. **Recording** — `/crm/settings/recording`
5. **Agent** — `/crm/settings/agent`
6. **Connectors** — `/crm/settings/connectors`

### Workspace (organization)
7. **General** — `/crm/settings/organization`
8. **Members** — `/crm/settings/members`
9. **Meetings** — `/crm/settings/meetings`
10. **Knowledge** — `/crm/settings/knowledge`
11. **Data model** — `/crm/settings/data-model`
12. **Opportunity stages** — `/crm/settings/opportunities`
13. **Tasks** — `/crm/settings/tasks`
14. **Workflows** — `/crm/settings/workflows` (Beta badge)
15. **Import history** — `/crm/settings/import-history`
16. **Billing** — `/crm/settings/billing-redirect` (external link icon)
17. **Integrations** — `/crm/settings/integrations`
18. **API keys** — `/crm/settings/api-keys` (Beta badge)

**Total: 18 settings sections** across 2 categories.

Notable: "Workflows" and "API keys" are marked Beta. Billing has an external link icon (redirects to billing provider).

---

## S2: Section-by-section deep dive

### 1. Profile (Settings > Account > Settings)
**Screenshot**: settings-002-settings-landing.png

**Page title**: "Profile"
**Subtitle**: "Manage settings for your personal profile."

**Fields**:
- **First name**: text input, value="Martin"
- **Last name**: text input, value="Paviot"
- **Email**: text input, DISABLED, value="lf-signup@elevay.dev" — cannot change email from settings
- **Language**: dropdown, current="Français" — controls UI language
- **Timezone**: dropdown, current="(undefined) America/Tijuana" — note the "(undefined)" prefix, appears to be a display bug

**Buttons**:
- **Update**: disabled until changes are made

**Observations**:
- No avatar upload
- No role display
- No password change (likely OAuth-only)
- Language setting is per-user, not workspace
- Timezone is per-user

---

### 2. Mail and Calendar
**Screenshot**: settings-003 through settings-009

**Page title**: "Mail and Calendar"
**Subtitle**: "Manage settings for emails and meetings from your connected accounts"

**Elements**:
- **Add account** button — expands inline form (not modal) with config options BEFORE connecting
- **Account & contact creation**: dropdown
  - **Disabled**: No records created from emails or meetings
  - **Selective** (Recommended, default): Records created only from emails you sent and meetings you organized or attended
  - **Always**: Records always created from emails and meetings
  - Checkbox: "Create contacts from personal email addresses (eg. @gmail.com, @outlook.com)" — unchecked by default
- **Backsync range**: dropdown — how far back to sync from connection date
  - 1 month (default), 3 months, 6 months, 12 months, 24 months
  - Each option shows the resulting start date
- **Visibility settings**: dropdown
  - **Metadata only**: Show only participants and timestamps to others
  - **Full access** (default): Share all email and meeting content with others (including subject, body, and attachments)
- **Do not track**: text input — "Provide external domains and emails that you don't want Lightfield to track"
  - Placeholder: "example.com user@example.com"
- **Cancel** / **Continue with Google** / **Continue with Microsoft** buttons at bottom

**CRITICAL INSIGHT**: Settings are configured BEFORE the OAuth flow. User makes privacy/scope decisions upfront, not after connecting. This is a trust-building design choice.

---

### 3. Notifications
**Screenshot**: settings-010, settings-011

**Page title**: "Notifications"
**Subtitle**: "Choose your preferred notification settings for in-app, email, and slack."

**Slack integration banner**: "Your workspace admin needs to connect Slack in Integrations first." Connect button (disabled).

**Three channels per notification**: Slack, Email, In-app
**Slack column shows "—" (dash)** when Slack not connected.

**Notification categories**:

**Chats**:
- New chat message: "Get notified when Lightfield takes more than 60 seconds to draft a reply." — Email ✓, In-app ✓

**Tasks**:
- Due date reminders: "Get notified before a task is due." — dropdown "24h before", Email ☐, In-app ✓
- Manual reminders: "Get notified at times you set on individual tasks." — Email ☐, In-app ✓
- Task assigned to you: "Get notified when someone assigns you a task." — Email ✓, In-app ✓

**Meetings**:
- Meeting ready for review: "Get notified when a meeting transcript has been processed and summarized." — Email ✓, In-app ✓

**Digests**:
- Meeting daily digest: "Get a summary to stay on top of upcoming meetings." — Email ✓

**INSIGHT**: 6 notification types. Per-channel toggles (3 channels). Task reminders have timing dropdown. Clean, complete model.

---

### 4. Recording
**Screenshot**: settings-012

**Page title**: "Recording"
**Subtitle**: "Manage your call recording settings"

**Radio options**:
- **Record external meetings** (Default, selected): "Lightfield will record meetings with external participants by default."
- **Don't record**: "Lightfield will not record your meetings by default. You can still record individual meetings directly from the meeting page."

**INSIGHT**: Per-user recording preference. Can override per-meeting. Simple binary.

---

### 5. Agent
**Screenshot**: settings-013, settings-014

**Page title**: "Agent"
**Subtitle**: "Control how the Lightfield agent behaves in chat."

**Section**: "Agent permissions"
- **Record creation and updates**: "Choose whether or not record creation and field updates require approval in chat."
  - Dropdown options:
    - **Ask every time** (default, selected)
    - **Auto-run**

**INSIGHT**: This is the human-in-the-loop control. Only ONE setting: approval for record changes. No AI tone, style, or behavior configuration here (that's in Knowledge).

---

### 6. Connectors
**Screenshot**: settings-015

**Page title**: "Connectors"
**Subtitle**: "Allow Lightfield to reference other apps for more context and actions through MCP connectors."

**Three connectors**:
1. **Granola**: "Search and chat with your meeting notes, transcripts, and action items." — Connect (external link)
2. **Notion**: "Search, create, and update pages, databases, and docs in your Notion workspace." — Connect (external link)
3. **Linear**: "Find, create, and manage issues, projects, and comments in Linear." — Connect (external link)

**CRITICAL INSIGHT**: Lightfield uses MCP (Model Context Protocol) for integrations! Not custom API integrations — they built on the MCP standard. This is forward-thinking architecture. Three connectors shows this is early but the pattern is extensible.

---

### 7. General (Workspace)
**Screenshot**: settings-016

**Page title**: "Workspace settings"
**Subtitle**: "Manage settings for your entire workspace."

**Fields**:
- **Workspace name**: text input, value="Elevay", Update button (disabled until changed)
- **Workspace URL**: text input, DISABLED, value="https://crm.lightfield.app/elevay"

**Domains section**:
- "These domains will be associated with your company. No new accounts will be created for companies with these domains."
- Tag list with delete (X) button: "elevay.dev"
- Text input to add new domains

**Danger zone**:
- **Delete workspace**: "Schedule workspace to be permanently deleted" — Delete workspace button

**INSIGHT**: Domain exclusion prevents your own company from appearing as an account. Workspace deletion is "scheduled" (not instant) — safety net.

---

### 8. Members
**Screenshot**: settings-017, settings-018

**Page title**: "Elevay members"
**Subtitle**: "Manage members 1"

**Invite flow**: email input + role dropdown + Invite button
**Role dropdown options**:
- **Admin**: "Can change settings and manage members"
- **Member**: "Can invite new members"

**Current members**: table with avatar, name, email, role badge

**INSIGHT**: Simple 2-role model (Admin/Member). No viewer role. Members CAN invite other members. Very flat hierarchy — designed for small teams.

---

### 9. Knowledge (CRITICAL)
**Screenshot**: settings-019

**Page title**: "Knowledge"
**Subtitle**: "Give Lightfield additional context on your business. This context will be included in AI requests for everyone in your organization."

**Structure**: List of topic/content pairs
- **Add knowledge** button to add new entries
- Each entry:
  - **Topic**: text input, placeholder "Title of topic"
  - **Content**: textarea, placeholder "Content of topic"
  - **Save changes** button (disabled until changed)
  - **Remove** button

**CRITICAL INSIGHT**: This is Lightfield's AI configuration mechanism. Instead of free-form instructions, it's STRUCTURED knowledge — named topics with content. This means:
1. Each topic is discrete and manageable
2. Topics can be added/removed independently
3. The AI gets structured context, not a blob of text
4. Multiple team members can contribute different topics
5. This is similar to our ICP/company description fields, but MORE GRANULAR

**What we should replicate**: Multi-topic knowledge base, not single textareas.

---

### 11. Opportunity Stages
**Screenshot**: settings-021, settings-022

**Page title**: "Opportunity stages"
**Subtitle**: "Opportunities capture the active effort in navigating and closing a deal with a particular account. Each stage typically represents a milestone in a deal. Describing each stage below enables Lightfield to track stages automatically based on activity."

**Two categories**: "In progress" (+ button to add) and "Done" (+ button to add)

**In progress stages**:
1. **Lead** — "Initial contact with a potential prospect" (gray dot)
2. **Qualification** — "Initial meeting booked" (gray dot)
3. **Demo** — "Demo scheduled" (yellow dot)
4. **Trial** — "Prospect expressed interest in trial" (yellow dot)
5. **Proposal** — "Prospect is ready to work through terms" (green dot)

**Done stages**:
1. **Won** — "Agreement signed" (blue dot)
2. **Lost** — (no description visible)

**Settings section at bottom**:
- **AI fill**: dropdown (currently "Suggest") — "Control how stages are updated"
- **AI prompt (optional)**: textarea — placeholder "Description of when to update this field"

**CRITICAL INSIGHT**: Stage descriptions are INSTRUCTIONS for the AI. When stages have clear descriptions, Lightfield can auto-progress deals based on activity matching those descriptions. The AI fill mode (Suggest) means it proposes stage changes but doesn't auto-apply. The optional AI prompt lets users add custom criteria.

---

### 12. Tasks
**Subtitle**: "Manage task automation and agent settings for your workspace."

**Automation section**:
- **Task creation mode**: combobox (currently "Suggested") + "Edit prompt" button
  - Controls how tasks are created from conversations
  - "Edit prompt" lets you customize the AI prompt for task extraction
- **Automatically update tasks**: toggle switch (off)
  - "Automatically mark tasks complete or update details based on activity."

**INSIGHT**: Task creation is AI-driven from conversations. "Suggested" means AI proposes tasks from meetings/emails but user confirms. "Edit prompt" is power-user control over task extraction behavior.

---

### 13. Workflows (Beta)
**Subtitle**: "Manage your automated workflows and integrations."
- "Create workflow" button
- Empty table: Name, Status, Runs, Created by, Last edited
- Currently empty, Beta feature

---

### 14. Import History
Not visited in detail — tracks past CSV imports.

---

### 15. Billing
Redirects to external billing provider (stripe-like).

---

### 16. Integrations
**Subtitle**: "Connect external apps and services for your workspace."
- **Slack**: "Allows members in your workspace to enable Slack notifications." — Connect button
- Only one integration currently

**Note**: MCP Connectors (Granola, Notion, Linear) are separate from Integrations (Slack). Connectors = AI context. Integrations = workspace features.

---

### 17. API Keys (Beta)
**Subtitle**: "Manage API keys for programmatic access to the Lightfield API."
- "Create API key" button
- Table: Name, Key, Type, Scopes, Created, Last used
- Empty state: "No API keys yet"

---

### 18. Meetings (Workspace)
**Subtitle**: "Manage meeting settings and defaults for your entire workspace."

**Recording section**:
- **Enable recording with Lightfield**: toggle switch (on)
  - "Workspace members may choose to record their meetings with Lightfield"

**Recorder appearance**:
- **Recorder name**: text input (empty, placeholder "Enter recorder name")
- **Default** (selected): Lightfield logo
- **Custom**: "Recommended: 1280x720px .jpeg image" — upload custom recorder avatar
- Preview card shown on right

---

### 10. Data Model (CRITICAL)
**Screenshot**: settings-020

**Page title**: "Data model"
**Subtitle**: "Manage field definitions of the objects in your CRM."

**Three entity tabs**: Accounts, Opportunities, Contacts

**Accounts fields** (complete list):
| Name | Type | Editable by | AI fill |
|------|------|-------------|---------|
| Record ID | Text | System only | - |
| Created at | Date & Time | System only | - |
| Last interaction | Date & Time | System only | - |
| Name | Text | Anyone | - |
| Account summary | Markdown | System only | **Auto** |
| Facebook | Social handle | Anyone | **Suggest** |
| Headcount | Single select | Anyone | **Suggest** |
| About their business | Markdown | System only | **Auto** |
| Industry | Multi select | Anyone | **Suggest** |
| Instagram | Social handle | Anyone | **Suggest** |
| Last funding | Single select | Anyone | **Suggest** |
| LinkedIn | Social handle | Anyone | **Suggest** |
| Memo | Text | Anyone | **Suggest** |
| Location | Address | Anyone | **Suggest** |
| Revenue | Single select | Anyone | **Suggest** |
| Twitter | Social handle | Anyone | **Suggest** |
| Website | URL | Anyone | **Off** |

**"Create field" button** — custom fields!

**AI fill column values**:
- **Auto**: AI fills this field automatically (system-generated)
- **Suggest**: AI suggests values, user confirms
- **Off**: AI does not fill this field
- **-**: Not applicable (system fields)

**Field types observed**: Text, Date & Time, Markdown, Social handle, Single select, Multi select, URL, Address

**CRITICAL INSIGHTS**:
1. **Custom fields** — users can add ANY field to ANY entity
2. **AI fill modes** — three-tier AI involvement per field (Auto/Suggest/Off). This is incredibly granular control over AI behavior
3. **Markdown type** for rich text fields like summaries
4. **Social handle** as a dedicated type (not just text)
5. **Address** as a dedicated type
6. **Multi select** for Industry (multiple industries per company)
7. "Account summary" and "About their business" are AUTO-filled by AI — these are the enrichment fields
8. This is the schema-less approach mentioned in research — users define their own data model
