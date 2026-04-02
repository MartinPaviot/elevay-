# Data Sources Documentation

## External APIs

### Apollo.io (Primary Enrichment Provider)
- **Endpoints used**:
  - `GET /v1/organizations/enrich?domain=` — Company enrichment by domain
  - `POST /v1/people/match` — Contact enrichment by email/name/domain
  - `POST /v1/mixed_people/search` — People search by org domain/seniority
  - `POST /api/v1/mixed_companies/search` — Organization search by keywords/filters
- **Rate limits**: Varies by plan. Free: 10/min, 100/month. Basic: 900/month. Pro: 2400/month.
- **Cost**: Free tier = $0. Basic = $49/mo. Professional = $99/mo.
- **Data returned**: Industry, description, employee count, revenue, funding, tech stack, LinkedIn, location, keywords
- **Client file**: `app/apps/web/src/lib/apollo-client.ts`

### OpenAI (Embeddings)
- **Endpoint**: Embedding API (via Vercel AI SDK)
- **Model**: text-embedding-3-small
- **Cost**: $0.02/1M tokens (~negligible)
- **Used for**: Vector search on companies, contacts, activities

### Claude / OpenAI (AI Features — NOT for enrichment)
- **Used for**: Chat, email generation, signal interpretation, deal analysis
- **NOT used for**: Company/contact data enrichment (removed LLM fallback)
- **Cost**: ~$3/M input tokens, ~$15/M output tokens (Claude Sonnet)

### Google APIs (via OAuth)
- **Gmail API** (`googleapis`): Read emails, sync to activities
  - Scope: `gmail.readonly`
  - Client file: `lib/gmail.ts`
- **Calendar API** (`googleapis`): Read meetings, sync to activities
  - Scope: `calendar.readonly`
  - Client file: `lib/calendar.ts`

## Internal Data Sources
- **Activity tracking**: All emails, meetings, calls, notes logged as activities
- **Engagement scoring**: Based on real activity counts, recency, sentiment
- **Fit scoring**: Rule-based on Apollo data (industry, size, revenue, tech stack, funding, location)

## Data Quality Indicators
- `enrichment_source: "apollo"` — Verified external data
- `enrichment_source: "unavailable"` — API returned no data or not configured
- `scoring_method: "rule_based"` — Score calculated from real signals, not AI-generated

## NOT Yet Integrated (Potential Secondary Providers)
- PeopleDataLabs — Contact/company enrichment fallback
- Hunter.io — Email verification
- ZeroBounce — Email verification
- BuiltWith / Wappalyzer — Tech stack detection
- Crunchbase — Funding data
