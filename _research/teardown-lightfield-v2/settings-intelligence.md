# Lightfield Settings Intelligence — S4 Synthesis

**Date**: 2026-04-01

## Complete Settings Map (18 sections)

### Account (personal, per-user)
| Section | Key Settings | Criticality |
|---------|-------------|-------------|
| Profile | First/last name, email (readonly), language, timezone | NICE TO HAVE |
| Mail & Calendar | Account creation mode (Disabled/Selective/Always), backsync range (1-24mo), visibility (Metadata/Full), do-not-track domains, Google/Microsoft OAuth | CRITICAL |
| Notifications | 6 notification types × 3 channels (Slack/Email/In-app), per-type toggles, task reminder timing | NICE TO HAVE |
| Recording | Record external meetings toggle (default on/off) | NICE TO HAVE |
| Agent | Record creation approval (Ask every time / Auto-run) | CRITICAL |
| Connectors | MCP connectors: Granola, Notion, Linear | NICE TO HAVE |

### Workspace (organization-wide)
| Section | Key Settings | Criticality |
|---------|-------------|-------------|
| General | Workspace name, URL (readonly), company domains (exclusion list), delete workspace | CRITICAL |
| Members | Invite via email, 2 roles (Admin/Member) | CRITICAL |
| Meetings | Recording toggle, recorder name, recorder avatar (default/custom) | NICE TO HAVE |
| Knowledge | Multi-topic structured knowledge base (Topic + Content pairs) | **CRITICAL** |
| Data model | Custom fields per entity, field types, AI fill modes (Auto/Suggest/Off) | **CRITICAL** |
| Opportunity stages | Named stages with descriptions, In progress/Done categories, AI fill mode, AI prompt | **CRITICAL** |
| Tasks | Task creation mode (Suggested + edit prompt), auto-update toggle | CRITICAL |
| Workflows | Create workflow, status/runs tracking (Beta) | NICE TO HAVE |
| Import history | Past import log | NICE TO HAVE |
| Billing | External redirect | NICE TO HAVE |
| Integrations | Slack only | NICE TO HAVE |
| API keys | Create API key with name/type/scopes (Beta) | NICE TO HAVE |

## CRITICAL Settings to Replicate

### 1. Knowledge Base (structured topic/content pairs)
**Why**: This is how the AI gets context about the business. Our current settings have free-form textareas for company description, ICP, and product. Lightfield's approach is BETTER because:
- Multiple discrete topics (not a blob)
- Add/remove independently
- Team members contribute different topics
- AI gets structured, parseable context

**Gap**: We have 3 fixed textareas. They have unlimited structured topics. We need to match this.

### 2. Data Model (custom fields with AI fill modes)
**Why**: This is what makes Lightfield schema-less. Users define their own fields on Accounts, Contacts, Opportunities. Each field has:
- Type (Text, Date, Single/Multi select, URL, Social handle, Address, Markdown)
- Editable by (System only / Anyone)
- AI fill (Auto / Suggest / Off)

**Gap**: We have hardcoded fields. No custom fields. No AI fill control per field. This is the single biggest gap between our product and Lightfield.

### 3. Opportunity Stages (AI-aware descriptions)
**Why**: Each stage has a human-written description that the AI uses to decide when to auto-progress deals. Plus a custom AI prompt for additional criteria. Plus AI fill mode (Auto/Suggest/Off).

**Gap**: Our stages are static labels. No descriptions. No AI-driven progression based on stage definitions.

### 4. Agent Permissions (Ask/Auto-run)
**Why**: Human-in-the-loop control. Critical for trust — founders need to know the AI won't make changes without approval until they're comfortable.

**Gap**: We have this already! Our Settings has "Ask every time" / "Auto-approve" — matches Lightfield.

### 5. Mail & Calendar Configuration
**Why**: Privacy controls BEFORE connecting. Backsync range, visibility, do-not-track, auto-creation mode — these build trust.

**Gap**: We have Gmail connect button but no pre-connection configuration. Need backsync range, visibility, do-not-track, auto-creation modes.

### 6. Task Automation (AI task creation + edit prompt)
**Why**: AI extracts tasks from conversations/meetings. "Edit prompt" lets power users control what gets extracted.

**Gap**: We have no AI task creation. Tasks are manual only.

## Settings That Reveal Lightfield's Philosophy

1. **AI fill modes per field** — They treat AI as a per-field decision, not global. Some fields are auto-filled, some suggested, some manual. This is granular trust.

2. **Structured knowledge, not instructions** — They don't have "custom AI instructions" textarea. They have structured topic/content pairs. The AI learns from WHAT you tell it, not HOW you tell it to behave.

3. **Stage descriptions as AI training data** — By making stage descriptions functional (the AI reads them), they turn configuration into intelligence. The more you describe your process, the smarter the AI gets.

4. **MCP connectors** — They chose MCP over custom integrations. This means they bet on the standard rather than building bespoke integrations. Forward-thinking.

5. **Workflows as Beta** — They're building automation (like Zapier) but haven't shipped it fully. This shows they want the product to be programmable.

6. **"Suggested" as default mode** — Everything defaults to "suggest, don't auto-do." This is the safe default for a CRM where data integrity matters.

## What They Have That We DON'T Have

| Feature | Lightfield | LeadSens |
|---------|-----------|----------|
| Custom fields per entity | Yes (create field, any type) | No (hardcoded schema) |
| AI fill modes per field | Auto / Suggest / Off | No per-field control |
| Structured knowledge base | Topic/Content pairs, unlimited | 3 fixed textareas |
| Mail pre-connection config | Backsync, visibility, do-not-track | None |
| Task creation from AI | Suggested mode + edit prompt | Manual only |
| Meeting recording settings | Toggle, custom avatar, recorder name | None |
| Notifications (3 channels) | Slack/Email/In-app per type | None |
| Workflows (automation) | Beta, create workflow | None |
| MCP Connectors | Granola, Notion, Linear | None |
| API keys | Beta, scoped keys | None |
| Company domain exclusion | Yes (own domains) | No |
| Workspace URL | Auto-generated | No |
| Data model viewer | Full field list with types | No |
| Import history | Track past imports | No |

## What Settings Make It Feel Enterprise-Ready vs Toy

**Enterprise signals** (Lightfield has, we should have):
- Workspace name + URL
- Member invite with roles
- API keys
- Domain exclusion
- Notification channel controls
- Data model customization
- Import history
- Workspace deletion (scheduled, not instant)

**Toy signals** (if you DON'T have these):
- No settings page at all, or single page with textareas
- No role-based access
- No notification controls
- No data model visibility
- No import/export history
- No API access
