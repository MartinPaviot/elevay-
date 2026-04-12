# Elevay Codebase Audit

## Tech Stack
- **Frontend**: Next.js 15.3 + React 19.1 + Tailwind
- **Backend**: Next.js API routes + Node.js worker (BullMQ)
- **Database**: PostgreSQL + Drizzle ORM (NOT Prisma)
- **Job Queue**: Inngest (event-driven) + BullMQ + Redis (email worker)
- **AI**: Claude (Anthropic SDK 3.0.64) + OpenAI (6.33.0) + Vercel AI SDK (6.0.141)
- **Auth**: NextAuth v5 (beta) with Google/Microsoft/Credentials providers
- **Billing**: Stripe
- **Email**: Gmail/Outlook APIs + EmailEngine
- **Testing**: Vitest 4.1.2
- **Validation**: Zod 4.3.6
- **Monorepo**: pnpm + Turborepo

## Path alias
`@/*` -> `./src/*` (in apps/web)

## Fichiers cles

### Schema DB
- `apps/web/src/db/schema.ts` — Drizzle ORM, ALL models defined here
- Uses pgTable, pgEnum, text, timestamp, jsonb, integer, real, boolean, varchar

### Clients API
- `apps/web/src/lib/apollo-client.ts` — Apollo enrichment/search
  - `enrichOrganization(domain)`, `enrichPerson({email, first_name, last_name, organization_name, domain})`
  - `searchPeople({q_organization_domains, person_titles, person_seniorities, page, per_page})`
  - `searchOrganizations(params)`, `isApolloAvailable()`, `isSearchAvailable()`

### Scoring
- `apps/web/src/lib/scoring.ts` — Pure scoring functions
  - `calculateFitScore(company, props, icp?)` -> FitScoreResult (0-100)
  - `calculateContactFitScore(contact, props, company, targetRoleKeywords?)` -> {score, reasons, grade}
  - `getGrade(score)` -> {min, grade, heat, icon}
  - Grade scale: A+ (90+), A (80+), B (65+), C (50+), D (35+), F (<35)
- `apps/web/src/lib/contact-scoring.ts` — Contact-specific scoring with DB access
  - `scoreContact(contactId, tenantId, icpSettings?)` -> ContactScoreResult
  - Components: seniority (0-25), engagement (0-35), sentiment (0-25), icpFit (0-15)

### Sequences & Outbound
- `apps/web/src/lib/sequence-generator.ts` — AI sequence generation
  - `generateSequence(ctx: ProspectContext, options?)` -> GeneratedSequence
  - `personalizeStepEmail(ctx, stepTemplate, stepStrategy, tenantId?)` -> {subject, body}
  - Uses tracedGenerateObject with evaluator-optimizer loop
- `apps/web/src/lib/outbound-methodologies.ts` — Sales methodology framework

### Intelligence & Context
- `apps/web/src/lib/prospect-context.ts` — Prospect intelligence assembly
  - `buildProspectContext(contactId, tenantId)` -> ProspectContext
  - `formatContextForPrompt(ctx)` -> string
  - ProspectContext: {contact, company, signals, technologies, funding, knowledge, previousEmails, recentActivities}
- `apps/web/src/lib/context-graph.ts` — Bi-temporal knowledge graph (26.5KB)
  - `extractEntitiesAndFacts(text, sourceType)` -> ExtractionResult
  - Entity types: person, company, deal, topic, event
  - 12 relation types: WORKS_AT, INVOLVED_IN, DISCUSSED, etc.
- `apps/web/src/lib/momentum.ts` — Simple momentum detection
  - `getMomentum(activitiesCount, daysSinceLastActivity)` -> "high"|"medium"|"low"|"none"
- `apps/web/src/lib/lifecycle.ts` — Lifecycle stage definitions
  - Stages: New, Prospecting, Opportunity, Customer, Disqualified, Inbound, Nurture
- `apps/web/src/lib/deal-velocity.ts` — Deal velocity prediction
  - `predictDealVelocity(dealId, tenantId)` -> VelocityResult
  - Risk: "on_track" | "slowing" | "stalled"

### Observability
- `apps/web/src/lib/observability.ts` — Agent tracing system
  - `AGENT_REGISTRY` — 24+ registered agents with IDs, categories, thresholds
  - `traceAgent<T>(ctx, fn)` -> T — Wrapper with auto instrumentation
  - `recordTrace(ctx, result)` — Logs to agentTraces table
  - `SpanRecorder` class — Builder for metadata
  - Cost model: Claude Sonnet $3/$15; GPT-4o-mini $0.15/$0.6

### Inngest (Event-driven jobs)
- `apps/web/src/inngest/client.ts` — Inngest client, id "elevay"
- `apps/web/src/inngest/functions.ts` — Function definitions
  - Pattern: `inngest.createFunction({id, name, retries, triggers}, handler)`
  - Enrichment triggered by "company/created", "contact/created"
- `apps/web/src/inngest/campaign-functions.ts` — Campaign execution
- `apps/web/src/inngest/email-send-worker.ts` — Email sending
- `apps/web/src/inngest/sequence-cron.ts` — Sequence automation
- `apps/web/src/inngest/sync-functions.ts` — Email/calendar sync
- `apps/web/src/inngest/meeting-functions.ts` — Meeting processing
- `apps/web/src/inngest/reply-handler.ts` — Reply classification
- `apps/web/src/inngest/workflow-engine.ts` — Workflow orchestration

### Worker Service
- `apps/worker/src/index.ts` — Main service
- `apps/worker/src/workers/send.worker.ts` — Email sending
- `apps/worker/src/workers/reply.worker.ts` — Reply processing
- `apps/worker/src/workers/warmup.worker.ts` — Email warmup
- `apps/worker/src/workers/health.worker.ts` — Mailbox health
- `apps/worker/src/services/emailengine.ts` — EmailEngine API
- `apps/worker/src/services/rate-limiter.ts` — Rate limiting

### Other Utils
- `apps/web/src/lib/prompted-ai.ts` — Traced AI calls with observability
- `apps/web/src/lib/writing-profile.ts` — User writing style profiling
- `apps/web/src/lib/follow-up-timing.ts` — Follow-up scheduling
- `apps/web/src/lib/notifications.ts` — Push & email notifications
- `apps/web/src/lib/corrections.ts` — Agent error correction system (15.5KB)
- `apps/web/src/lib/eval-runner.ts` — Evaluation runner (10.2KB)
- `apps/web/src/lib/cost-tracker.ts` — API cost estimation
- `apps/web/src/lib/audit-log.ts` — Audit logging
- `apps/web/src/lib/embeddings.ts` — Embedding generation
- `apps/web/src/lib/rate-limit.ts` — Rate limiting
- `apps/web/src/lib/stripe.ts` — Stripe billing
- `apps/web/src/lib/auth-utils.ts` — Auth helpers

## Schema de base de donnees (Drizzle ORM)

### Core CRM
- **companies** — id, tenantId, name, domain, industry, size, revenue, description, properties (JSONB), score, scoreReasons, ownerId
- **contacts** — id, tenantId, companyId, email, phone, firstName, lastName, title, linkedinUrl, properties, score, scoreReasons, ownerId
- **deals** — id, tenantId, companyId, contactId, ownerId, name, stage (enum), value, currency, expectedCloseDate, properties, score, scoreReasons, summary
- **activities** — id, tenantId, actorType, actorId, entityType, entityId, activityType (enum), channel, direction, occurredAt, metadata, sentiment
- **notes** — id, tenantId, authorId, entityType, entityId, title, content
- **tasks** — id, tenantId, assigneeId, entityType, entityId, title, description, dueDate, status, priority

### Email Outbound
- **sequences** — id, tenantId, name, description, status (draft/active/paused/archived), campaignConfig
- **sequenceSteps** — id, sequenceId, stepNumber, subjectTemplate, bodyTemplate, delayDays
- **sequenceEnrollments** — id, sequenceId, contactId, status, currentStep, enrolledAt, nextStepAt
- **connectedMailboxes** — id, tenantId, emailAddress, provider, status, dailyLimit, sentToday, healthScore
- **outboundEmails** — id, tenantId, campaignId, enrollmentId, contactId, mailboxId, fromAddress, toAddress, subject, bodyHtml, status (enum), timestamps
- **warmupEmails** — id, mailboxId, targetMailboxId, direction, messageId, status
- **emailOptouts** — id, tenantId, emailAddress, reason

### AI Chat
- **chatThreads** — id, tenantId, userId, title, contextType, contextId
- **chatMessages** — id, threadId, role, content, metadata
- **chatMemories** — id, tenantId, userId, category, key, content, metadata, expiresAt

### Knowledge Graph
- **contextGraphNodes** — id, tenantId, entityType, entityId, name, summary, properties
- **contextGraphEdges** — id, tenantId, sourceNodeId, targetNodeId, relationType, fact, confidence, bi-temporal timestamps
- **contextGraphCommunities** — id, tenantId, name, summary, nodeIds (array)

### Observability
- **agentTraces** — id, tenantId, agentId, agentCategory, traceId, input, output, model, status, tokens, cost, latencyMs, toolCalls
- **agentPromptVersions** — id, agentId, version, systemPrompt, changeReason, evalScore, isActive
- **agentFewShotExamples** — id, agentId, input, output, evalScore, isActive
- **agentFailurePatterns** — id, agentId, patternType, description, frequency, resolution

### Eval System
- **evalDatasets** — id, tenantId, name, description
- **evalCases** — id, datasetId, input, expectedOutput, context, tags
- **evalRuns** — id, tenantId, datasetId, model, status, summary
- **evalResults** — id, runId, caseId, agentOutput, score, pass, graderReasoning

### Notifications
- **notifications** — id, tenantId, userId, type (enum), title, body, entityType, entityId, read
- **notificationPreferences** — id, userId, tenantId, emailEnabled, inAppEnabled, preferences

### Import
- **importHistory** — id, tenantId, userId, fileName, recordType, totalRows, status, errors

## Infra disponible

### Inngest
- Client: `inngest` instance, id "elevay"
- Pattern: `inngest.createFunction({id, name, retries}, handler)`
- Event-driven: "company/created", "contact/created", "sequence/step-due"
- Functions in: `apps/web/src/inngest/*.ts`

### BullMQ + Redis (Worker)
- Queues: health-check-all, warmup, send, reply
- Workers: send, reply, warmup, health
- Redis via ioredis

### Auth/Tenancy
- NextAuth v5 with DrizzleAdapter
- `tenantId` on ALL CRM tables
- `resolveUserTenant()` on first login: creates tenant + user
- Every API route extracts tenantId from session
- All queries filtered by `eq(table.tenantId, tenantId)`

## API Routes (key ones for skills)
- `/api/enrich/` — Single enrichment
- `/api/enrich-batch/` — Batch enrichment
- `/api/search/tam/` — TAM search
- `/api/tam/` — TAM building
- `/api/score/` — Scoring
- `/api/signals/` — Custom signals
- `/api/insights/` — AI insights
- `/api/sequences/` — Sequence CRUD
- `/api/campaigns/generate/` — AI campaign generation
- `/api/deals/analyze/` — AI deal analysis
- `/api/meetings/prep/` — Meeting preparation
- `/api/chat/` — Conversational AI
- `/api/context-graph/` — Knowledge graph queries

## Build Commands
```bash
# Web app
pnpm --filter @leadsens/web build   # next build
pnpm --filter @leadsens/web tsc     # tsc --noEmit
pnpm --filter @leadsens/web test    # vitest run
pnpm --filter @leadsens/web lint    # next lint

# Worker
pnpm --filter @leadsens/worker build  # tsc
pnpm --filter @leadsens/worker tsc    # tsc --noEmit

# Root
cd app && pnpm run build  # turborepo
```
