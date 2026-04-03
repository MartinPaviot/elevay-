# ONBOARDING-V2: Design

## Architecture: Value-First Onboarding

**Core principle**: Every step either produces visible output or unlocks a clear capability. The user should see their TAM building before they finish onboarding. No empty dashboards.

**Total steps**: 6 (vs Lightfield's 8)
**Estimated time**: 3-4 minutes (fast path with skip), 5-6 minutes (complete path)
**No credit card required** — free trial without payment gate

---

## Intelligence Loop: How Every Data Point Drives the Product

This is the core of the design. Every piece of data we collect must produce **visible, immediate intelligence**. If we can't explain how a field changes the user's experience, we don't ask for it.

### Input → Intelligence Map

| What We Collect | Where It Shows Up | How It Changes the Experience |
|----------------|-------------------|------------------------------|
| **"What do you sell"** (free text) | Email drafts, chat responses, account scoring, deal coaching | AI writes "Saw that Stripe is expanding their payments API — our embedded compliance solution could help" instead of generic "Hope you're doing well." Every email, every score, every coaching tip references the user's actual product. |
| **ICP (industry + size + role + geo)** | TAM builder, account scoring, lead prioritization, dashboard sorting | Accounts matching ICP get higher scores. Dashboard shows "87% ICP fit" badges. When a new contact is discovered via email, the system flags "This company matches your ICP" vs "Outside your target." |
| **Sales motion** (founder-led / SDR team / PLG) | Coaching style, suggested actions, dashboard widgets, sequence templates | Founder-led → coaching says "You should handle this yourself — prep notes attached." SDR team → coaching says "Assign to your strongest closer." PLG → coaching says "This user hit 3 activation milestones, time for a personal touch." |
| **Biggest challenge** (finding / responding / closing / expanding) | Dashboard priority, suggested actions, AI proactive alerts | "Finding leads" → dashboard leads with TAM and new prospects. "Getting responses" → dashboard leads with sequence performance and A/B test suggestions. "Closing" → dashboard leads with deal velocity and stall alerts. |
| **AI tone** (formal / direct / casual) | Every AI-drafted email, chat responses, suggested messages | Formal: "I hope this message finds you well. I wanted to reach out regarding..." Direct: "Quick question — are you evaluating payment APIs this quarter?" Casual: "Hey! Saw your team just raised a Series A — congrats!" |
| **Role** (founder / sales / marketing) | Coaching depth, feature emphasis, notification priorities | Founder → strategic coaching ("Your pipeline is 40% concentrated in fintech — diversification risk"). Sales → tactical coaching ("Follow up with Sarah at Plaid — she opened your email 3 times"). |
| **Company name** | Email signatures, workspace branding, outbound "from" context | AI knows to say "the team at Elevay" not "the team at your company." Sequences reference "Elevay's [product]" naturally. |
| **Connected email** | Customer memory, contact discovery, conversation history, relationship mapping | Every email becomes searchable context. "What did we discuss with Stripe last month?" returns actual conversation summaries with citations. Meeting prep includes "Last 3 interactions with this person." |
| **Sending mailbox** | Outbound sequences, deliverability monitoring, reply tracking | Sequences send from the right mailbox. Deliverability dashboard monitors that specific domain. Replies thread correctly. |
| **Target roles** | Contact prioritization, enrichment focus, email personalization | When we find "Stripe" in TAM, we surface the VP Engineering first (not the HR manager). Emails reference the prospect's specific role challenges. |

### Intelligence Feedback Loops (post-onboarding, powered by onboarding data)

These are the behaviors that make onboarding data compound over time:

1. **ICP Refinement Loop**: As deals close/lose, AI compares won accounts vs ICP definition. "You defined SaaS 51-200 as ICP, but your 3 closed deals are all fintech 201-1000. Want to update your ICP?"

2. **Tone Calibration Loop**: AI tracks reply rates per tone variant. "Direct tone gets 2.3x more replies than formal for your audience. Updating default."

3. **Challenge Evolution Loop**: As the user's pipeline grows, their challenge shifts. AI detects: "You've solved 'finding leads' (312 prospects queued). Your new bottleneck is 'getting responses' (8% reply rate). Shifting dashboard focus."

4. **Product Description Evolution Loop**: As the user's product evolves, AI notices new keywords in sent emails. "You've started mentioning 'compliance' in 60% of recent emails. Should I update your product context?"

5. **Sales Motion Detection**: If a founder starts inviting team members and assigning deals, AI suggests: "Looks like you're moving from founder-led to a small sales team. Want me to adjust coaching to include delegation advice?"

---

## Flow Overview

```
Step 1: Welcome      → Name, role, company name (15 sec)
Step 2: Your Product  → What you sell, sales motion, tone, challenge (45 sec)
Step 3: Your Customer → ICP definition via guided form (60 sec)
Step 4: Connect       → Gmail/Outlook OAuth + sending mailbox (30 sec)
Step 5: Your TAM      → Live TAM building animation + first results (30 sec wait)
Step 6: Ready         → Dashboard with data, first suggested action (done)
```

**Progress indicator**: Horizontal progress bar (not dots — shows continuous progress, not discrete steps). Shows step label: "1/6 · Your profile"

---

## Step 1: Welcome (Identity)

**URL**: `/onboarding/welcome`
**Headline**: "Let's set up your GTM engine"
**Subheadline**: "Takes about 3 minutes. No credit card needed."

### Fields

| Field | Type | Placeholder | Required | Default | Validation |
|-------|------|-------------|----------|---------|------------|
| Full name | text | "Your full name" | Yes | - | Non-empty |
| Company name | text | "Your company" | Yes | Inferred from email domain if available | Non-empty |
| Your role | single-select pills | - | Yes | Auto-select "Founder" if email domain is custom | - |

### Role options (horizontal pills, not dropdown — faster than Lightfield's dropdown)
- Founder
- Sales / Growth
- Marketing
- RevOps
- Other

### Buttons
- "Continue →" (primary, gradient-brand)

### Design notes
- Single card, centered, same auth-page styling as sign-in/sign-up
- Company name auto-filled from email domain (like Lightfield does with website)
- If user signed up via Google OAuth, name is pre-filled from Google profile

---

## Step 2: Your Product (Context)

**URL**: `/onboarding/product`
**Headline**: "Tell us about what you sell"
**Subheadline**: "This helps our AI write relevant emails and give useful coaching."

### Fields

| Field | Type | Placeholder | Required | Validation |
|-------|------|-------------|----------|------------|
| What do you sell? | textarea (2 lines) | "e.g., API platform for fintech companies to embed payments" | Yes | Non-empty, min 10 chars |
| Sales motion | single-select pills | - | Yes | - |
| AI tone for emails | single-select pills | - | Yes (default: Direct) | - |
| Biggest challenge right now | single-select pills | - | Yes | - |

### Sales motion options (pills)
- Founder-led sales
- Small sales team (2-10)
- SDR/AE split
- Product-led (PLG)

### AI tone options (pills)
- Formal
- Direct *(default, pre-selected)*
- Casual

### Challenge options (pills)
- Finding the right leads
- Getting responses
- Closing deals
- Expanding accounts

### Optional section (collapsed by default, "More options" link)
| Field | Type | Placeholder | Required |
|-------|------|-------------|----------|
| Current tools | multi-select pills | - | No |

### Current tools options
- HubSpot
- Salesforce
- Apollo
- Outreach/Salesloft
- Spreadsheet
- Nothing yet

### Buttons
- "← Back" (text link, secondary)
- "Continue →" (primary)

### Design notes
- The textarea is the hero — it's the most important input in the entire onboarding
- Show a subtle example that fades out when they start typing
- Pills are faster than dropdowns for <6 options (learned from Lightfield's dropdown being slower)

---

## Step 3: Connect Your Email (The Essential Step)

**URL**: `/onboarding/connect`
**Headline**: "Connect your email to unlock LeadSens"
**Subheadline**: "This is how LeadSens learns who your customers are, what you've discussed, and who needs follow-up."

### Why email is Step 3 (not Step 4)

Email is the most important input. It's not a "nice to have" — it IS the product. Without email:
- No customer memory (can't answer "what did we discuss with X?")
- No auto-created contacts/accounts (CRM stays empty)
- No conversation-aware outbound (emails are generic, not personalized to history)
- No meeting prep (no context about attendees)
- No follow-up detection (doesn't know who's gone cold)

We move it BEFORE ICP definition because:
1. Email sync starts a background job that takes minutes → start early, ready by Step 5
2. The contacts discovered from email will be CROSS-REFERENCED with TAM in Step 5
3. It demonstrates immediate value: "We found 47 contacts from your inbox"

### Layout

#### Hero section: What you'll get
Three value bullets with icons (shown ABOVE the connect buttons):
- "**Customer memory** — every conversation, searchable and cited"
- "**Auto-built CRM** — contacts and accounts created from your emails"
- "**Smart outbound** — AI references your actual history when writing to prospects"

#### Connect buttons
- "Continue with Google" (Google OAuth — primary, larger)
- "Continue with Microsoft" (Microsoft OAuth)
- Both should show the permission scope: "Read-only email + calendar access"

#### After connecting (inline, same page — don't navigate away)
The page transforms to show:
- Animated sync indicator: "Syncing your last 3 months... 142 emails processed"
- Counter ticking up in real-time
- First discoveries appearing live:
  ```
  Found: sarah@stripe.com (12 conversations)
  Found: mike@plaid.com (8 conversations)
  Found: team@ramp.com (3 conversations)
  ```
- Toggle: "Also use this email for sending outbound" (default: ON)

#### Advanced (collapsed)
| Setting | Type | Default |
|---------|------|---------|
| Backsync range | dropdown | 3 months |
| Do not track | text | "Domains to exclude..." |

### Buttons
- "← Back"
- "Skip for now" (small, de-emphasized — this is the ONLY skippable step, and we show a warning: "Without email, LeadSens can't build your customer memory or personalize outbound.")
- "Continue →" (primary, appears after connecting. If sync is running, text says "Continue — sync runs in background")

### Design notes
- **DO NOT gate progress on sync completion.** Start the sync, show the first few results, let them continue. Sync runs in background.
- The live discovery feed is the first "wow" — "it's already finding my contacts!" within seconds
- We DON'T show 4 config sections before connecting like Lightfield. Smart defaults + one collapsed "Advanced" section. Reduce anxiety, increase connection rate.

---

## Step 4: Your Customer (ICP Definition)

**URL**: `/onboarding/icp`
**Headline**: "Who is your ideal customer?"
**Subheadline**: "We'll find companies that match — and flag which ones you're already talking to."

Note the subheadline change: "flag which ones you're already talking to" — this signals the email + TAM cross-reference.

### Fields

| Field | Type | Placeholder | Required | Options |
|-------|------|-------------|----------|---------|
| Target industries | multi-select pills (max 5) | - | Yes (min 1) | SaaS / Software, Fintech, Healthcare, E-commerce, Manufacturing, Professional Services, Education, Real Estate, Logistics, Media, Other |
| Company size | multi-select pills | - | Yes (min 1) | 1-10, 11-50, 51-200, 201-1000, 1000+ |
| Target role/title | text with suggestions | "e.g., VP Engineering, CTO, Head of Product" | Yes | Auto-suggest from common titles |
| Geography | multi-select pills | - | Yes (min 1) | North America, Europe, UK, APAC, LATAM, Global |

### Contextual intelligence (if email was connected in Step 3)
Show a hint at the top of this step:
> "We've already found **47 contacts** from your email. We'll cross-reference them with your ICP."

### Buttons
- "← Back"
- "Build my prospect list →" (primary — action-oriented CTA)

### Design notes
- The CTA "Build my prospect list" signals that something will HAPPEN with this data
- Show a small counter: "We'll search X,XXX,XXX+ companies" (updates dynamically)
- Target role field has autocomplete from common B2B titles

---

## Step 5: Intelligence Building (The Magic Moment)

**URL**: `/onboarding/building`
**Headline**: "LeadSens is learning your world..."

### Layout: Dual-track animated progress view

This is a **passive step** — the user watches TWO things happening simultaneously.

#### Track 1: TAM Discovery (left or top)
```
Finding prospects matching your ICP...

✓ Stripe — Fintech, 8,000 employees, San Francisco        92% fit
✓ Plaid — Fintech, 1,200 employees, San Francisco         88% fit
✓ Ramp — Fintech, 800 employees, New York                 85% fit
... finding more ...

Found 127 companies · 312 contacts
```

#### Track 2: Email Intelligence (right or bottom — only if email connected)
```
Building your customer memory...

✓ 47 contacts discovered from 3 months of email
✓ 12 active conversations identified
✓ 3 follow-ups overdue (last contact > 7 days ago)
✓ 8 companies matched to your ICP                    ← THE CROSS-REFERENCE
```

#### The Cross-Reference Moment (the real wow)
When both tracks complete, show a merged insight card:

> **8 of your ICP prospects are already in your inbox.**
> You've exchanged 34 emails with them. 3 haven't heard from you in over a week.
>
> Sarah Chen at Stripe — last email 12 days ago (she asked about pricing)
> Mike Torres at Plaid — last email 3 days ago (intro meeting scheduled)
> ...

This is the moment where cold TAM data + warm email data merge into **actionable intelligence**. No competitor does this in onboarding.

#### When done
- Summary card with 3 numbers:
  - **127** new prospects found
  - **47** existing contacts imported
  - **8** ICP matches already in your inbox
- CTA: "Go to your dashboard →"

### Buttons
- "Go to your dashboard →" (primary, appears when building completes)

### Design notes
- **Minimum display time: 10 seconds** even if data is ready faster. The animation builds anticipation and demonstrates work being done.
- If email was NOT connected, only show Track 1. But add a subtle nudge: "Connect your email to see which prospects you're already talking to."
- The cross-reference card is the **single most important moment in the entire onboarding**. It proves that LeadSens isn't just another CRM or another prospecting tool — it's the place where your existing relationships and new opportunities converge.
- If no ICP matches are found in email (new founder, no sales history), show: "No existing conversations with ICP matches yet — that's why we're here. Let's start your first outreach."

---

## Step 6: Ready (First-Run Dashboard)

**URL**: `/` (main dashboard)
**No separate "all set" page** — we land directly in the product WITH data AND with intelligence.

### What the user sees on their dashboard

#### The dashboard is organized by intelligence, not by record type:

**Section 1: "Act now" (top priority)**
- If email connected + overdue follow-ups found: "**3 conversations need follow-up**" with names, last contact date, and AI-drafted follow-up messages
- If ICP matches in inbox: "**8 warm prospects match your ICP** — they already know you"
- Each item has a one-click action: "Send follow-up" / "Start sequence" / "View history"

**Section 2: "New prospects" (TAM results)**
- Top 10 highest-scored accounts from TAM build
- Each shows: company name, logo, ICP fit score, key signal (e.g., "Just raised Series B")
- CTA: "Draft outreach to top 10"

**Section 3: "Your network" (email-discovered)**
- Contacts auto-created from email, grouped by company
- Shows: name, company, last interaction date, conversation count
- Warm contacts (>3 conversations) highlighted

**Section 4: Chat (contextual first message)**
- If both email + TAM: "I found 127 prospects matching your ICP, and you're already talking to 8 of them. Want me to draft follow-ups for the 3 that have gone quiet?"
- If TAM only: "I found 127 companies matching your ICP. Want me to draft outreach to your top 10?"
- If email only: "I'm learning your customer relationships. Ask me anything — 'who should I follow up with?' or 'summarize my conversations with Stripe.'"
- If neither: "Let's get started. Connect your email so I can learn your business, or define your ICP so I can find prospects."

### Design notes
- **Act Now > New Prospects > Your Network** — the hierarchy prioritizes warm over cold, action over browsing
- The dashboard is NOT a static display — it's an intelligence briefing. Like Monaco's daily dashboard but personalized from day 1.
- Every item has a one-click action. No "view details then figure out what to do." The AI already figured it out.
- If email sync is still running when user arrives, show a progress bar: "Building customer memory... 67% complete. Some insights are already available."
- The chat first message is the **most critical copy in the product**. It must reference what was just built and suggest the single most valuable next action.

---

## Comparison: LeadSens vs Lightfield Onboarding

| Dimension | Lightfield | LeadSens |
|-----------|-----------|----------|
| Steps | 8 | 6 |
| Credit card | Required (Stripe checkout) | Not required |
| Time to product | 3-4 min | 3-4 min |
| First-run state | Empty dashboard | Populated with TAM + suggestions |
| ICP collection | None | Yes (Step 3) |
| Outbound config | None | Tone, sending mailbox, challenge |
| Back navigation | No | Yes (every step) |
| Skip options | 3 steps | 1 step (email connect) |
| Email config | 4 sub-settings before connecting | Smart defaults, 1 toggle |
| Value payoff | Delayed until email syncs (hours) | Dual: TAM instant + email cross-ref in minutes |
| Cross-referencing | None — email and CRM are separate silos | TAM prospects × email history = warm leads surfaced |
| Customer memory | Best-in-class after sync | Must match — searchable conversations with citations |
| Booking a call | Mandatory step (skippable) | Not in onboarding (offer via chat later) |
| HDYHAU | Yes (onboarding step) | No (track via UTM) |

---

## Data Flow

```
Step 1 (Welcome) → Creates user + workspace in DB
Step 2 (Product) → Saves to workspace settings: product_description, sales_motion, ai_tone, challenge
Step 3 (Connect) → OAuth flow → saves tokens → triggers email backfill job (STARTS EARLY)
Step 4 (ICP)     → Saves ICP settings → triggers async TAM build job (Apollo API)
Step 5 (Build)   → Polls BOTH jobs → displays dual-track progress → runs CROSS-REFERENCE
Step 6 (Ready)   → Intelligence-first dashboard with merged warm + cold data
```

### Background jobs triggered during onboarding:
1. **Email backfill** (after Step 3): Sync last 3 months of email → create/update Contact + Account records → build conversation memory embeddings → extract relationship signals (frequency, recency, sentiment)
2. **TAM build** (after Step 4): Apollo People Search with ICP filters → create Account + Contact records → AI-score each account
3. **Cross-reference** (after both jobs have partial results): Match TAM accounts against email-discovered accounts → flag warm ICP matches → rank by relationship strength + ICP fit
4. **Account enrichment** (after TAM build): For each discovered account, enrich with Apollo Org data (industry, size, funding, tech stack)
5. **Follow-up detection** (after email backfill): Identify conversations with >7 day gap where the prospect was last to respond → flag as "needs follow-up"

### Data intelligence pipeline (what makes this work like Lightfield)

The key insight from Lightfield is that email isn't just a data SOURCE — it's the foundation of customer MEMORY. Every email thread becomes:

1. **A searchable conversation** — user can ask "what did we discuss with Stripe?" and get cited answers
2. **Auto-created records** — contact + account records created from email domains, not manual entry
3. **Relationship metadata** — conversation count, last interaction, who initiated, sentiment trend
4. **AI context for everything** — when drafting outbound, the AI references actual history: "Following up on our conversation about your payment API migration"
5. **Follow-up intelligence** — "Sarah asked about pricing 12 days ago and you never responded"

This is NOT just "import contacts from Gmail." This is building a MEMORY LAYER that powers every AI action in the product. The quality of this pipeline determines whether LeadSens feels intelligent or generic.

Additional data sources beyond email (what Lightfield also ingests):
- **Calendar events** → meeting records with attendees, auto-matched to contacts
- **Meeting transcripts** (future: Recall.ai) → conversation summaries, action items, deal signals
- **File uploads** → PDFs, decks shared in chat for additional context
- **Manual notes** → user-added context that enriches the memory
- **Web enrichment** → company data, news, job postings, funding rounds

All of these feed into the same memory layer. The richer the input, the smarter every AI action becomes.

---

## Technical Implementation Notes

### New DB fields needed (workspace_settings or onboarding table)
- `product_description` TEXT
- `sales_motion` ENUM ('founder-led', 'small-team', 'sdr-ae', 'plg')
- `ai_tone` ENUM ('formal', 'direct', 'casual')
- `primary_challenge` ENUM ('finding-leads', 'getting-responses', 'closing', 'expanding')
- `target_industries` TEXT[] (array)
- `target_company_sizes` TEXT[] (array)
- `target_roles` TEXT[] (array)
- `target_geographies` TEXT[] (array)
- `sending_email` TEXT (nullable, defaults to connected email)
- `current_tools` TEXT[] (nullable)
- `onboarding_completed_at` TIMESTAMP

### New pages/routes
- `/onboarding/welcome`
- `/onboarding/product`
- `/onboarding/icp`
- `/onboarding/connect`
- `/onboarding/tam`
- Redirect logic: if `onboarding_completed_at` is null → redirect to appropriate step

### API endpoints needed
- `POST /api/onboarding/profile` — saves Step 1
- `POST /api/onboarding/product` — saves Step 2
- `POST /api/onboarding/icp` — saves Step 3 + triggers TAM build
- `POST /api/onboarding/connect` — handles OAuth callback
- `GET /api/onboarding/tam-progress` — polls TAM build status
- `POST /api/onboarding/complete` — marks onboarding done
