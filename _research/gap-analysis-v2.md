# Gap Analysis v2 — Our Product vs Monaco vs Lightfield

**Date**: 2026-03-31
**Our status**: 19 features PASS (M3-M6), Foundation (M1) and Memory (M2) NOT built
**Sources**: teardown-monaco-v2, teardown-lightfield-v2

---

## Feature-by-Feature Comparison

| # | Our Feature | Monaco Equivalent | Lightfield Equivalent | Gap (what we're missing) | Priority |
|---|------------|------------------|----------------------|-------------------------|----------|
| 1 | F3.1 Company enrichment ✅ | Pre-built TAM with enrichment | Auto-enrichment on import | Parity | - |
| 2 | F3.2 Contact enrichment ✅ | Contact discovery + enrichment | Contact list with titles/emails | **Contact auto-suggestion** — Monaco discovers contacts at target accounts automatically | P1 |
| 3 | F3.3 TAM builder ✅ | Pre-built TAM on Day 1 | No equivalent | Parity (we're ahead of LF) | - |
| 4 | F3.4 ML scoring ✅ | A-F grades + 🔥 Burning | No scoring | **Score visualization** — flame/heat indicator, letter grades | P2 |
| 5 | F3.5 Signal overlay ✅ | Per-signal reasoning with citations | No signals | **Per-signal AI reasoning with source citations** — each Yes/No has a "why" with linked sources | P1 |
| 6 | F3.6 AI semantic search ✅ | NL search over TAM | NL chat over CRM data | Parity | - |
| 7 | F4.1 Sequence builder ✅ | Sequence workflow + gift integration | No sequences | **Approve/reject flow** — "Start" button + thumbs-down for human-in-the-loop | P1 |
| 8 | F4.2 AI email writer ✅ | Personalized messages with gift context | Email composer side panel | **Email composer side panel** — real send-ready email with To/From/Subject (Lightfield's approach) | P1 |
| 9 | F4.3 Autopilot enrollment ✅ | Monaco decides who to enroll | No equivalent | **Stall detection + nudges** — "Stalled 3 days" with auto-drafted follow-up | P1 |
| 10 | F4.4 Email sending infra ✅ | Not shown (internal) | "No email account connected" | Parity (we're ahead of LF) | - |
| 11 | F4.5 Reply detection ✅ | Response tracking + suggested replies | No outbound | **Suggested replies** — Monaco pre-drafts replies to incoming emails | P2 |
| 12 | F4.6 Deliverability monitoring ✅ | Not shown | No equivalent | Parity | - |
| 13 | F5.1 Deal management ✅ | Kanban with logos + values + totals | 7-stage kanban, minimal cards | **Pipeline column totals** — $ total per stage in column headers | P2 |
| 14 | F5.2 Signal-based stages ✅ | Signal-driven pipeline changes | Basic stage tracking | **Auto-generated deal timeline** — dated interaction history from emails/meetings/Slack | P1 |
| 15 | F5.3 Risk detection ✅ | Stall/ghosting detection | No risk detection | **Momentum indicator** — ⚡ icon on deals with high activity | P3 |
| 16 | F5.4 Auto deal summaries ✅ | Deal overview with owner + dates | Opportunity summary in chat | Parity | - |
| 17 | F5.5 Pipeline analytics ✅ | Not shown in detail | No analytics | Parity | - |
| 18 | F6.1 CRO Copilot ✅ | "You Lost Control" coaching | NL chat with data queries | **Sales coaching tone** — direct behavioral feedback, not polite assistant | P2 |
| 19 | F6.3 Prioritized actions ✅ | Daily dashboard with priorities | "What should I focus on" chat query | **DAILY DASHBOARD** — "Good morning Sam" + weekly summary + prioritized tasks + today's calendar | P0 |
| 20 | F6.4 Proactive insights ✅ | Proactive business intelligence | No proactive insights | Parity | - |
| 21 | — NOT BUILT — | Meeting recording + AI notes | Calendar auto-sync | **Meeting recording + structured extraction** — budget, team size, competitor tools from calls | P1 |
| 22 | — NOT BUILT — | Auto-generated follow-up emails | Meeting prep doc generation | **Auto-generated follow-up emails** — from meeting content with action items | P1 |

---

## NEW FEATURES NEEDED (Gaps Not Covered by Existing Features)

### P0 — CRITICAL (blocks competitive parity)

#### G1: Daily Dashboard
- **Source**: Monaco hero video frames 087-092
- **What**: "Good morning [name]" + weekly summary (sequences launched, responses, meetings, closes) + prioritized task cards with stall detection + today's calendar + inline email preview with AI-drafted follow-ups
- **Why**: This is Monaco's HOME SCREEN. Without it, users open our app and see... a list. Monaco users see exactly what to do today.
- **Milestone**: M8
- **Dependencies**: F6.3 (Prioritized actions), F5.3 (Risk detection)

### P1 — HIGH (significant competitive gaps)

#### G2: Per-Signal Reasoning with Citations
- **Source**: Monaco product page section 2
- **What**: Click any signal value → popover with "Reasoning" tab (AI explanation) + "Sources" tab (URLs with favicons)
- **Why**: Trust mechanism. Users can verify AI claims. Without it, signals feel like black boxes.
- **Milestone**: M8
- **Dependencies**: F3.5 (Signal overlay)

#### G3: Contact Auto-Suggestion
- **Source**: Monaco hero video frame 036
- **What**: Expand an account → see auto-discovered contacts with names, titles, "Suggested" status
- **Why**: Founders don't know who to contact. Monaco auto-discovers decision-makers.
- **Milestone**: M8
- **Dependencies**: F3.2 (Contact enrichment)

#### G4: Sequence Approve/Reject Flow
- **Source**: Monaco hero video frame 050
- **What**: "Start" button + thumbs-down reject for each AI-proposed sequence. Header shows "Sam Blond to Alex Shan (Co-Founder)"
- **Why**: Human-in-the-loop for autonomous outreach. Builds trust and prevents bad emails.
- **Milestone**: M8
- **Dependencies**: F4.1 (Sequence builder), F4.3 (Autopilot)

#### G5: Email Composer Side Panel
- **Source**: Lightfield chat Q22
- **What**: Side panel with To/From/Subject/Body fields + Send button. Pre-filled from AI draft.
- **Why**: Chat-drafted emails should be SENDABLE, not just text to copy-paste.
- **Milestone**: M8
- **Dependencies**: F4.2 (AI email writer), F4.4 (Email sending infra)

#### G6: Stall Detection + AI Nudges
- **Source**: Monaco hero video frames 089-090
- **What**: "Stalled 3 days" badge on dashboard tasks + AI-drafted follow-up email inline
- **Why**: Proactive stall detection prevents deals from dying silently.
- **Milestone**: M8
- **Dependencies**: F5.3 (Risk detection), F4.2 (AI email writer)

#### G7: Auto-Generated Follow-Up Emails
- **Source**: Monaco hero video frame 077
- **What**: After a meeting, auto-generate a follow-up email with extracted action items
- **Why**: Eliminates the most time-consuming post-meeting task for founders.
- **Milestone**: M8
- **Dependencies**: F2.5 (Auto-summarization, NOT BUILT), F4.2 (AI email writer)

#### G8: Deal Timeline from Interactions
- **Source**: Monaco hero video frames 074, product page section 5
- **What**: Auto-generated timeline with dated entries from emails, meetings, Slack
- **Why**: Pipeline should show what HAPPENED, not what got logged manually.
- **Milestone**: M8
- **Dependencies**: F2.4 (Activity timeline, NOT BUILT)

#### G9: Structured Data Extraction from Meetings
- **Source**: Monaco hero video frame 072
- **What**: Auto-extract budget ($30K), team size (4), competitor tools (Hubspot, Apollo), from meeting recordings
- **Why**: Turns conversations into structured deal intelligence automatically.
- **Milestone**: M9
- **Dependencies**: F2.2 (Calendar sync, NOT BUILT), F2.5 (Auto-summarization, NOT BUILT)

### P2 — MEDIUM (nice-to-have differentiators)

#### G10: Multi-Language Support
- **Source**: Lightfield Q31
- **What**: French/Spanish/etc queries get responses in the same language with translated UI elements
- **Milestone**: M9

#### G11: Score Visualization (Heat + Grades)
- **Source**: Monaco product page section 1
- **What**: Letter grade (A-F) + 🔥 Burning/Warm/Cold heat indicator
- **Milestone**: M8

#### G12: Suggested Replies to Incoming Emails
- **Source**: Monaco hero video frame 055
- **What**: AI pre-drafts replies to incoming emails. User edits and sends.
- **Milestone**: M9

#### G13: Pipeline Column Totals
- **Source**: Monaco feature video 3-2
- **What**: Stage name + deal count badge + total dollar value in kanban column headers
- **Milestone**: M8

#### G14: Account-Scoped Chat
- **Source**: Lightfield account detail page
- **What**: On account/deal detail pages, chat context automatically scoped
- **Milestone**: M8

#### G15: Chat Transparency Indicators
- **Source**: Lightfield chat
- **What**: "Ran code" / "Retrieved CRM data" / "Analyzed data" labels showing what the AI did
- **Milestone**: M8

### P3 — LOW (polish, can wait)

#### G16: 7 Account Lifecycle Stages
- **Source**: Monaco feature video 1-3
- **What**: New → Prospecting → Opportunity → Customer → Disqualified → Inbound → Nurture

#### G17: Momentum Indicator on Deals
- **Source**: Monaco hero video frame 074
- **What**: ⚡ icon on deals with high recent activity

#### G18: Custom Boolean Signal Columns
- **Source**: Monaco product page section 1
- **What**: Configurable columns like "Common Investor?", "Sales-led growth?", "YC Company?"

#### G19: Chat History Persistence
- **Source**: Lightfield sidebar
- **What**: Previous chat threads saved and browsable in sidebar

#### G20: Suggested Chat Prompts
- **Source**: Lightfield empty chat state
- **What**: 8 pre-built prompts on empty chat (e.g., "Summarize my active opportunities")

---

## Priority Summary

| Priority | Count | Examples |
|----------|-------|---------|
| P0 | 1 | Daily Dashboard |
| P1 | 8 | Signal reasoning, contact suggestion, sequence approve/reject, email composer, stall nudges, follow-up emails, deal timeline, structured extraction |
| P2 | 6 | Multi-language, score viz, suggested replies, column totals, scoped chat, transparency indicators |
| P3 | 5 | Lifecycle stages, momentum indicator, custom columns, chat history, suggested prompts |

**Total gaps identified: 20**

---

## Build Order Recommendation

### Phase 1 — M8: Dashboard + Signal Trust + Email Actions (P0 + select P1 + P2)
1. G1: Daily Dashboard (P0)
2. G2: Per-Signal Reasoning with Citations (P1)
3. G4: Sequence Approve/Reject Flow (P1)
4. G5: Email Composer Side Panel (P1)
5. G6: Stall Detection + AI Nudges (P1)
6. G11: Score Visualization (P2)
7. G13: Pipeline Column Totals (P2)
8. G14: Account-Scoped Chat (P2)
9. G15: Chat Transparency Indicators (P2)
10. G20: Suggested Chat Prompts (P3)

### Phase 2 — M9: Deep Intelligence + Memory (P1 requiring M2 features)
11. G3: Contact Auto-Suggestion (P1)
12. G7: Auto-Generated Follow-Up Emails (P1 — needs F2.5)
13. G8: Deal Timeline from Interactions (P1 — needs F2.4)
14. G9: Structured Data Extraction (P1 — needs F2.2, F2.5)
15. G10: Multi-Language Support (P2)
16. G12: Suggested Replies (P2)

### Phase 3 — M10: Polish + Customization (P3)
17. G16: 7 Account Lifecycle Stages (P3)
18. G17: Momentum Indicator (P3)
19. G18: Custom Boolean Signal Columns (P3)
20. G19: Chat History Persistence (P3)
