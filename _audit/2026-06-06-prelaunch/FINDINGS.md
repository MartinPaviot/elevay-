# Elevay — Pre-launch PM Audit (2026-06-06)

Auditor: Claude (acting PM, hostile-QA mindset). Branch: `fix/audit-fluidity`.
Environment: local dev (`localhost:3000`), real data tenant `47dca783-…` (E2E Test Workspace, 2287 companies / 519 contacts in DB).
Login: martin@elevay.dev (canonical founder account).

Severity key: **P0** launch blocker · **P1** fix before launch · **P2** polish / post-launch · **NIT** minor.

Method: click every interactive element on every user-facing page, screenshot before/after, log friction. Then stress-test chat end-to-end, critiquing formatting each turn.

---

## Navigation surface (sidebar, logged-in)

- Header: Elevay logo · **Search** (icon button) · **Collapse sidebar**
- Pinned: **Up next** (→ `/`), **Notifications** (button)
- **AI**: Knowledge · Skills
- **CRM**: Accounts · Contacts · Opportunities · Proposals
- **Engage**: Inbox · Call Mode · Campaigns (→ `/sequences`) · Deliverability
- **Activity**: Meetings · Notes · Tasks · Insights · Reports
- **Chats**: New chat + recent threads
- Footer: workspace switcher (E2E Test Workspace / "ET") · user (Martin)

Routes that exist but are NOT in the sidebar (admin/secondary, to verify): `/graph`, `/voice-of-customer`, `/cs/today`, `/pricing`, `/meetings/upload`, `/objects/[type]`, `/settings/*`, `/onboarding-v3`.

---

## FINDINGS LOG (running, newest appended)

### Cross-cutting essentials

- **[P1 if mobile is in scope] Not responsive — desktop-only.** At 390px the full ~240px desktop sidebar still renders, squeezing content into ~150px (headings wrap one word per line, setup card unreadable). No hamburger/drawer, no auto-collapse on small screens. Founders will open this on a phone; at minimum auto-collapse the sidebar below a breakpoint. (No horizontal page overflow, at least.)
- **[NIT] Greeting inconsistent**: "Good morning, Martin" (first load + chat) vs "Welcome back" (later) — pick a consistent greeting system.
- **[P2] 404 page is the bare Next.js default** ("404 — This page could not be found.") — no Elevay branding, no app shell, and **no "Back to home" link** (a user who hits a dead link is stranded except for the browser back button). Ship a custom branded `not-found.tsx` with a return CTA (and maybe global search).
- **[P1] Account menu (Settings / theme / Log out) is hover-only and not a real control.** The sidebar footer (avatar + first name) has `cursor: default`, **no click handler, and no focusable trigger button**; the menu only appears on `onMouseEnter`. Consequences: (a) **undiscoverable** — nothing signals it's interactive (I clicked it 3 ways before reading the source); (b) **keyboard-inaccessible** — no focusable trigger, so keyboard users can't reach Log out/Settings; (c) **breaks on touch/mobile** — no hover. This is the ONLY path to sign out. Make it a clickable, focusable `<button>` (keep hover as a bonus).
- **[GOOD] Dark mode toggle exists** in that menu (Light/Dark), plus Settings and "Contact the team" (mailto support).
- **[P2] Next.js dev-tools button overlaps the sidebar footer** (bottom-left) in dev — obscures the user avatar while developing. Dev-only, but worth `position`-ing the app's footer clear of it.
- **Settings hub (`/settings`)** — [GOOD] curated sub-nav grouped Account / Workspace / Billing (admin-only pages correctly hidden); Profile default with name/email/language/timezone + Update; "Mail & Calendar settings" card. [P2] generic browser title; [P2] left settings rail uses its own pattern (fine) but Log out is not offered here (only via the hover menu).

### CHAT — Q5 "What should I focus on today? (prioritized brief)"

- **[P1] Emoji in chat output — violates the no-emoji brand rule.** The brief uses 🔴 🟠 🟡 as priority markers. The entire app rigorously avoids emoji (enforced by tests, per the "AI clichés" purge); the assistant must follow the same rule via its system prompt. Replace with text/lucide severity, not emoji.
- **[P0 reinforced] Brief is built entirely on the 13 deleted deals** (DataForge, SmartGrid, Vortex AI…) — it's coaching the founder to chase phantom pipeline ("Call NovaTech on DataForge — $100K already leaving").
- **[P2] Turn-to-turn inconsistency:** Q4 said "none of your deals have a contact"; Q5 says "11 of 12." Also "Retrieved tasks — 3 tasks" while the Tasks page shows 4.
- **[P2] Internal tool name leak again:** "briefAllDeals" shown to user.
- **[GOOD — format] Excellent brief structure** (numbered priorities by impact, $ + stage, bold deal chips, a single "most important call" conclusion, plus a CRM-hygiene insight). Direct, actionable tone ("Call today — not email"). If the data were correct, this is a best-in-class daily brief.

### CHAT — overall verdict (formatting + behavior)

**Rendering layer is genuinely strong:** real HTML tables, clickable entity chips/links, bolded numbers, numbered/bulleted lists, collapsible tool steps (with ✓ and inline result counts), per-message Copy button, context-aware follow-up chips, concise answers (no over-formatting), strong anti-hallucination (refused to invent a CEO), and honest caveats. The *presentation* of what it proposes is largely production-quality.

**The substance is not trustworthy yet** — three things gate launch:
1. **[P0] Soft-delete/entity filters not applied in chat tools** → reports deleted contacts (519) and deleted deals ($618,999) as live, contradicting the UI on every core metric. THE blocker.
2. **[P1] Doesn't run in any environment I can reach** (local TLS MITM; prod missing LLM key) + 22s-to-fail + HTTP 200-on-error + generic error copy.
3. **[P1] "Top N by X" computed over a subset; emoji in output; internal tool names leak; small count mismatches.** Polish before launch.

### CHAT — Q4 "Pipeline summary + most important next step"  ← HEADLINE BUG

- **[P0 — launch-blocking, systemic] The chat reports SOFT-DELETED records as live, and contradicts the entire UI on every core number.**
  - Chat: **"Pipeline: $618,999 across 12 open deals"** (13 total), listed real deal names (DataForge $99,999, Vortex AI $120,000, SmartGrid $95,000 negotiation, …) and advised *"close SmartGrid IoT Platform this week."*
  - UI everywhere: Opportunities, Home, Insights all show **0 deals / $0 pipeline.**
  - **DB verified:** `deals` table has 13 rows for the tenant, **all 13 have `deleted_at` set** (2026-06-05 cleanup). So the UI is correct; the chat's deal tools **don't filter `deleted_at`** and surface deleted deals as live pipeline — even coaching the user to act on a **deleted** deal.
  - Same root cause as contacts (Q1 519 vs UI 0) and accounts (chat 2,287 vs UI 767). And it's **tool-inconsistent**: Q3's contact lookup returned 0 (filtered) while Q1's count + Q4's deal tools did not.
  - **Impact:** for a product whose promise is "ask your pipeline, 95%+ accuracy with citations," confidently reporting $618K of deleted pipeline as real is a trust catastrophe. **Every chat data tool must apply the same tenant + soft-delete + entity-definition filters as the UI (ideally share one query layer).** Highest-priority fix.
- **[GOOD] Response shape is otherwise excellent:** concise pipeline headline, a deals table (Deal/Stage/Value) with "+4 more" truncation, a single bolded recommendation with rationale, and it even flagged "none of your deals have a contact attached" (a real coaching insight) — plus context-aware chips ("Which deals are at risk?", "Coach me on the top deal").

### CHAT — Q3 "Draft a cold email to the CEO of Groupe Vidymed"

- **[GOOD — strong] No hallucination:** found 0 contacts, refused to invent a CEO/email, and offered two concrete next steps (1. Add CEO manually, 2. Enrich `vidymed.ch` for decision-makers). Exactly the human-in-the-loop behavior the product promises.
- **[GOOD] Rich rendering:** tool steps with inline results ("Retrieved contacts — 0 contacts ✓", "— 0 results ✓"), an **inline clickable account chip** (avatar + "Groupe Vidymed") mid-sentence, clean numbered list with bold lead-ins, context-aware follow-up chips ("Show me the full activity history").
- **[P0 — confirms Q1 bug] The chat contradicts ITSELF on contact count:** Q3 reports "0 contacts" (correct, matches UI) but Q1 reported "519 contacts." One tool honors soft-delete, another doesn't. Pick one definition across all chat tools.
- **[P2] Inconsistent tool-step labels:** some friendly ("Retrieved contacts"), some raw internal names ("runBasicReport", "executeCode"). Normalize all to friendly labels.
- **[NIT] Rigidity:** blocks drafting entirely without a contact record; a founder may want a usable draft addressed to the company/role even before the contact exists.

### CHAT — Q2 "Top 8 accounts by score as a table"

- **[GOOD] Markdown table renders as a real, well-styled HTML table** (Account/Industry/Size/Score, 8 rows), with **clickable account links** + colored avatar initials. Strong.
- **[GOOD] Transparent reasoning + honesty**: it noted "this query returns recent accounts, not necessarily the top-scored across all 2,287… let me run a proper search," ran `executeCode`, and caveated "there may be higher-scored ones not surfaced — want me to run a full sort?"
- **[P1] But the honesty masks wrong behavior:** "top 8 by score" was computed over a recent subset, not all accounts — so the answer to a "top N by X" question is not actually correct. The retrieval tool fetches a window then sorts in-memory. Fix to sort server-side across the full (filtered) set.
- **[P2] Overgeneralization / mild hallucination:** "note that all accounts in your CRM appear to be in the 100–1000 employee size range" — inferred from only the 8 visible rows. Don't generalize from the sample.
- **[P2] Internal tool names leak again** ("executeCode", "runBasicReport"). [P2] wrong "2,287" repeats. [P2] composer is a single-line `<input>`, not a growing multiline textarea (limits longer prompts / shift+enter).

### CHAT — Q1 "How many accounts and contacts do I have?" (after TLS workaround)

Render: assistant "Elevay" label → collapsible tool steps ("Retrieved data ✓", "runBasicReport ✓", "runBasicReport ✓") → answer **"2,287 accounts and 519 contacts."** (numbers bolded) → follow-up chips "Draft an email to them" / "Prepare me for a meeting".

- **[P0] Chat numbers contradict the UI.** Chat says **2,287 accounts / 519 contacts**; the UI shows **767 accounts** (Accounts page + Home) and **0 contacts** (519 soft-deleted). The chat's `runBasicReport` counts raw rows (all `companies` incl. TAM; all `contacts` incl. `deleted_at`) while the UI applies account/soft-delete filters. **Same question, two different answers — destroys trust in the assistant.** Chat tools MUST share the UI's definitions/filters (exclude soft-deleted; "accounts" vs "companies").
- **[P2] Internal tool name leaks into UI:** "runBasicReport" shown verbatim (and twice). Use friendly step labels ("Analyzing your data…") and de-dupe repeated calls.
- **[P2] Follow-up chips not matched to the answer:** "Draft an email to them" after a pure count is nonsensical ("them" = 2,287 companies?). Generate context-aware suggestions.
- **[GOOD] Answer brevity is right** (no over-formatting for a count); collapsible reasoning steps and follow-up chips are a strong pattern when relevant.

### CHAT (the headline) — first finding

- **[P0 env + P1 product] First chat query returned "Something went wrong. Please try again." after ~22s.** Server log root cause: `AI_APICallError: Cannot connect to API: unable to verify the first certificate` on BOTH `https://api.openai.com/v1/embeddings` and `https://api.anthropic.com/v1/messages` (model `claude-sonnet-4-6`). This machine's egress MITM-intercepts the LLM domains (TLS cert untrusted) — the Neon DB TLS works, so it's domain-specific interception (corporate proxy / AV). **Environmental, not core code.** But it exposed real product issues:
  - **[P1] Catastrophic failure latency:** the route retried 3× per call (≈9 attempts) and took **22.7 s** before surfacing an error. Fail fast (1 retry, short timeout) when the provider is unreachable.
  - **[P1] `POST /api/chat` returns HTTP 200 on total failure.** Monitoring/analytics can't detect failed chats; should be 5xx (or a structured error event).
  - **[P1] Generic, non-actionable error** ("Something went wrong. Please try again.") for what is an LLM-connectivity failure. At minimum distinguish provider-unreachable / rate-limited / timeout.
  - **[GOOD] Partial graceful degradation exists** for retrieval (knowledge semantic search "falling back to keyword") — but the main completion has no fallback.
  - **[CONTEXT] Prod is also currently broken** for chat (per audit notes: LLM key missing → 500). So in both tested environments the chat does not complete — different root causes (prod=missing key, local=TLS MITM). **Either way: the flagship feature does not work in any environment I can currently reach. Highest-priority thing to make demonstrably work before launch.**
  - Action for THIS audit: relaunching dev with TLS verification relaxed (dev-only) to exercise the chat's formatting.

### Global controls (Search, Notifications, sidebar)

- **[GOOD] Command palette (sidebar Search):** opens a focused "Search or jump to…" palette with a backdrop, fuzzy entity search ("Quant" → ACCOUNTS (2): ID Quantique + Quantis, with logos), grouped by type, and keyboard hints (↑↓ navigate · ↵ select · esc close). Strong, present essential. [P2-a11y] palette container isn't `role=dialog` (verify focus trap / screen-reader semantics). [NOTE] verify a keyboard shortcut (⌘K/Ctrl-K) opens it — expected by power users.
- **[P2] Notifications panel opens but is an empty void.** Clicking sidebar Notifications expands an inline panel with header "Notifications" and a **blank body — no items and no empty-state message** ("You're all caught up" / "No notifications yet"). Add empty-state copy; confirm real notifications populate it. Also it's an inline accordion in the sidebar (unusual placement) — confirm that's intended vs a dropdown/panel.

### Reports / Knowledge / Skills

- **Reports (`/reports`)** — [GOOD] 3 AI report types (Pipeline / Weekly / Win-Loss) with Generate + Schedule weekly and clear descriptions. Proper title. (Generate not triggered — LLM cost.)
- **Knowledge (`/knowledge`)** — [GOOD] master-detail, Workspace/Personal scopes, clean empty states. [P2] generic browser title.
- **Skills (`/skills`)** — List/Explore toggle, Create skill, scopes System/Workspace/Personal. [P2] **all scopes empty incl. SYSTEM (0)** — no built-in starter skills ships, so an "autonomous" product shows an empty Skills page on day one. Seed a few system skills (draft email, research account, score lead…) or hide the section until populated. [P2] generic title.

### Activity: Tasks / Insights

- **Tasks (`/tasks`)** — has data (4 tasks, filters All/Due today/Overdue/Completed, Priority sort, Add). [P2] **count mismatch**: 3 list items show "Nd overdue" (534d/141d/58d) but the Overdue badge says "(2)" and header "2 overdue". [P2] no native completion checkbox detected (verify how a task is marked done). [NOTE] "534d overdue" is stale seed data.
- **Insights (`/insights`)** — [P2] **thin + slow**: ~8s skeleton then only a Pipeline summary (Open Deals 0 / Total $0K / Weighted $0K / Win Rate —). Heavy load for 4 numbers. [P1-IA] sub-routes `/insights/pilae`, `/insights/hot-to-call`, `/insights/playbook` exist but are **not linked** from /insights or the sidebar → orphan pages (archipelago seams). Either surface them as tabs/links or remove. [P2] generic browser title.

### Activity: Meetings / Notes

- **Notes (`/notes`)** — **[P1] `GET /api/notes` returns 500**, masked by the "No notes yet" empty state. Root cause (from server log): malformed array query at `src/app/api/notes/route.ts:48` — `select id, name from companies where companies.id = ANY(($1, $2))` → Postgres `op ANY/ALL (array) requires array on right side`. The code passes tuple params instead of a single array param (use Drizzle `inArray(companies.id, ids)` / `= ANY($1::text[])`). Notes that reference companies will never load. The inline "Create note" composer (textarea "Write a note…") opens fine, but saving likely hits the same broken read on refetch. **Fix before launch; also surface API errors instead of showing a false-empty state.**
- **Meetings (`/meetings`)** — [GOOD] skeleton loaders, then a clear empty state: "Connect your calendar (Google/Microsoft) so Elevay can auto-join with a recording bot" + Upload transcript + Go to settings. Proper title.
- **[P2 / observability] Dev server log shows ~30 repeated "Error while requesting resource"** before the notes request — a background fetch (enrichment/logo/signal) is failing in a tight loop. Investigate; could be wasted API spend or a noisy failing dependency.

### Engage: Inbox / Call Mode / Deliverability / Campaigns

- **Inbox (`/inbox`)** — [GOOD] clean, filters All/Replied/Awaiting/Bounced, empty state "Send your first sequence to see emails here." No console errors. [P2] generic browser title.
- **Call Mode (`/call-mode`)** — [GOOD] now fully English (FR→EN migration verified, 0 French strings). 3-panel (queue/contact/account), empty queue state good. [P2] generic browser title.
- **Deliverability (`/deliverability`)** — [GOOD] complete dashboard (Sent/Open/Reply/Bounce/Spam, mailbox health "warming up", 0/50 daily cap, sequence enrollments). Proper title.
- **Campaigns (`/sequences`)** — [P2] **term drift**: sidebar + h1 say "Campaigns", URL is `/sequences`, browser title "Sequences | Elevay". Pick ONE noun across nav/url/title. [P1-polish] pluralization bugs: list shows "1 steps"; detail shows "SEQUENCE (1 STEP · **1 DAYS**)" — needs singular/plural handling.
- **Sequence detail (`/sequences/[id]`)** — [GOOD] functional: Steps/Analytics tabs, enrolled-contacts table with per-contact Pause/Stop, Export, merge tokens (`{{firstName}}`). h1 "Updated Sequence" is test data.

### Cross-cutting: inconsistent browser tab titles

Many pages fall back to the generic default title "Elevay — The Autonomous GTM Engine for Founders" instead of "<Page> | Elevay": confirmed missing on **account detail, account brain, proposals, inbox, call-mode**. Present on accounts/contacts/opportunities(as "Pipeline")/deliverability/sequences. Standardize `generateMetadata`/title per route (matters for tab management + SEO of any public pages).

### Accounts (`/accounts`)

Columns (16): Account, Website, LinkedIn, Industry, Geography, Size, Revenue, Stage, Score, Last interaction, Connected to, Common inv., Funded 6mo, CB funded, Hiring, YC. Filter chips: All / Prospects (50) / Manual. Lazy-loads "50 of 767 — scroll to load more". Real CH/FR data (UNAIDS, UEFA, Montreux Jazz, Hôpital intercantonal…).

- **[P0] "Delete all" button permanently in the primary toolbar** with title *"Delete every account in this workspace"*, sitting next to Signals / Enrich / Find more accounts / Create account. One mis-click wipes all 767 accounts. Reads like a leftover dev/test affordance. Remove it from the toolbar (or move to Settings → Data, behind a typed-confirmation). **Must not ship as-is.**
- **[P2] Two search inputs on one page** — "Smart search — e.g. SaaS in France with high fit score" (NL) and a plain "Search accounts…". Unclear which to use; consolidate or visually differentiate (one is AI, one is filter).
- **[P2] 16-column table** risks horizontal cramping/overflow at common widths; verify there's a column picker / horizontal scroll affordance, and that the most important columns are visible without scrolling.
- **[GOOD] Signal-rich columns** (Connected to, Common investors, Funded 6mo, Crunchbase funded, Hiring, YC) — strong differentiation for a GTM tool.
- **[GOOD] Lazy-load with explicit "Showing 50 of 767 — scroll to load more"** is clear.

### Proposals (`/proposals`)

v1 = upload .docx/.pptx template → Elevay maps components → per-prospect draft. Empty (no templates).

- **[GOOD] Clear feature framing + empty state** ("Upload a .docx proposal template to begin").
- **[P2] No page-specific browser tab title** (falls back to the generic "Elevay — The Autonomous GTM Engine for Founders").
- **[P2] "Upload template" is not a `<button>`/`<a>`** (no accessible control detected — likely a bare file-input label); confirm it's keyboard-focusable & labelled.

### Opportunities (`/opportunities`)

Kanban (Lead→Qualification→Demo→Trial→Proposal→Negotiation→Won/Lost) + Board/Table toggle; KPI strip (Pipeline/Won/Win-rate/Avg-deal/Velocity/At-risk); Forecast, Analytics, Analyze Pipeline, Filter, Stalled. Empty (0 deals).

- **[GOOD] Professional pipeline UI**; clean empty board with per-stage "Create opportunity"; no emoji (stage icons are SVGs — verified).
- **[P2] Term inconsistency:** sidebar + h1 say "Opportunities", browser tab title says "Pipeline". Standardize.
- **[NOTE] Populated board not testable** (0 deals) — seed deals to verify drag-between-stages, deal cards, forecast/analytics before launch.

### Contacts (`/contacts`)

Empty (0 active). Toolbar: Find duplicates · Smart Import · Import CSV · Create contact · Find contacts at top accounts.

- **[GOOD] Excellent empty state:** "No contacts yet — Get your first contacts in two clicks — import a CSV you already have, or let Apollo find decision-makers at your TAM accounts." with two CTAs (Import CSV / Find contacts at top accounts). Boils-the-lake on a dead-end page.
- **[NOTE] Re-check once contacts exist** (couldn't audit the populated table/columns/row drawer because the tenant has 0 active contacts; the 519 are soft-deleted). Worth seeding a few to verify the populated view before launch.

### Account detail (`/accounts/[id]`)

Strong page: breadcrumb (Accounts › ID Quantique), AI-intelligence block, Research Dossier (Recommended approach + opening line, ICP fit, Funding, Tech stack 23, Hiring signals with interpretation, Competitive landscape), right-rail Account details, "View brain" button, Contacts(0)/Opportunities(0)/Suggested contacts.

- **[P1] Invalid HTML: `<button>` nested inside `<button>` → React hydration error** (2 console errors every load, from `CompanyDossier`: the dossier section-header button contains a "Refresh dossier" icon button). Hydration mismatches can desync server/client UI and break click handling. Fix nesting (header = div with two sibling buttons).
- **[P1] "LLM not configured / unavailable" fallbacks despite keys being set.** "Automated ICP fit scoring unavailable (LLM not configured)" and "No competitive analysis available (LLM unavailable)" render even though ANTHROPIC/OPENAI keys are present locally — and the page still shows a contradictory **"ICP FIT 50%"** badge next to the "unavailable" text. Either wire these to the configured key or hide the section; don't show a fake score + "unavailable".
- **[P2] Browser tab title is generic "Accounts | Elevay"** on a specific account page; should be "ID Quantique | Elevay".
- **[NIT] Copy mismatch:** opening line says "…in the information technology & services space" while the Industry field reads "research".
- **[GOOD] Research dossier depth** (funding 76.3M / M&A, 23-item tech stack incl. Salesforce, hiring signal "Using Salesforce — may be looking for alternatives") is exactly the GTM intelligence that differentiates.
- **[GOOD] Honest AI empty state** ("Not enough data yet. Connect your email…").

### Account brain (`/accounts/[id]/brain`)

"Unified read of every artifact and derived signal." Counters: Contacts/Open deals/Recent activities/Meetings/Knowledge/Graph facts/Memories. Breadcrumb correct (Accounts › ID Quantique › Brain).

- **[P2] Score inconsistency across views:** Brain shows **SCORE 0.8**; the account detail right-rail shows **"Not scored"** for the same company; the table has its own SCORE column. Pick one source of truth and render it consistently.
- **[P2] Internal jargon leaks to users:** "Graph facts" and "Memories" are admin/system concepts (per the admin-only Context-Graph convention). Rename to user language or hide on this user-facing page.

### Home (`/home`)

- **[RESOLVED / not a bug] "Up next" → `/` is fine.** Verified: `/` redirects logged-in users to `/home` (the Up-next feed). Only shows marketing when logged out.
- **[P1 — CONFIRMED] Two onboarding systems coexist on this branch.** Home shows BOTH: (a) the new single-screen modal ("One screen. Confirm what I picked up") auto-opening over /home, AND (b) the old **seven-phase wizard** — the "Continue setup — 7 phases left" card links to `/onboarding-v3`, which is **live** (verified): "Configure your outbound engine — Seven phases… gated on data quality… you cannot finalise until the system has enough signal." (`/onboarding-v3` loads with no console errors.) This contradicts the "single light modal is the only onboarding" intent. Pick ONE and delete the other; the home card + modal currently send the user to two different flows.
- **[P1] "Getting ready…" loading dialog covers the whole main panel on fresh login** while the content (stats, priorities, insights) is already in the DOM behind it. Either the overlay should not block already-rendered content, or it should clear faster. (measuring persistence)
- **[RESOLVED / not a bug] Home "0 contacts" is correct.** DB has 519 contacts but all 519 carry `deleted_at` (518 soft-deleted 2026-06-05 in the Pilae cleanup). Active count = 0, so Home and /contacts agree. (Verified via DB, not assumed.)
- **[P2] Inconsistent enrichment counts.** "Your priorities today" says *Enrich 1202 companies*; Insights says *767 companies need enrichment* and *0 of 767 TAM companies have active deals*. Three different denominators (1202 / 767) on one screen — confusing.
- **[P2] Mixed language: French date strings in English chrome.** Header shows "sam. 6 juin" while everything else is English ("Good morning, Martin", "Your priorities today"). Convention is English chrome; dates should be `Sat, Jun 6`.
- **[NIT] Two `<h1>` on the page**: "Up next" (visually-hidden page title) and "Good morning, Martin". Should be one h1.
- **[GOOD] Chat-first**: persistent command/chat input pinned at the bottom of Home ("e.g. Show my best prospects, Pipeline health, Draft email to…").
- **[GOOD] Empty-state copy on the Up-next feed** is human and directive ("Connect your email and build your TAM to get started").

### Onboarding (single-screen modal over `/home`)

Structure is strong: "Here's what I picked up about you" (name, company, website, what-you-sell, email tone) with provenance chips ("AI · elevay.dev", "AI · your email"); "Who you're going after" (industries, keywords, sizes, revenue, technologies, geos, exclude-geos, buying signals: recently-funded/funding/job-postings/hiring-titles, people: seniorities/departments) with a live TAM count; "Your sending protections" (approval mode, LLM budget, sending mode + link to guardrails); CTA "Looks right — build my pipeline".

- **[P0] Onboarding modal shows for an ALREADY-established tenant** (767 accounts, existing deals/tasks). Returning founder accounts should not be forced back through onboarding. The completion flag is not honored (or "what you sell"/ICP being empty re-triggers it every session). First thing the founder sees on login = a setup wizard over their populated home.
- **[P0] Two onboarding systems coexist.** This single-screen modal (new/consolidated) renders ON TOP of the old HomeSetupCard ("7 phases left" → `/onboarding-v3`) which the docs say was removed 2026-06-05. One of them is a regression. Decide which is canonical and delete the other.
- **[P1] The "modal" is not a real modal.** `role="dialog"` but: Escape does NOT close it, no backdrop/scrim, body scroll not locked, no focus trap, and no visible close/skip/"do this later" control. Only exits are completing it ("build my pipeline") or clicking a sidebar link. A dialog with no dismiss affordance is a trap pattern.
- **[P2] Onboarding card is not horizontally centered** at 1440px — pushed right-of-center with a large empty left gutter (looks like an unintended right-aligned max-width container).
- **[P1] "Looks right — build my pipeline" is the only CTA and it's irreversible-ish** (kicks off TAM/enrichment). No "save & continue later" / no lighter commit. (not clicked — avoids triggering paid Apollo enrichment during audit)
- **[GOOD] Provenance chips** ("AI inferred this from elevay.dev / your email") are exactly the right "infer over asking" pattern.
- **[GOOD] Industries autocomplete works** ("Soft" → "Computer Software") and the **live TAM count computes** ("≈ 100,000+ companies match your criteria" after one filter).
- **[P1] React runtime error on ICP edit:** selecting an industry logs `Cannot update a component while rendering a different component … OnboardingConfirmationCard` (setState-in-render). Real bug in the new onboarding (`OnboardingV2Wrapper`/`OnboardingConfirmationCard`); can cause double-renders / subtle state corruption in prod.
- **[NIT] "≈ 100,000+ companies"** from a single broad industry isn't actionable — consider hiding the estimate until criteria are narrow enough to be meaningful, or guiding the user to narrow.
