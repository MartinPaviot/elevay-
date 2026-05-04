# AI Account Summary — Design

## System Fit
Enrichment runs via `enrich-company` Inngest function in `functions.ts`. After waterfall (Apollo → LLM fallback), it updates `companies` fields and `properties` JSONB, then re-embeds and triggers signal evaluation.

The AI summary step inserts AFTER enrichment update and BEFORE signal evaluation, as a new Inngest step.

## Data Model
Store in existing `companies.properties` JSONB:
```json
{
  "ai_account_summary": "Meridian Labs builds AI solutions for financial services...",
  "ai_how_they_make_money": "B2B SaaS selling AI-powered risk assessment tools to banks and fintechs.",
  "ai_summary_generated_at": "2026-05-04T19:30:00Z"
}
```
No schema migration needed — JSONB is already extensible.

## LLM Call
```
System: You generate concise company intelligence for sales reps.
User: Generate two fields for this company:
  Name: {name}
  Domain: {domain}
  Industry: {industry}
  Description: {description}
  Size: {size}
  Revenue: {revenue}
  Technologies: {technologies}
  Funding: {latest_funding_stage}

  1. account_summary: 2-3 sentences synthesizing what this company does, their market position, and why a sales rep should care. Be specific, not generic.
  2. how_they_make_money: 1-2 sentences on their business model and revenue sources.

  Return JSON: { "account_summary": "...", "how_they_make_money": "..." }
```

Model: use haiku for cost efficiency (this runs for every company).

## API Contract
New endpoint:
```
POST /api/accounts/[id]/generate-summary
Auth: standard session
Response: { ai_account_summary: string, ai_how_they_make_money: string }
Side effect: updates companies.properties JSONB
```

## Data Flow
```
Company created → Inngest enrich-company:
  1. fetch-company
  2. enrich-from-apollo (or LLM fallback)
  3. update-company
  4. NEW: generate-ai-summary ← calls LLM, updates properties
  5. re-embed
  6. realtime-signal-eval

Manual refresh:
  POST /api/accounts/[id]/generate-summary → calls same LLM function → updates properties → returns new values
```

## Display
In `accounts/[id]/page.tsx`, add above the description field:
- "Account Summary" section with AI-generated text + sparkle icon badge
- "About their business" section below
- "Refresh" icon button (RefreshCw) triggers regeneration
- Skeleton state while loading

## Failure Handling
- LLM call fails: log warning, skip step, don't block enrichment pipeline
- No enrichment data: skip summary generation entirely
- Timeout: 15s max for LLM call
