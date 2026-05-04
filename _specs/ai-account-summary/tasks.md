# AI Account Summary — Tasks

## 1. Create summary generation function
- Create `lib/ai-account-summary.ts`
- Export `generateAccountSummary(company: { name, domain, industry, description, size, revenue, properties })` → `{ ai_account_summary, ai_how_they_make_money }`
- Use Anthropic API with haiku model for cost efficiency
- Structured JSON output via prompt
- 15s timeout, return null on failure
- **Verify:** Call function with test company data — returns valid JSON
- **Test:** Unit test with mocked LLM response

## 2. Add summary step to enrichment pipeline
- In `inngest/functions.ts`, add `step.run("generate-ai-summary", ...)` after `update-company` step (line ~163) and before `re-embed` step
- Fetch the updated company (post-enrichment fields)
- Call `generateAccountSummary()` with enriched data
- Write results to `companies.properties` JSONB (merge, don't overwrite)
- Wrap in try/catch — failure doesn't block pipeline
- **Verify:** Create a company with domain — after enrichment, properties contain ai_account_summary
- **Test:** Enrichment completes with and without summary (failure doesn't block)

## 3. Create regeneration API endpoint
- Create `app/api/accounts/[id]/generate-summary/route.ts`
- POST handler: fetch company, call `generateAccountSummary()`, update properties, return result
- Auth: standard session middleware
- **Verify:** POST to endpoint — returns summary and updates DB
- **Test:** Returns 404 for non-existent company, 401 without auth

## 4. Display summary on account detail page
- In `accounts/[id]/page.tsx`, read `properties.ai_account_summary` and `properties.ai_how_they_make_money`
- Add section above description: "Account Summary" header with Sparkles icon + "AI-generated" badge
- Below: "About their business" header
- Both render as read-only text blocks with muted background
- If no summary: don't render section (no empty state)
- **Verify:** Open account with summary — both fields visible with badge
- **Test:** Account without summary shows no summary section

## 5. Add refresh button
- RefreshCw icon button in the summary section header
- onClick: POST to `/api/accounts/[id]/generate-summary`
- Loading state: spinning icon
- On success: update displayed text
- On error: toast notification
- **Verify:** Click refresh — new summary appears after ~2s
- **Test:** Loading state shows during request, error toast on failure
