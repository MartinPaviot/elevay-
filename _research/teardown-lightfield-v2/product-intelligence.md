# Lightfield Product Intelligence v2

**Date**: 2026-03-31
**Trial expiry**: 2026-04-13 (13 days remaining)
**Sources**: Full product testing across all sections, 10 NL chat queries tested in depth

---

## What is Lightfield's BEST Feature?

**Natural language chat with agentic actions.** The NL chat doesn't just answer questions — it CREATES records (tasks), DRAFTS emails (in a real email composer with send button), and GENERATES documents (meeting prep files). The email composer side panel with auto-filled recipient, personalized subject/body, and a real "Send" button is the standout. The French language support (responding entirely in French with French table headers) is a bonus.

## What is Lightfield's WORST Feature?

**Data retrieval inconsistency.** The chat couldn't find Pierre Dubois despite him being in the contacts list. For a CRM built on NL queries, failing to find existing records is a critical failure. If users can't trust the data retrieval, they'll stop using the chat.

**Secondary**: The account creation flow is minimal (just name + website), meetings require calendar integration to show anything, and there's no scoring/prioritization system.

---

## For Each Section: Would a Founder Paying $99/mo Be Satisfied?

| Section | Satisfied? | Why |
|---------|-----------|-----|
| Accounts | Partially | Clean list view, good enrichment, but only 9 columns. No scoring, no signals, no TAM building |
| Contacts | Partially | Basic list, good unicode support, but only 6 columns. No relationship mapping |
| Opportunities | Partially | Clean kanban with 7 stages, but no deal values shown, no velocity tracking, no risk detection |
| Tasks | Yes | Simple, effective task management with time grouping and status filters |
| Meetings | No | Empty without calendar integration. No manual creation option visible |
| Notes | Partially | Basic note list grouped by account. No rich text editor tested. No @mentions |
| Chat/AI | Yes | Best feature. Agentic actions, multi-language, good data synthesis |
| Settings | Not tested | Deferred |
| Import/Export | Not tested | Deferred |

---

## Information Architecture

Lightfield is organized around **6 record types** (Accounts, Opportunities, Contacts, Tasks, Meetings, Notes) with a cross-cutting **Chat/AI layer**.

**Mental model**: Notion meets CRM meets AI assistant. Records are simple, flat, and editable. The AI layer adds intelligence by synthesizing across record types. The chat is the primary interaction surface for power users.

**Navigation**: Sidebar with 3 sections (Records, Resources, Lists) + Chats section with history. No dashboard/home page — the accounts list IS the default view.

---

## Design Philosophy

1. **Minimalism over density** — White backgrounds, lots of whitespace, thin borders. Opposite of Monaco's "Bloomberg terminal" density.
2. **Chat-first** — The NL chat is the primary power feature. UI pages are secondary for browsing.
3. **Auto-enrichment** — Accounts get industry/headcount/revenue auto-populated. But only for imported accounts, not manually created ones.
4. **AI-generated summaries** — Account summaries and business descriptions are auto-generated from interaction data.
5. **Agentic actions** — Chat can create tasks, draft emails, generate documents. Not just Q&A.
6. **Scoped chat** — On account detail pages, chat is scoped to that specific account.

---

## What Lightfield Does That We DON'T Do Yet

1. **Email composer side panel** — Real email drafting with To/From/Subject/Body and Send button
2. **Meeting prep document generation** — Auto-generated prep docs from account/deal data
3. **Multi-language NL queries** — French queries get French responses with French table headers
4. **Account-scoped chat** — Chat context automatically scoped to the current account
5. **"About their business" AI section** — Auto-generated business description from enrichment
6. **Suggested chat prompts** — Pre-built prompts on empty chat state (8 visible)
7. **Chat history in sidebar** — Previous conversations persist and are browsable
8. **Microphone input** — Voice input button on chat (not tested)
9. **Calendar auto-sync for meetings** — No manual meeting creation; syncs from Google/Outlook
10. **Auto-enrichment on import** — Accounts imported get auto-enriched; manual ones don't

---

## What Lightfield Does POORLY That We Can Do Better

1. **No dashboard/home page** — Drops you into accounts list. No "what to do today" view (Monaco has this)
2. **No scoring/prioritization** — No account score, no deal risk, no engagement heat
3. **No signal overlays** — No custom signals, no investor matching, no job posting signals
4. **No sequence/outbound automation** — No email sequences, no autopilot enrollment
5. **No deal velocity tracking** — Pipeline doesn't show how long deals have been in stages
6. **Data retrieval misses** — Chat couldn't find Pierre Dubois despite being in CRM
7. **Minimal account creation** — Only name + website. No industry/headcount/owner at creation
8. **No bulk actions** — No multi-select, no bulk edit, no bulk email
9. **No activity timeline** — Account detail doesn't show a chronological activity feed
10. **Limited filter fields** — 13 filters but missing name, tags, custom fields, score

---

## What We Should Steal vs Skip

### STEAL
1. Email composer side panel (real send functionality)
2. Agentic chat actions (create tasks, draft emails from NL)
3. Account-scoped chat context
4. "About their business" AI-generated section
5. Multi-language support
6. Suggested chat prompts for empty state
7. "Ran code" / "Retrieved data" / "Analyzed data" transparency indicators
8. Chat history persistence in sidebar

### SKIP
1. Calendar-only meetings (we should allow manual creation too)
2. No-dashboard landing (we need a dashboard like Monaco's)
3. Minimal account creation (we should capture more at creation)
4. Light theme only (we should support dark mode)
