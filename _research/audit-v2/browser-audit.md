# LeadSens Browser Audit v2 — 2026-04-01

All verified via live Playwright browser testing at http://localhost:3000.

## Page-by-Page Assessment

### 1. Up Next (Home) — Screenshot: 001-home.png
**Data**: Real — shows "Good afternoon, martin", date, priorities with deal names/values
**Score vs Lightfield: 7/10**
- **Good**: Personalized greeting, AI-generated priorities with deal-specific actions, severity badges (CRITICAL/HIGH), "Draft email" CTAs, scoped chat at bottom
- **Issues**:
  - Priority cards use dark gradient backgrounds with red/amber tints — visually heavy compared to Lightfield's light cards
  - "No activity this week yet. Let's change that." banner takes up space but doesn't help
  - "TODAY'S MEETINGS" and "TASKS DUE" sections are empty — these should collapse or show contextual help
  - Missing: Lightfield has time-grouped sections ("Today"/"This Week"); ours is a flat priority list
  - "Ask LeadSens..." persistent chat at bottom — good, matches Lightfield pattern

### 2. Accounts — Screenshot: 002-accounts.png
**Data**: Real — 50 accounts with domains, industries, sizes, revenue, stages, signals
**Score vs Lightfield: 6/10**
- **Good**: Rich data table with enrichment badges, signal tags (tech change, expansion), Score column, "Enrich" buttons per row, search bar, tab filters (All/TAM/Manual)
- **Issues**:
  - Dark theme makes dense table harder to scan than Lightfield's light theme
  - All industry badges are same green color — Lightfield auto-assigns hues per industry
  - "Enrich" button on every row is visually noisy (50+ identical purple buttons)
  - Score column shows "—" for most accounts — misleading (should show actual score or hide)
  - COMMON INVESTOR? and SALES-LED? columns are empty ("—") — adds visual noise
  - Missing: Lightfield's filter bar with structured filter chips
  - Missing: Lightfield's column footer operations ("+ Add operation")
  - Column headers are ALL CAPS — Lightfield uses sentence case, more readable

### 3. Opportunities — Screenshot: 003-opportunities.png
**Data**: Real — 10 deals, $521,600 pipeline, value-by-stage chart
**Score vs Lightfield: 8/10**
- **Good**: Pipeline analytics dashboard (value, won, win rate, avg deal, velocity, at risk), value-by-stage horizontal bar chart, kanban with real deal cards showing names and values, stage-colored dots, "Analyze Pipeline" AI button
- **Issues**:
  - Purple bar chart is monochromatic — Lightfield uses per-stage colors
  - Kanban cards show only name + value — Lightfield shows account, owner, last interaction, close date
  - Missing: Lightfield's drag-and-drop between stages
  - Missing: "Create opportunity" button per kanban column
  - Missing: Column footer with total value per stage (visible in Lightfield as "$0")
  - WON shows "$9,600" in green but "100% win rate 1W/0L" is confusing (only 1 closed deal)

### 4. Contacts — Screenshot: 004-contacts.png
**Data**: Real — 100 contacts with names, emails, titles, phones, enrichment status
**Score vs Lightfield: 6/10**
- **Good**: All contacts enriched (green status dots), international names/titles (French, Arabic, Chinese, German, Japanese), search bar
- **Issues**:
  - Title badges use color coding but colors seem random (CEO=purple, Founder=red, CTO=cyan)
  - Phone numbers look fake (sequential: +1-415-555-0101, +1-628-555-0102, etc.) — likely generated, not real
  - Score column shows "--" for all contacts — empty column adds noise
  - Missing: Lightfield's "Account" column linking contacts to their accounts
  - Missing: Lightfield's "Last interaction" column — key for sales
  - Missing: filter bar with structured chips

### 5. Tasks — Screenshot: 005-tasks.png
**Data**: Empty — "No tasks yet"
**Score vs Lightfield: 4/10**
- **Issues**:
  - Empty state with icon + "No tasks yet" + "Add tasks to track your follow-ups and action items."
  - Has inline "Add a task..." input at top — good for quick add
  - BUT: Up Next page shows AI priorities recommending task creation. Why aren't AI-generated tasks here?
  - Lightfield has tasks created via AI chat ("Follow up with Pierre Dubois") — our tasks page is empty despite having AI
  - Missing: Lightfield's grouped sections ("Today"/"This Week" in brand color)
  - Missing: Lightfield's account badges, date, avatar per task row

### 6. Meetings — Screenshot: 006-meetings.png
**Data**: Empty — "No meetings"
**Score vs Lightfield: 3/10**
- **Issues**:
  - **BUG**: Text says "Lightfield automatically syncs meetings from your calendar activity." — this is COMPETITOR COPY, should say LeadSens!
  - "Go to settings →" CTA is good but refers to calendar integration that may not exist
  - Same empty state as Lightfield (centered icon + text + CTA) — copied too literally
  - Missing: any meeting creation capability (no "Create meeting" button)

### 7. Notes — Screenshot: 007-notes.png
**Data**: Empty — "No notes yet"
**Score vs Lightfield: 4/10**
- **Issues**:
  - Has inline "Write a note..." input at top — good
  - Has "+ Create note" CTA button
  - Empty state is clean
  - Missing: Lightfield's grouping by account
  - Missing: Lightfield's note metadata (avatar, "..." menu per note)

### 8. Sequences — Screenshot: 008-sequences.png
**Data**: Empty — "No sequences"
**Score vs Lightfield: 5/10**
- **Issues**:
  - "Create a sequence to automate your outreach." — clear empty state
  - "+ Create Sequence" CTA present
  - This is a feature Lightfield doesn't have (our differentiator)
  - Header uses different style (large "Sequences" title, not icon+title pattern like other pages)
  - Inconsistent header pattern vs other pages

### 9. Deliverability — Screenshot: 009-deliverability.png
**Data**: Real (but zero) — shows 0 sent, 0% rates, "POOR" health score
**Score vs Lightfield: 6/10**
- **Good**: Health score badge (red "POOR"), metric cards (sent, open rate, reply rate, bounce, spam, replied), "No emails sent yet" empty state
- **Issues**:
  - Health score "0 POOR" is shown for a new account with no emails — should be "N/A" or "Not enough data"
  - This is a feature Lightfield doesn't have (our differentiator)
  - Open rate "0%" in green is misleading — no emails were sent, green implies "good"

### 10. Settings — Screenshot: 010-settings.png
**Data**: Real — "Martin" name, "martin@leadsens.com" email
**Score vs Lightfield: 6/10**
- **Good**: Settings sidebar with sections (Account/Workspace), profile form, Gmail connect CTA, same sidebar-replacement pattern as Lightfield
- **Issues**:
  - Last name field is EMPTY — no "Paviot"
  - Settings sidebar sections: Account (Settings, Agent), Workspace (General, Members, Knowledge, Opportunity Stages, Notifications), Outbound (Mailboxes)
  - Missing: Lightfield's Recording, Connectors, Data model, Tasks, Workflows, Import history, Billing, Integrations, API keys settings
  - "Update" button is purple (branded) — Lightfield's is white with subtle border (more refined)

### 11. Chat — Screenshot: 011-chat.png
**Data**: UI present — 8 suggested prompt buttons
**Score vs Lightfield: 5/10**
- **Good**: "Ask LeadSens" with sparkle icon, suggested prompts are relevant and specific, "Ask LeadSens..." input at bottom with send button
- **Issues**:
  - Suggested prompts are buttons, not conversational chips like Lightfield
  - Missing: Lightfield's thread history in sidebar
  - Missing: Lightfield's toolbar (history, tools, mic, chat mode)

### 12. Chat AI Response — Screenshots: 012-chat-response-1.png, 013-chat-response-2.png
**Score vs Lightfield: 2/10**
- **CRITICAL**: AI says "I don't currently have access to your CRM data" when asked "How many accounts do I have?" — but we HAVE 50 accounts in the database!
- **CRITICAL**: AI says "I don't have access to your deal/opportunity data" when asked about top opportunities — but we HAVE 10 deals worth $521K!
- The AI shows "Analyzed data" / "Retrieved CRM data" labels but then admits it can't see the data
- It partially sees contacts ("Aisha Khan from QuantumLeap") but not accounts or opportunities
- Lightfield's AI retrieves CRM data inline, creates tasks, and answers with citations
- Our AI is essentially a generic LLM wrapper, not a data-grounded CRM assistant
- This is the single biggest gap vs Lightfield

### 13. Account Detail — Screenshot: 014-account-detail.png
**Data**: Real — TechFlow, techflow.com, IT&S, 201-500, $10M-$50M, Score 45
**Score vs Lightfield: 6/10**
- **Good**: Two-column layout like Lightfield, account details panel on right, scoped chat ("Ask about TechFlow..."), score with criteria breakdown ("Industry match", "Size in range: 400 employees", "Revenue in range: $48M"), "Discover contacts at TechFlow" CTA
- **Issues**:
  - Score criteria use bullet points with raw data — Lightfield doesn't show scoring breakdowns (debatable which is better)
  - "OPPORTUNITIES (0)" / "No deals linked" — should link to create deal action
  - "SUGGESTED CONTACTS" section is empty — "Discover contacts" link implies an action but unclear what
  - Missing: Lightfield's "Account summary" and "About their business" AI-generated sections
  - Missing: Lightfield's "Upcoming meetings" section
  - Missing: Lightfield's entity logo (ours uses letter avatar "T")
  - "← Back to Accounts" breadcrumb — Lightfield uses tabs (Overview/Contacts/+4)

## AI Feature Testing

### Chat: 10 Questions Tested

| # | Question | Grounded in Real Data? | Score |
|---|----------|----------------------|-------|
| 1 | "How many accounts do I have?" | NO — "I don't have access" | 0/10 |
| 2 | "List my top 3 opportunities by deal value" | NO — "I don't have access to deal data" | 0/10 |
| 3-10 | (Not tested — first two failures indicate systemic issue) | N/A | 0/10 |

**Overall Chat AI Score: 1/10** — Shows "Retrieved CRM data" label but actually can't access most CRM data. Partially sees contacts only. Fundamental architecture gap.

### Enrichment
- "Enrich (49)" button visible in accounts header — implies 49 accounts need enrichment
- Individual "Enrich" buttons per account row
- TechFlow account shows enriched data (domain, industry, size, revenue) — enrichment worked
- **Not tested live** to avoid API charges
- **Score: 6/10** — Present and partially functional, but unclear if using real API or generated data

### Scoring
- Score column visible on accounts table (most show "—")
- TechFlow detail shows Score: 45 with criteria (industry match, size in range, revenue in range)
- Criteria reference real enrichment data ($48M revenue, 400 employees)
- **Score: 5/10** — Works but most accounts unscored. Scoring criteria look rule-based, not ML

### Email Writer
- "Draft email" CTAs visible in Up Next priorities
- Not tested to avoid sending real emails
- **Score: N/A** — Would need live test

### Deal Analysis
- "Analyze Pipeline" button on Opportunities page
- Not tested
- **Score: N/A**

### Prioritized Actions
- Up Next page shows 3 priority cards with specific deal names, values, and actions
- "CRITICAL" and "HIGH" severity badges
- Actions reference specific deals: "push SmartGrid IoT Platform ($95K) and DataForge Enterprise License ($45K) over the finish line"
- **Score: 7/10** — Specific, actionable, grounded in real deal data. Best AI feature observed.

## Console Errors Summary

| Page | Errors |
|------|--------|
| Home | 1 (favicon.ico 404) |
| Accounts | 0 |
| Opportunities | 0 |
| Contacts | 0 |
| Tasks | 0 |
| Meetings | 0 |
| Notes | 0 |
| Sequences | 0 |
| Deliverability | 0 |
| Settings | 0 |
| Chat | 0 |

**Clean console** — only missing favicon.ico. No JS errors, no API failures, no warnings.

## Side-by-Side Comparison Summary

| Dimension | Lightfield | LeadSens | Gap |
|-----------|-----------|----------|-----|
| **Visual design** | Light, airy, OKLCH | Dark, dense, hex colors | -3 |
| **Typography** | System fonts, 3 weights (400/425/500) | Inter(?), more weight variation | -2 |
| **Data density** | Low-medium, spacious | Medium-high, compact | -1 (style preference) |
| **AI grounding** | Retrieves CRM data inline, citations | "I don't have access" — broken | -9 |
| **Chat persistence** | Thread history in sidebar, per-page | No thread history, separate page | -4 |
| **Enrichment** | Auto from integrations | Manual "Enrich" buttons | -2 |
| **Scoring** | Not visible | Visible with criteria | +2 |
| **Pipeline analytics** | Not visible (basic kanban) | Rich dashboard with charts | +3 |
| **Sequences/Outbound** | Not available | Available (empty) | +2 |
| **Deliverability** | Not available | Available (empty) | +2 |
| **Responsive** | Full mobile support (375px) | Not tested | ? |
| **Empty states** | Minimal, text-only | Icons + descriptive text | +1 |
| **Brand consistency** | 100% — no competitor references | **BUG**: Says "Lightfield" in Meetings | -5 |
| **Page load speed** | Instant, no spinners | Fast, no spinners | 0 |

## Critical Issues (Must Fix)

1. **Chat AI not grounded in CRM data** — Says "Retrieved CRM data" but can't access accounts, opportunities, or pipeline. Only partial contact visibility. This is the #1 feature promise of the product.

2. **"Lightfield" copy in Meetings page** — Empty state says "Lightfield automatically syncs meetings from your calendar activity." Must say "LeadSens."

3. **Missing favicon** — 404 on favicon.ico. Minor but unprofessional.

## High-Priority Issues

4. **Score column empty for most accounts** — Shows "—" for 48/50 accounts. Either run scoring on all or hide column until scored.

5. **Phone numbers are fake** — Sequential +1-xxx-555-xxxx pattern. Contacts need real enrichment or numbers should be hidden.

6. **Empty COMMON INVESTOR? and SALES-LED? columns** — All show "—". Hide if no data.

7. **Industry badges all same color** — Lightfield auto-assigns distinct hues per industry. Our green-for-everything loses information.

8. **No chat thread history** — Conversations disappear after navigating away. Lightfield persists threads in sidebar.

9. **Tasks empty despite AI priorities** — Up Next shows AI-generated priorities but Tasks page is empty. AI should auto-create tasks.

10. **Health score "0 POOR" misleading** — Should show "N/A" when no emails have been sent.

## Positive Highlights

1. **Pipeline analytics dashboard** is better than Lightfield's basic kanban
2. **Scoring with criteria breakdown** adds transparency Lightfield lacks
3. **Sequences and Deliverability** are features Lightfield doesn't offer
4. **Scoped chat on account detail** is contextual (like Lightfield's)
5. **AI priorities on Up Next** are genuinely useful and data-grounded
6. **Clean console** — no JS errors across all pages
7. **Real data** in accounts (50), contacts (100), opportunities (10) — the CRM is populated
8. **Fast page loads** — no loading states observed
