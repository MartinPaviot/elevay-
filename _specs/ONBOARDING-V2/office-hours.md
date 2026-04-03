# ONBOARDING-V2: Office Hours

## Problem Statement

LeadSens needs an onboarding flow that collects enough context to immediately deliver value (auto-built TAM, AI-personalized outbound, deal coaching) while keeping friction lower than Lightfield's 8-step wizard. Unlike Lightfield (CRM-only), LeadSens is a CRM + outbound engine — we need extra data for prospecting, sequences, and coaching that Lightfield doesn't collect.

## Premise Challenge

**Assumption**: More onboarding steps = more friction = more dropoff.
**Challenge**: The opposite may be true IF each step visibly produces value. Lightfield's problem isn't 8 steps — it's that 8 steps lead to an empty dashboard. If our onboarding ends with a populated TAM and a drafted first sequence, more steps are justified.

**Assumption**: We should copy Lightfield's flow and add outbound fields.
**Challenge**: Lightfield's flow is designed for a conversation-first CRM. Our architecture is hybrid (enrichment + conversations). We need to collect ICP data that Lightfield doesn't need because they don't do prospecting.

## Alternatives Explored

### Alt 1: Lightfield clone + extra fields
Copy their 8 steps, add ICP/outbound fields at the end.
- Pro: Proven flow, fast to build
- Con: Same empty-dashboard problem. Extra fields without visible payoff.
- Completeness: 5/10

### Alt 2: Progressive disclosure (minimal upfront, ask later)
Collect only email + name + workspace. Ask everything else in-product via chat prompts.
- Pro: Fastest time to product. Zero friction.
- Con: Product is empty and dumb until user teaches it. No TAM, no sequences, no coaching.
- Completeness: 4/10

### Alt 3: Value-first onboarding (chosen)
Collect the minimum needed to deliver immediate value, then SHOW the value before asking for more. Structure: identity → context → connection → payoff.
- Pro: Every step either produces visible output or unlocks a capability. The user sees their TAM building before they finish onboarding.
- Con: More complex to build (async TAM building during onboarding)
- Completeness: 9/10

## Layer Check

- **Layer 1 (tried and true)**: OAuth flows (Google/Microsoft), magic link auth, Stripe checkout — all standard.
- **Layer 2 (new and popular)**: Progressive onboarding with async background processing (Notion, Linear do this well). Multi-step wizards with progress dots (industry standard).
- **Layer 3 (first principles)**: Value-first ordering — show the TAM building in real-time during onboarding. No competitor does this. This is our differentiator.

## Completeness Target: 9/10

---

## Data Map: What We Need and WHY

### FROM LIGHTFIELD (replicate)

| Data | Where Asked | Required | What We Do With It |
|------|-------------|----------|--------------------|
| **User name** | Step 1 (Profile) | Yes | Display name, email signatures, AI personalization |
| **Role** | Step 1 (Profile) | Yes | Adapts coaching style — founder gets strategic advice, SDR gets tactical |
| **Company name** | Step 2 (Workspace) | Yes | Workspace branding, email domain detection, tenant setup |
| **Email connection** (Gmail/Outlook OAuth) | Step 4 (Connect) | Strongly encouraged | Auto-capture every customer interaction, backfill history, customer memory |
| **Calendar connection** | Step 4 (Connect) | Optional (bundled with email) | Meeting detection, prep briefs, transcript processing |
| **Team size** | Step 5 (ICP) | Yes | Adapts UI complexity — solo founder gets streamlined view, team gets collaboration features |
| **Company website** | Auto-detected from email domain | Auto | Enrichment seed, company context for AI |

### LEADSENS-SPECIFIC (new — needed for outbound + coaching)

| Data | Where Asked | Required | What We Do With It |
|------|-------------|----------|--------------------|
| **What do you sell?** (one sentence) | Step 3 (Context) | Yes | AI uses this to write relevant emails, score accounts, give coaching. Without it, AI is generic. |
| **Who is your ideal customer?** (ICP: industry, company size, role, geography) | Step 5 (ICP) | Yes | TAM builder uses this to find real companies via Apollo. This is the seed for Day 1 value. |
| **Sales motion** | Step 3 (Context) | Yes | Founder-led → coaching focuses on closing. SDR team → coaching focuses on volume. PLG → coaching focuses on activation. |
| **Biggest sales challenge** | Step 3 (Context) | Yes | Personalizes dashboard: "finding leads" → emphasizes TAM. "Converting" → emphasizes sequences. "Closing" → emphasizes deal coaching. |
| **Sending email** | Step 4 (Connect) | Optional | Which mailbox to use for outbound (may be different from synced inbox). If not set, uses connected Gmail/Outlook. |
| **AI tone preference** | Step 3 (Context) | Yes (with smart default) | Configures email writer: formal/casual/direct. Default: "direct" for founders. |

### OPTIONAL BUT VALUABLE (ask only if zero-friction)

| Data | Where Asked | Required | What We Do With It |
|------|-------------|----------|--------------------|
| **Current tools** | Step 3 (Context) | Optional | If HubSpot/Salesforce → offer migration. If "nothing" → emphasize zero-config. If Apollo → explain we include it. |
| **Average deal size** | Not asked during onboarding | No | Can be inferred from first few deals. Asking upfront adds friction for uncertain data. |
| **Sales cycle length** | Not asked during onboarding | No | Inferred from deal velocity once data exists. |

---

## What NOT to ask (learned from Lightfield)

| Don't Ask | Why |
|-----------|-----|
| Billing address during trial | Lightfield's Stripe checkout is the #1 friction point. We do free trial without card. |
| HDYHAU (How did you hear about us) | Marketing attribution, not product value. Track via UTM params instead. |
| Pipeline stages | "Schema-less" — let AI suggest stages from observed deals |
| Custom fields | Too early. Let them discover this need in-product. |
| Team invites | Solo founder flow first. Invite later. |
| Booking a call | Offer via chat/email, not as an onboarding gate. |
