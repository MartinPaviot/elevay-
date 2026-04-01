# Real vs Fake Assessment — 2026-04-01

## Assessment Methodology

For each feature, I read the actual source code and categorized:
- **REAL**: Calls external APIs, computes from actual data, or performs genuine operations
- **SEMI-REAL**: Uses real data as input but relies on LLM for analysis/generation (legitimate AI feature)
- **FAKE**: Uses LLM to hallucinate data that should come from real sources, or has no actual implementation behind the UI

## Feature-by-Feature Table

| Feature | Claimed | Code Reality | Verdict |
|---------|---------|-------------|---------|
| F1.1 Authentication | Clerk auth, Google/Microsoft OAuth, magic link | NextAuth with Google OAuth + credentials provider. No Clerk, no Microsoft, no magic link. | **SEMI-REAL** — auth works but doesn't match spec |
| F1.2 Multi-tenant workspace | Neon PostgreSQL, RLS, workspace creation, tenant isolation | All routes hardcode `tenantId: "default"`. No RLS policies. No workspace creation. | **FAKE** — multi-tenancy does not exist |
| F1.3 Core data model | Company, Contact, Deal, Activity entities with JSONB | Schema has all entities, proper types, indexes. | **REAL** |
| F1.4 Chat interface | Streaming chat, persistent threads, history sidebar | Streaming via AI SDK, RAG search, threads saved to DB, sidebar shows recent. | **REAL** (but no auth on chat API) |
| F1.5 Settings/onboarding | Workspace settings, user profile, onboarding, ICP config | Settings pages exist. No onboarding flow. Profile has hardcoded "Martin". | **SEMI-REAL** — settings yes, onboarding no |
| F2.1 Email sync | Google/Microsoft OAuth email sync, backsync, auto-capture | Gmail API via googleapis with real OAuth. Fetches real messages. No Microsoft. | **REAL** (Google only) |
| F2.4 Activity timeline | Unified timeline per contact/company/deal | Activities API + timeline display on detail pages. | **REAL** |
| F2.5 Auto-summarization | AI summarization with key points | LLM extraction exists but requires manual trigger. Not automatic. | **SEMI-REAL** |
| F2.6 Embedding + RAG | text-embedding-3-small, pgvector, retrieval | OpenAI embeddings → pgvector → cosine similarity. Full pipeline. | **REAL** |
| F2.7 NL queries with citations | Answer questions with citations to conversations | RAG search returns matching entities. No citation formatting or source links. | **SEMI-REAL** — search works, citations don't |
| F2.8 CSV import | Import from CSV with field mapping | CSV parsing, company/contact creation. Works. | **REAL** |
| F3.1 Company enrichment | Firmographics from data providers | Apollo `enrichOrganization()` first → LLM fallback. Apollo provides real data. | **REAL** (with LLM fallback that hallucinates) |
| F3.2 Contact enrichment | Title, email, LinkedIn from data providers | Apollo `enrichPerson()` first → LLM fallback. Apollo provides real data. | **REAL** (with LLM fallback that hallucinates) |
| F3.3 TAM builder | Auto-build TAM from ICP using data providers | Apollo `searchOrganizations()` with ICP-to-filter translation → LLM fallback. | **REAL** (with LLM fallback) |
| F3.4 ML scoring | ML scoring, signal-based prioritization | **No ML whatsoever.** Hand-coded rule-based scoring: Fit score (industry, size, revenue, tech stack, funding, location) + Engagement score (emails, meetings, recency, sentiment). Weighted 50/50. | **FAKE as "ML"** — but the rule-based scoring itself is real and deterministic |
| F3.5 Signal overlay | Real signals from APIs | LLM interprets Apollo enrichment data as buying signals. No real-time monitoring of hiring pages, news feeds, or funding announcements. | **SEMI-REAL** — signals are LLM-interpreted from real Apollo data, but no live signal monitoring |
| F4.1 Email sending (outbound) | AI email generation + delivery | Email generation via LLM works. **Outbound email records are created with status "queued" but NO SMTP/SES/EmailEngine send call exists.** Emails are never delivered. | **FAKE** — emails are generated but never sent |
| F4.2 Sequence engine | Multi-step automated sequences | Sequence CRUD, step templates, enrollment logic, Inngest function for step execution all exist. **BUT: no scheduler fires `sequence/step-due` events.** Sequences are created but never execute. | **FAKE** — the engine exists but has no ignition |
| F5.1 Pipeline/Kanban | Kanban board with drag-and-drop | Kanban board renders deals by stage. Stage colors, deal cards, column totals. **No drag-and-drop found in code.** Stage changes via API only. | **SEMI-REAL** — visual board yes, interactivity limited |
| F5.2 Deal intelligence | AI deal analysis, risk assessment | LLM `generateObject()` analyzes deal metadata + activity count. Returns risk level, suggested stage, next actions. | **SEMI-REAL** — legitimate AI feature |
| F6.1 Chat-first agent | Streaming chat with CRM context | Full implementation: RAG context injection, streaming, tool-use pattern, scoped chat. | **REAL** |
| F7.1 Data providers | Apollo.io integration | Full Apollo REST client: enrichOrganization, enrichPerson, searchOrganizations, searchPeople. 5 endpoints, error handling, rate limit awareness. | **REAL** |

### G-Series Features

| Feature | Claimed | Code Reality | Verdict |
|---------|---------|-------------|---------|
| G3 Contact auto-suggestion | Auto-discovered contacts from account expansion | Apollo `searchPeople()` for decision-makers at the company. Real API call. LLM fallback generates titles only. | **REAL** |
| G5 Email composer | Email generation + edit + send | LLM generates email → user edits in EmailComposer → "send" creates outbound record. **No actual delivery.** | **SEMI-REAL** — generation works, delivery doesn't |
| G7 Follow-up emails | Auto-generate follow-up with action items | LLM generates from meeting context. Legitimate AI writing tool. | **SEMI-REAL** |
| G8 Deal timeline | Auto-generated timeline from interactions | Queries activities table for deal-related entries. Renders with dates. | **REAL** |
| G9 Structured extraction | Extract budget/team/competitors from notes | LLM `generateObject()` with structured schema. Saves to deal properties. | **SEMI-REAL** — legitimate NLP extraction |
| G10 Multi-language chat | French/Spanish etc responses | `detectLanguage()` function, system prompt includes language instruction. | **REAL** |
| G11 Score visualization | Letter grade + fire emoji + heat indicator | Renders from computed score. Grade boundaries in UI code. | **REAL** |
| G12 Suggested replies | AI pre-drafts 3 reply options | LLM generates brief/detailed/decline options. | **SEMI-REAL** |
| G13 Pipeline column totals | Stage name + count + total value | Computed from deals array in the Kanban component. | **REAL** |
| G14 Account-scoped chat | Chat context scoped to current record | ScopedChat component passes contextType/contextId. RAG filters by context. | **REAL** |
| G15 Chat transparency | Labels showing what AI did | metadata field in chat messages. Unclear if indicators actually render in UI. | **UNCERTAIN** |
| G16 7 lifecycle stages | Color-coded lifecycle pills | Lifecycle enum, stage update API, color mapping in accounts page. | **REAL** |
| G17 Momentum indicator | Lightning bolt on high-activity deals | `getMomentum()` computes from recent activities. Icon renders conditionally. | **REAL** |
| G18 Custom boolean signals | Configurable Yes/No columns | **Hardcoded** `["Common Investor?", "Sales-led?"]` in useState. Not configurable. | **FAKE** — not dynamic/configurable as claimed |
| G19 Chat history | Previous threads browsable | Threads saved to DB, sidebar lists recent 5, resumable via URL param. | **REAL** |
| G20 Suggested prompts | 8 pre-built prompts on empty state | 8 static prompt suggestions rendered in chat page. | **REAL** |

## Specific Deep-Dive Checks

### Company Enrichment (`api/enrich/route.ts`)
**Path 1 (Apollo)**: Calls `apolloClient.enrichOrganization(domain)` → gets real firmographics (industry, employee count, revenue, funding, tech stack, location). Stores with `enrichment_source: "apollo"`.
**Path 2 (LLM fallback)**: `generateObject()` asks Claude to "research" the company → **hallucinates firmographics**. Stores with `enrichment_source: "llm_fallback"`.
**Verdict**: REAL when Apollo key present. FAKE data when falling back to LLM.

### Contact Enrichment (`api/enrich-contacts/route.ts`)
Same dual-path pattern as company enrichment. Apollo `enrichPerson()` returns real title, seniority, LinkedIn. LLM fallback hallucinates.
**Verdict**: Same as above.

### TAM Builder (`api/tam/route.ts`)
**Step 1**: LLM translates ICP description → Apollo search filters (keywords, employee ranges, locations).
**Step 2 (Apollo)**: `apolloClient.searchOrganizations(filters)` → real companies from Apollo's 200M+ database.
**Step 3 (LLM fallback)**: `generateObject()` generates 30 company names → **completely hallucinated companies**.
**Verdict**: REAL when Apollo available. FAKE companies from LLM fallback.

### Email Sending (`api/emails/route.ts` + `inngest/functions.ts`)
Email generation: LLM drafts personalized emails. **This works.**
Email delivery: `outbound_emails` table gets a record with `status: "queued"`. **No code anywhere calls SMTP, SES, or EmailEngine to actually send the email.** The `settings/mailboxes/route.ts` connects to EmailEngine for mailbox setup but no send path exists.
**Verdict**: Generation is real. Delivery is **completely fake**.

### Meeting Recorder
**No meeting recording functionality exists anywhere in the codebase.** No microphone access, no transcription API calls, no recording storage. Calendar sync fetches meeting metadata but doesn't record anything.
**Verdict**: **Does not exist.**

### Email Sync (`api/email/sync/route.ts` + `lib/gmail.ts`)
Uses `googleapis` with OAuth2 to fetch real Gmail messages. Token management, dedup by gmailMessageId, activity creation.
**Verdict**: **REAL** (Google only, no Microsoft).

### Auto-enrichment Inngest (`inngest/functions.ts`)
The `enrichCompany` function has trigger `company/created`. The `accounts/route.ts` POST handler fires `inngest.send({ name: "company/created", data: { companyId, tenantId } })`.
**However**: The Inngest function uses LLM to enrich, NOT Apollo (unlike the API route which uses Apollo first). This means auto-enrichment produces hallucinated data.
**Verdict**: Trigger is **REAL** (actually fires). But enrichment is LLM-only (no Apollo in Inngest path).

### Scoring (`api/score/route.ts`)
Pure algorithmic: Fit score (0-100) from Apollo data fields + Engagement score (0-100) from activity metrics. No LLM, no ML, no external API.
**Verdict**: **REAL** as a scoring system. **FAKE** as "ML scoring" — it's weighted heuristics.

### Signal Overlay (`api/signals/route.ts`)
Reads Apollo enrichment data (funding, tech stack, employee count) → asks LLM to interpret as buying signals with instruction "ONLY generate signals based on the facts above, do NOT invent any information."
**Verdict**: **SEMI-REAL** — constrained LLM interpretation of real data. Not monitoring live sources.

## Summary Scorecard

| Category | Count | Features |
|----------|-------|----------|
| **REAL** | 17 | F1.3, F1.4, F2.1, F2.4, F2.6, F2.8, F3.1, F3.2, F3.3, F6.1, F7.1, G8, G10, G11, G13, G16, G17, G19, G20 |
| **SEMI-REAL** (legitimate AI feature) | 10 | F1.1, F1.5, F2.5, F2.7, F3.5, F5.1, F5.2, G5, G7, G9, G12, G14 |
| **FAKE** (core claimed functionality missing) | 6 | F1.2 (multi-tenancy), F3.4 ("ML" scoring), F4.1 (email delivery), F4.2 (sequence execution), G18 (not configurable) |
| **UNCERTAIN** | 1 | G15 (transparency indicators) |
| **NON-EXISTENT** | 1 | Meeting recorder (not in codebase at all) |

## The Three Biggest Lies

1. **"Multi-tenant workspace with RLS"** — Every route uses `tenantId: "default"`. No RLS. No workspace creation. No tenant isolation whatsoever.

2. **"Email sending and sequence execution"** — Emails are drafted and saved to a `queued` status in the database. They are never sent. Sequences are created but the scheduler that fires step execution events does not exist.

3. **"ML scoring"** — There is no machine learning. The scoring is a hand-coded weighted formula. This is honest engineering (rule-based scoring works fine) but dishonest labeling.
