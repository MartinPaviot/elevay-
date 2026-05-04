# AI-Generated Account Summary

## User Story
As a founder doing founder-led sales, I want every account to have an AI-generated summary and business model description so that I can quickly understand any company without manual research.

## Acceptance Criteria

### AC1: Auto-generation post-enrichment
GIVEN a company is created or enriched
WHEN the enrichment waterfall completes
THEN an LLM generates two fields from the enriched data:
  - `ai_account_summary`: 2-3 sentence synthesis of the company for a sales rep
  - `ai_how_they_make_money`: 1-2 sentence business model description
AND both are stored in `companies.properties` JSONB

### AC2: Display on account detail
GIVEN I am on an account detail page
WHEN the account has AI-generated summary fields
THEN "Account Summary" is displayed above the description
AND "About their business" is displayed below it
AND both show an "AI-generated" badge
AND both are read-only

### AC3: Regeneration
GIVEN I am on an account detail page
WHEN I click the "Refresh" button on the AI summary section
THEN the summary is regenerated using current company properties
AND the UI updates with the new content

### AC4: Missing data handling
GIVEN a company with minimal enrichment data (only name + domain)
WHEN the LLM generates a summary
THEN it produces a useful summary from available data without fabricating facts
AND if insufficient data, it states "Limited information available" rather than hallucinating

## Edge Cases
- Company with no enrichment data: skip summary generation, show nothing
- Enrichment in progress: show skeleton loading state
- LLM call fails: log error, leave existing summary (or empty), don't block enrichment
- Very long company descriptions: truncate LLM input to avoid token limits

## Evaluation Steps
1. Create a new company with domain — enrichment runs — summary appears after a few seconds
2. View account detail — summary and business model visible with AI badge
3. Click "Refresh" — new summary generated
4. Create company with no domain — no summary generated, no error
