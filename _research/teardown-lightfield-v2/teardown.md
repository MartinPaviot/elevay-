# Lightfield Teardown v2 — Exhaustive Feature Testing

**Date**: 2026-03-31
**Analyst**: Claude (autonomous)
**Method**: Playwright browser, pixel-level analysis, 35 NL chat queries
**Trial expires**: 2026-04-13 (13 days remaining)

---

## STEP L1: Global UI

### [001] Full Page After Login — Accounts List View
- Screenshot: 001-global-ui-full-page.png
- HTML source: _research/raw/lightfield-dashboard-v2.html

#### Sidebar (left, ~230px width)
- **Top section**:
  - User avatar (purple "MP" initials circle) + "Martin Paviot" name
  - Search button (🔍)
  - Collapse button (« chevrons)
- **Navigation — unnamed top**:
  - 🕐 "Up next" — (clock icon, likely priority/task view)
  - 🔔 "Notifications"
- **Records section** (label: "Records"):
  - 🏢 "Accounts" (active — highlighted with light bg)
  - 💼 "Opportunities"
  - 👤 "Contacts"
- **Resources section** (label: "Resources"):
  - ☑️ "Tasks"
  - 📅 "Meetings"
  - 📝 "Notes"
- **Lists section** (label: "Lists"):
  - ➕ "New list" button
- **Chats section** (label: "Chats"):
  - ➕ "New chat" button
  - Multiple chat history items visible (truncated titles)
  - Combobox at bottom for chat input
- **Bottom**: ? help icon
- **Sidebar background**: White (#ffffff), clean minimal design
- **Active item**: Accounts — light orange/peach background highlight

#### Top Bar (main content area)
- Left: 🏢 "Accounts" page title + "All" view toggle (grid icon) + "+" add button
- Right: "Import / Export" button (with refresh icon) + "+ Create account" button (outlined)
- Below: Filter bar — "Filter" button (left) + "Display" button (right)

#### Main Content Area
- **Table view** with 5 accounts visible:
  1. Dublin Software — IT & Services + Software — $10M to $... — last interaction...
  2. GulfTech — Machinery Manufacturing + Leasing + Manufa... — Less tha...
  3. TechFlow — Technology Services — $10M to $...
  4. NovaTech — IT And Services — $50M to $...
  5. Meridian Labs — Artificial Intelligence + FinTech — Less tha...
- **Footer row**: "5 count" + "+ Add operation" buttons for each column
- **Visible columns**: Account | Industry | Last interacti... | Reven...
- **Column headers** have sort icons (↓ on Last interaction)

#### Color Palette
- Background: White (#ffffff) for sidebar and content
- Active sidebar item: Light peach/orange (#FFF5EE or similar)
- Industry badges: Colored pills — green, grey, blue tones
- Text: Dark grey (#1a1a1a) for primary, medium grey for secondary
- Accent: Orange/amber for active states and highlights
- Borders: Very subtle light grey (#e5e7eb)

#### Typography
- Font: Sans-serif (likely Inter or system font stack)
- Sidebar labels: ~11px, uppercase tracking, medium grey
- Table headers: ~13px, medium weight
- Body text: ~14px, regular weight

#### Overall Layout
- Sidebar width: ~230px, collapsible
- No bottom bar/persistent chat input visible on this page
- Clean, minimal, lots of whitespace — "Notion for CRM" aesthetic
- Light theme only visible (no dark mode toggle observed)

---

## STEP L2: Accounts List Page

### [002] Accounts List View
- Screenshot: 002-accounts-list-view.png
- **Columns (9 total)**: Account | Industry | Last interaction | Revenue | Headcount | Last funding | LinkedIn | Website | Owner
- **5 accounts visible**: Dublin Software, GulfTech, TechFlow, NovaTech, Meridian Labs
- **Row height**: ~44px, each row shows account name + colored icon/logo
- **Industry tags**: Colored pill badges (green, grey, blue variants)
- **Revenue**: Range format ("$10M to $...", "$50M to $...", "Less tha...")
- **LinkedIn/Website**: Direct text links (gulftech-it, novatech.dev, meridianlabs.io)
- **Owner**: "Martin Paviot" with avatar for all — single user
- **Footer**: "5 count" + "+ Add operation" buttons per column (aggregation)
- **No bulk select checkbox** visible
- **No right-click context menu** — right-click shows browser default

### [003] Filter Dropdown
- Screenshot: 003-accounts-filter-dropdown.png
- **Filter fields (13)**: Industry, Last interaction, Next interaction, Created at, Revenue, Headcount, Last funding, Owner, Opportunity count, Facebook, Instagram, LinkedIn, Twitter
- **Search box**: "Search filters..." at top
- **Each filter has a chevron** → implies sub-menu with operators
- **Missing filters**: No filter for Account name, Website, Score/Priority, Tags, Custom fields

---

## STEP L3: Create Account via UI

### [005-006] Create Account Modal
- Screenshot: 005-create-account-form.png, 006-create-account-filled.png
- **Two-step process**:
  1. First modal: just "Name" field (text input, placeholder "Company name"). Create button disabled until name entered.
  2. After typing: autocomplete dropdown appears — "+ Create 'Test Corp v2' manually" option. Clicking it reveals second step.
  3. Second step: Name (pre-filled) + Website (text input, "Add domain and press Enter")
- **Warning message**: "Accounts created manually will not be automatically enriched." — implies Lightfield auto-enriches accounts created via other methods (import, API)
- **Fields available**: Only Name and Website. No Industry, Headcount, Revenue, Owner fields at creation time.
- **UX pattern**: Search-first with autocomplete — likely tries to match existing accounts or enrichment database before manual creation
- **After creation**: Redirects to account detail page (URL: /crm/account/{id}#overview)

---

## STEP L4: Account Detail Page

### [009] Account Detail — Test Corp v2 (newly created, empty)
- Screenshot: 009-account-detail-test-corp.png
- **Page URL**: /crm/account/{id}#overview

#### Header
- Auto-generated company logo (blue square with "TestCorp" text)
- Large company name: "Test Corp v2"
- Top bar: logo icon + "..." menu + 🔗 link button + "+" add button

#### Left Panel — Main Content
- **Account summary**: "Account summary not generated yet" (greyed placeholder)
- **About their business**: "About their business not generated yet" (greyed placeholder)
- **Upcoming meetings**: "No upcoming meetings" section with "See all" link
- **Chat section at bottom**:
  - Pill badge: "🟦 Test Corp v2" (context indicator — chat is scoped to this account)
  - Input: "Ask Lightfield" placeholder text
  - Bottom toolbar: 🕐 clock icon + ⚙️ settings icon + 🎤 microphone + 💬 chat bubble
  - This is the NL chat interface, scoped to the current account

#### Right Panel — Account Details Sidebar
- **Editable fields**:
  - 📋 Name: Test Corp v2
  - 💼 Opportunities: "Set opportunities" (clickable, empty)
  - 👤 Owner: "Set owner" (clickable, empty)
  - 🏭 Industry: "Set industry" (clickable, empty)
  - 👥 Headcount: "Set headcount" (clickable, empty)
  - 💰 Revenue: "Set revenue" (clickable, empty)
  - 🌐 Website: testcorp.com (pre-filled from creation)
  - 📅 Last interaction: "No past interactions"
  - 📅 Next interaction: "No upcoming interactions"
  - "See more ∨" — expandable, implies more fields
- **Opportunities section**: "No opportunities" below the details

#### Key Observations
- All fields are inline-editable (click to set)
- AI summary is auto-generated but needs data first ("not generated yet")
- Chat is SCOPED to the account — NL queries will be about this specific account
- Layout: 60/40 split — main content (left) / details sidebar (right)

### [010-011] Account Detail — Meridian Labs (enriched, with data)
- Screenshot: 010-meridian-labs-detail.png (side panel), 011-meridian-labs-full-detail.png (full page)
- **Account summary (AI-generated)**: "Met Sarah Chen (CTO) at SaaStr 2025; she expressed interest in Elevay's API product. No defined next steps or active opportunities are recorded."
- **About their business (AI-generated)**: "Meridian Labs develops artificial intelligence solutions for the financial services sector, likely..."
- **Enriched fields**: Industry (Artificial Intelligence + FinTech), Headcount (11-50), Revenue (Less than $1M), Website (meridianlabs.io)
- **Opportunities linked**: "Meridian Labs - API Product Deal" at "Qualification" stage
- **Two view modes**: Side panel (drawer over list) OR full page — clicking row = side panel, expand button = full page
- **Chat is scoped**: "Ask Lightfield" input with Meridian Labs badge — queries will be about this account
- **Note**: Test Corp v2 in accounts list now shows "Software" industry tag — may have been auto-enriched despite "manually created" warning

---

## STEP L5: Contacts List Page

### [012] Contacts List View
- Screenshot: 012-contacts-list.png
- **Columns (6)**: Name | Account | Last interaction | Job title | Email addresses | LinkedIn
- **5 contacts**: Liam O'Brien (CEO, Dublin Software), محمد العلي (مدير المبيعات, GulfTech), Pierre Dubois (Directeur Commercial, TechFlow), James Park (CEO, NovaTech), Sarah Chen (CTO, Meridian Labs)
- **Unicode handling**: Arabic name (محمد العلي) and title (مدير المبيعات) render correctly
- **French title**: "Directeur Commercial" for Pierre Dubois
- **Footer**: "5 count" + aggregation buttons per column

---

## STEP L8: Opportunities Page (Kanban)

### [013] Opportunities Kanban Board
- Screenshot: 013-opportunities-list.png
- **7 pipeline stages**: Lead (0) | Qualification (1) | Demo (0) | Trial (0) | Proposal (0) | Won (0) | Lost (0)
- **Deal card** (Meridian Labs - API Product Deal): company logo, deal name, owner, no interactions/amount/close date
- **Footer per column**: "$0" total value
- **"+ Create opportunity"** in empty columns

---

## STEP L12: Tasks Page

### [014] Tasks List View
- Screenshot: 014-tasks-page.png
- **Default filter**: "Status is any of 2 values" (Open + In Progress)
- **Grouping by time**: "Today" (0), "This Week" (1 task)
- **Task**: "Follow up with Sarah Chen" — Meridian Labs — Due Apr 3

---

## STEP L13: Meetings Page

### [015] Meetings — Empty State
- Screenshot: 015-meetings-page.png
- "No meetings" — "Lightfield automatically syncs meetings from your calendar activity."
- CTA: "Go to settings →" to configure calendar

---

## STEP L14: Notes Page

### [016] Notes List
- Screenshot: 016-notes-page.png
- 3 notes grouped by account: "Sarah Chen - SaaStr 2025" (Meridian Labs), "James Park - Pricing Discussion" + "James Park - Background" (NovaTech)

---

## STEP L19: Chat Queries — Selected Key Queries

### Chat Interface
- Screenshot: 017-chat-new-empty.png
- **Full-page chat view** at /crm/agent
- **Suggested prompts** visible: "Enrich my new accounts using the web", "Summarize my active opportunities", "Which of my opportunities need updating?", "What's the deal value in my active opportunities?", "Draft an email to customers I need to follow up with today", "Prep me for my meetings today", "Generate tasks from my last meeting", "Research my accounts to determine my ICP"
- **Input**: "Ask Lightfield" placeholder + clock icon + settings icon + microphone + chat icon
- **Chat thread title** auto-generated from first query
- **Indicators**: "Ran code", "Retrieved CRM data", "Analyzed data", "Retrieved data" — shows what actions the AI took

### Query Results

#### Q01: "How many contacts do I have?"
- Screenshot: 018-chat-q01-contacts-count.png
- **Response**: "You have **5 contacts** in your CRM."
- **Indicator**: "Ran code" — executed a database query
- **Quality**: 10/10 — fast, accurate, concise
- **Citations**: None needed for count query

#### Q02: "Show me all contacts at Meridian Labs"
- Screenshot: 019-chat-q02-meridian-contacts.png
- **Response**: "Here's what I found for 💙 Meridian Labs:" + "Meridian Labs has one contact on record:" + table (Name: Sarah Chen, Title: CTO, Email: sarah@meridianlabs.io)
- **Indicator**: "Retrieved CRM data"
- **Quality**: 9/10 — accurate with table format, company badge, correct data
- **Citations**: Company badge links to account

#### Q03: "What's in my pipeline?"
- Screenshot: 020-chat-q03-pipeline.png
- **Response**: "You have **1 open opportunity** in your pipeline:" + table (Opportunity | Account | Stage) + Summary paragraph about the deal context
- **Indicator**: "Retrieved data"
- **Quality**: 9/10 — accurate, includes deal summary with context from notes
- **Citations**: Links to opportunity and account records

#### Q18: "What should I focus on today?"
- Screenshot: 021-chat-q18-focus-today.png
- **Response**: "Let me pull up the details on your open opportunity and any pending tasks..." + "Here's what deserves your attention today:" + "1. Follow up with Sarah Chen at Meridian Labs (due Friday, Apr 3)" with full context about SaaStr meeting and recommendation
- **Indicator**: "Analyzed data"
- **Quality**: 9/10 — actionable, prioritized, contextual. References specific meeting and suggests booking a discovery call.
- **Impressed**: AI synthesizes across tasks + opportunities + notes to give actionable advice
- **Disappointed**: Only shows 1 priority (but that's all the data we have)

#### Q22: "Draft a follow-up email to Sarah Chen referencing our last conversation"
- Screenshot: 022-chat-q22-draft-email.png
- **Response**: Generated email in a REAL EMAIL COMPOSER panel:
  - To: sarah@meridianlabs.io (auto-filled)
  - From: "No email account connected"
  - Subject: "Following up from SaaStr"
  - Body: Personalized referencing SaaStr 2025, Elevay's API product, requesting 30-min call
  - **Send button** (blue) — this is a REAL email composer, not text output
- **Quality**: 10/10 — real actionable email with correct recipient, personalized content
- **CRITICAL FINDING**: Email drafting opens a SIDE PANEL email composer with real send functionality. This is an AGENTIC ACTION, not just text generation.

#### Q28: "Help me prepare for a meeting with Meridian Labs"
- Screenshot: 023-chat-q28-meeting-prep.png, 024-chat-q28-meeting-prep-full.png
- **Response**: "The only documented context is the meeting at SaaStr 2025..." + generated email draft card + meeting prep document (loading in right panel as "meridian_labs_meeting_pre...")
- **Quality**: 8/10 — generates both email and meeting prep doc, but meeting prep was loading slowly
- **Actions taken**: Draft email card + meeting prep file generation
- **Impressed**: Generates TWO outputs — email + document

#### Q31: "Montre-moi mes opportunités ouvertes" (French)
- Screenshot: 025-chat-q31-french.png
- **Response in French**: "Vous avez **1 opportunité ouverte** dans votre pipeline :" + table with French column headers (Opportunité, Compte, Étape)
- **Quality**: 10/10 — perfect French response, correct data, French column headers
- **CRITICAL FINDING**: Lightfield handles French queries natively and responds entirely in French including UI table headers. Multi-language support works.

#### Q32: "What's the weather in Paris?" (nonsense)
- Screenshot: 026-chat-q32-weather.png
- **Response**: "I don't have access to weather data, unfortunately. I'd recommend checking a weather service like weather.com or searching 'Paris weather' on Google for current conditions."
- **Quality**: 9/10 — polite deflection with helpful suggestion, doesn't try to BS an answer
- **Good**: Doesn't hallucinate, provides alternative

#### Q23: "Create a task to follow up with Pierre Dubois by Friday"
- Screenshot: 027-chat-q23-create-task.png, 028-chat-task-created.png
- **Initial response**: "I don't have a contact named Pierre Dubois in your CRM. Could you clarify which account Pierre is associated with?"
- **After clarification** ("Pierre Dubois is at TechFlow. Create the task there."): Task created! Side panel shows task detail:
  - Title: "Follow up with Pierre Dubois"
  - Status: Todo
  - Assignee: Martin Paviot
  - Account: TechFlow
  - Due date: Apr 3
- **Quality**: 7/10 — failed to find an existing contact (Pierre IS in the CRM), needed manual clarification. But successfully created the task after clarification.
- **Disappointed**: Couldn't find Pierre Dubois despite him being in the contacts list. Data retrieval gap.
- **Impressed**: Actually CREATED the task as a real CRM record with correct account linking

### Chat Summary Observations
- **Response time**: 5-15 seconds for simple queries, 15-25 seconds for complex/action queries
- **Agentic actions**: Email drafting (real composer), task creation, meeting prep document generation
- **Data retrieval**: Generally good but had a miss (Pierre Dubois not found)
- **Multi-language**: French works perfectly
- **Out-of-scope handling**: Polite, helpful deflection
- **Indicators**: Different status labels show transparency (Ran code, Retrieved CRM data, Analyzed data)
- **Citations**: Company badges link to accounts, opportunity badges link to deals
- **Best feature**: The email composer side panel — it's a real send-ready email, not text output
- **Biggest weakness**: Occasional data retrieval misses for existing records

---

## STEP L22: Lightfield Synthesis

See `product-intelligence.md` for full analysis. Key takeaways:

- **Best feature**: NL chat with agentic actions (email composer, task creation, doc generation)
- **Worst feature**: Data retrieval inconsistency (couldn't find existing contact)
- **Best design**: Email composer side panel with real send functionality
- **Biggest gap vs Monaco**: No dashboard, no scoring, no signals, no sequences
- **Biggest gap vs us**: Email composer, meeting prep generation, multi-language, account-scoped chat
- **Design philosophy**: Minimalist "Notion for CRM" — opposite of Monaco's dense data
- **Information architecture**: 6 record types + cross-cutting AI chat layer

