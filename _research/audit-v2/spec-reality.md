# Spec vs Reality Audit — 2026-04-01

## Overview

38 features marked as `passes: true` in feature_list.json.
- 12 have spec directories with requirements
- 1 has empty spec directory (F2.4)
- 25 have no spec directory at all
- All G-series features (G3, G5, G7-G20) have no specs — built without spec phase
- **All task checkboxes in every spec remain unchecked `[ ]`** — none were marked done despite features being marked as passing

## Feature-by-Feature Table

| Feature ID | Name | Has Spec? | Criteria Count | Implemented? | Missing | Spec Quality |
|------------|------|-----------|---------------|-------------|---------|-------------|
| F1.1 | Authentication | Yes | 5 AC + 4 edge | Partially — NextAuth with Google OAuth works, Clerk references in schema but not used | Clerk integration (uses NextAuth instead), magic link auth | Thorough |
| F1.2 | Multi-tenant workspace | No | — | Fake — tenantId hardcoded to "default" everywhere | Real tenant resolution, workspace creation, tenant isolation | No spec |
| F1.3 | Core data model | No | — | Yes — schema.ts has all entities, JSONB properties, Drizzle ORM | — | No spec |
| F1.4 | Chat interface | No | — | Yes — streaming chat with AI SDK, RAG, persistent threads, chat history sidebar | Missing auth on chat API route | No spec |
| F1.5 | Settings and onboarding | No | — | Partial — settings pages exist, no onboarding flow, ICP in workspace settings | Onboarding flow | No spec |
| F2.1 | Email sync | Yes | 5 AC + 6 edge | Yes — Gmail OAuth sync via googleapis, activity creation, dedup | Microsoft Outlook sync (only Google) | Thorough |
| F2.4 | Activity timeline | Yes (empty) | 0 | Yes — activities API exists, timeline on contact/deal detail pages | — | **Spec insufficient** (empty dir) |
| F2.5 | Auto-summarization | No | — | Partial — summary field on deals, LLM extraction exists | Not automatic — requires manual trigger | No spec |
| F2.6 | Embedding + RAG | Yes | 4 AC + 4 edge | Yes — OpenAI text-embedding-3-small, pgvector, cosine similarity search | — | Thorough |
| F2.7 | NL queries with citations | No | — | Partial — RAG search returns matching entities but no citation formatting (no source links, no highlighting) | Citation UI, source linking | No spec |
| F2.8 | CSV import | Yes | 5 AC + 6 edge | Yes — CSV parsing, field mapping, company/contact creation | No preview step, no error report per row | Requirements only |
| F3.1 | Company enrichment | Yes | 4 AC + office hours | Yes — Apollo first, LLM fallback, batch processing | — | Thorough |
| F3.2 | Contact enrichment | Yes | 5 AC + 5 edge | Yes — Apollo first, LLM fallback, batch processing | — | Thorough |
| F3.3 | TAM builder | Yes | 5 AC + 5 edge | Yes — Apollo search + LLM fallback, dedup, ICP-to-filters | — | Thorough |
| F3.4 | ML scoring | Yes | 3 AC (truncated) | Yes — but NOT ML. Rule-based weighted scoring (fit + engagement) | No ML model, no model training, no feature importance | Medium |
| F3.5 | Signal overlay | Yes | 5 AC + 3 edge | Partial — LLM interprets Apollo data as signals. Not real-time monitoring | No live signal monitoring (hiring pages, news, funding APIs) | Medium |
| F4.1 | Email sending | Yes | 5 AC + 3 edge | Partial — outbound email records created with status "queued" but **no actual SMTP/SES send implementation** | Actual email delivery (SMTP, SES, EmailEngine send) | Medium |
| F4.2 | Sequence engine | Yes | 4 AC + 3 edge | Partial — sequence CRUD, steps, enrollments exist. Inngest function exists but **trigger event never fired** by any scheduler | No scheduler/cron to fire step-due events, no actual email sending | Medium |
| F5.1 | Pipeline/Kanban | Yes | 4 AC (bullets) | Yes — Kanban board with drag (conceptual), stages, deal cards | No actual drag-and-drop implementation visible in code | **Spec insufficient** (7 lines) |
| F5.2 | Deal intelligence | Yes | 3 AC (bullets) | Partial — deal analysis via LLM, extraction from notes | No automatic triggering, no risk alerts | **Spec insufficient** (6 lines) |
| F6.1 | Chat-first agent | Yes | 3 AC (bullets) | Yes — streaming chat, RAG context, tool use pattern | — | **Spec insufficient** (6 lines) |
| F7.1 | Data providers | No | — | Yes — Apollo client with 5 endpoints, proper error handling, API key management | — | No spec |
| G3 | Contact auto-suggestion | No | — | Yes — Apollo people search on account detail, expandable row | — | No spec |
| G5 | Email composer | No | — | Yes — EmailComposer component, generation + edit + send flow | Send function creates outbound record but doesn't deliver | No spec |
| G7 | Follow-up emails | No | — | Yes — follow-up generation from meeting notes, action items extraction | — | No spec |
| G8 | Deal timeline | No | — | Yes — timeline API, activity display on deal detail | — | No spec |
| G9 | Structured extraction | No | — | Yes — LLM extraction of budget/team/competitors into structured fields | — | No spec |
| G10 | Multi-language chat | No | — | Yes — language detection, system prompt translation | — | No spec |
| G11 | Score visualization | No | — | Yes — letter grades A-F, fire emoji, heat indicator in accounts page | — | No spec |
| G12 | Suggested replies | No | — | Yes — 3 reply options (brief/detailed/decline) from incoming email | — | No spec |
| G13 | Pipeline column totals | No | — | Yes — stage name, deal count badge, total value in kanban headers | — | No spec |
| G14 | Account-scoped chat | No | — | Yes — ScopedChat component with contextType/contextId | — | No spec |
| G15 | Chat transparency | No | — | Partial — metadata field in chat messages exists but unclear if indicators render | — | No spec |
| G16 | 7 lifecycle stages | No | — | Yes — lifecycle enum, color-coded pills, stage update API | — | No spec |
| G17 | Momentum indicator | No | — | Yes — getMomentum() function, lightning bolt icon on deals | — | No spec |
| G18 | Custom boolean signals | No | — | Partial — hardcoded column names ("Common Investor?", "Sales-led?") in useState, not configurable | Not dynamic/configurable — hardcoded | No spec |
| G19 | Chat history | No | — | Yes — chat threads in sidebar, browsable | — | No spec |
| G20 | Suggested prompts | No | — | Yes — 8 pre-built prompts on empty chat state | — | No spec |

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total "passing" features | 38 |
| With thorough specs (requirements + design + tasks) | 8 (F1.1, F2.1, F2.6, F3.1, F3.2, F3.3, F4.1, F4.2) |
| With minimal specs (requirements only) | 4 (F2.8, F5.1, F5.2, F6.1) |
| With empty/no spec | 26 |
| Actually fully implemented | ~20 |
| Partially implemented (key functionality missing) | ~14 |
| Fake/non-functional (marked passing but core feature missing) | ~4 (F1.2, F4.1 email delivery, F4.2 scheduler, F3.4 "ML") |

## Critical Gaps Between Spec and Reality

1. **F1.2 Multi-tenancy**: Spec says "RLS, workspace creation, tenant isolation". Reality: `tenantId: "default"` hardcoded everywhere. Zero tenant isolation.
2. **F4.1 Email sending**: Spec says email delivery. Reality: outbound email records created but no SMTP/SES integration exists. Emails are never actually sent.
3. **F4.2 Sequence engine**: Spec says automated step execution. Reality: Inngest function exists but no scheduler fires the `sequence/step-due` event. Sequences never execute automatically.
4. **F3.4 ML scoring**: Feature says "ML scoring". Reality: hand-coded weighted heuristics. No machine learning of any kind.
5. **F1.1 Authentication**: Spec references Clerk. Reality: uses NextAuth. Schema has `clerkId` column that's never populated via the actual auth flow.
