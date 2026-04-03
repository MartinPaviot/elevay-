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

## Step 3: Your Customer (ICP Definition)

**URL**: `/onboarding/icp`
**Headline**: "Who is your ideal customer?"
**Subheadline**: "We'll use this to find real companies that match your ICP."

### Fields

| Field | Type | Placeholder | Required | Options |
|-------|------|-------------|----------|---------|
| Target industries | multi-select pills (max 5) | - | Yes (min 1) | SaaS / Software, Fintech, Healthcare, E-commerce, Manufacturing, Professional Services, Education, Real Estate, Logistics, Media, Other |
| Company size | multi-select pills | - | Yes (min 1) | 1-10, 11-50, 51-200, 201-1000, 1000+ |
| Target role/title | text with suggestions | "e.g., VP Engineering, CTO, Head of Product" | Yes | Auto-suggest from common titles |
| Geography | multi-select pills | - | Yes (min 1) | North America, Europe, UK, APAC, LATAM, Global |

### Buttons
- "← Back"
- "Find my prospects →" (primary — action-oriented CTA, not just "Continue")

### Design notes
- This is the step that differentiates us from Lightfield. They never ask for ICP because they don't do prospecting.
- The CTA "Find my prospects" signals that something will HAPPEN with this data
- Show a small counter: "We'll search X,XXX,XXX+ companies" (updates dynamically as they select filters)
- Target role field has autocomplete from a predefined list of common B2B titles

---

## Step 4: Connect (Email + Calendar)

**URL**: `/onboarding/connect`
**Headline**: "Connect your email"
**Subheadline**: "We'll sync your conversations to build complete customer context — and use it for outbound."

### Layout: Two sections

#### Section A: Sync inbox (read-only access)
- "Continue with Google" button (Google OAuth)
- "Continue with Microsoft" button (Microsoft OAuth)
- Helper text: "We read your emails to build customer memory. We never send emails from this connection."

#### Section B: Sending mailbox (only shown after connecting inbox)
- Toggle: "Use this email for sending outbound too" (default: ON)
- If OFF: text field "Sending email address" with placeholder "outbound@yourcompany.com"
- Helper text: "This is the mailbox LeadSens uses to send sequences."

#### Sync configuration (collapsed "Advanced" section — not prominent like Lightfield)
| Setting | Type | Default |
|---------|------|---------|
| Backsync range | dropdown | 3 months |
| Auto-create contacts from emails | toggle | ON |

### Buttons
- "← Back"
- "Skip for now" (secondary text link)
- "Continue →" (primary, shown after connecting OR clicking skip)

### Design notes
- Simpler than Lightfield's Step 5. They have 4 configuration sections before connecting. We hide advanced config and use smart defaults.
- Backsync default is 3 months (Lightfield defaults to 1 month — we go deeper for more context)
- We explain WHY we need email: "build customer memory" + "use for outbound"
- The sending mailbox question is LeadSens-specific — Lightfield doesn't ask this because they don't send

---

## Step 5: Your TAM (Live Building)

**URL**: `/onboarding/tam`
**Headline**: "Building your prospect list..."
**Subheadline**: "Finding companies that match your ICP."

### Layout: Animated progress view

This is a **passive step** — the user watches while we work. No form fields.

#### Animation
- Show a card-based feed of companies being "discovered":
  ```
  ✓ Stripe — Fintech, 8,000 employees, San Francisco
  ✓ Plaid — Fintech, 1,200 employees, San Francisco  
  ✓ Ramp — Fintech, 800 employees, New York
  ... finding more ...
  ```
- Progress bar: "Found 47 companies matching your ICP"
- Counter animates up as results come in
- Show the ICP summary at the top: "SaaS + Fintech · 51-200 employees · VP Engineering · North America"

#### When done (or after 15 seconds minimum)
- Show summary: "Found **127 companies** and **312 contacts** matching your ICP"
- Preview 5-6 top companies with logos + basic info
- CTA changes to "Go to your dashboard →"

### Buttons
- "Go to your dashboard →" (primary, appears when TAM building completes)

### Design notes
- This is the **magic moment**. The user gave us 3 minutes of input and now sees 100+ real companies with real contacts. This is what Monaco does (Day 1 TAM) but self-serve instead of demo-gated.
- The animation creates anticipation and makes the AI feel alive
- If TAM building takes >30 seconds, show an interstitial with tips:
  - "While we search, here's what LeadSens will do for you:"
  - "Auto-score every account based on fit signals"
  - "Draft personalized outreach for your top prospects"
  - "Track every email, meeting, and interaction automatically"
- If email was connected in Step 4, show BOTH: TAM results + "Syncing 3 months of email..." progress

---

## Step 6: Ready (First-Run Dashboard)

**URL**: `/` (main dashboard)
**No separate "all set" page** — we land directly in the product WITH data.

### What the user sees on their dashboard

#### If TAM was built (Steps 3+5 completed):
- **Top accounts** section: 5-10 highest-scored accounts from TAM
- **Suggested action card**: "Draft your first outreach sequence → Your top 10 prospects are ready"
- **Pipeline view**: Pre-seeded with the "Prospecting" stage
- **Chat**: Pre-populated with "I found 127 companies matching your ICP. Want me to draft outreach to your top 10?"

#### If email was connected (Step 4 completed):
- **Recent contacts**: Auto-discovered contacts from email sync (may still be loading)
- **Meetings**: Upcoming meetings from calendar
- **Chat**: "I'm syncing your last 3 months of email. I'll have your customer memory ready in about 15 minutes."

#### If both:
- Full experience — TAM + conversations + suggested actions

#### If neither (all skipped):
- Empty state with a prominent "Get started" card:
  - "Connect your email to build customer memory"
  - "Define your ICP to build your prospect list"
  - "Or just chat with me to get started"

### Design notes
- **NO separate "You're all set" page** — this is where Lightfield fails. Their "all set" page is a dead-end with help links. We go straight to a populated dashboard.
- The chat is the hero. It should have a contextual first message based on what was set up.
- If TAM is still building when they arrive, show real-time updates in the dashboard

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
| Value payoff | Delayed until email syncs (hours) | Immediate TAM results (seconds) |
| Booking a call | Mandatory step (skippable) | Not in onboarding (offer via chat later) |
| HDYHAU | Yes (onboarding step) | No (track via UTM) |

---

## Data Flow

```
Step 1 (Welcome) → Creates user + workspace in DB
Step 2 (Product) → Saves to workspace settings: product_description, sales_motion, ai_tone, challenge
Step 3 (ICP)     → Saves to workspace settings: target_industries, company_sizes, target_roles, geographies
                 → Triggers async TAM build job (Apollo API)
Step 4 (Connect) → OAuth flow → saves tokens → triggers email backfill job
Step 5 (TAM)     → Polls TAM build job progress → displays results in real-time
Step 6 (Ready)   → Dashboard with populated data
```

### Background jobs triggered during onboarding:
1. **TAM build** (after Step 3): Apollo People Search with ICP filters → create Account + Contact records → AI-score each account
2. **Email backfill** (after Step 4): Sync last 3 months of email → create/update Contact records → build customer memory embeddings
3. **Account enrichment** (after TAM build): For each discovered account, enrich with Apollo Org data (industry, size, funding, tech stack)

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
