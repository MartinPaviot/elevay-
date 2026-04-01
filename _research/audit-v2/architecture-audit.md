# Architecture Audit — 2026-04-01

## 1. File Structure

```
app/apps/web/src/
├── __tests__/                     # 19 test files (flat, no structure)
│   ├── actions-api.test.ts
│   ├── autopilot-api.test.ts
│   ├── dashboard.test.ts
│   ├── deals-api.test.ts
│   ├── deliverability-api.test.ts
│   ├── emails-api.test.ts
│   ├── enrich-api.test.ts
│   ├── enrich-contacts-api.test.ts
│   ├── g-features-batch.test.ts   # Odd naming — batches unrelated features
│   ├── g-features-batch2.test.ts
│   ├── insights-api.test.ts
│   ├── pipeline-analytics-api.test.ts
│   ├── score-api.test.ts
│   ├── score-contacts-api.test.ts
│   ├── search-tam-api.test.ts
│   ├── sequences-api.test.ts
│   ├── settings-api.test.ts
│   ├── signals-api.test.ts
│   └── tam-api.test.ts
├── app/
│   ├── globals.css                # Design system CSS variables
│   ├── layout.tsx                 # Root layout (ClerkProvider, fonts)
│   ├── sign-in/page.tsx           # Sign-in page
│   ├── (dashboard)/               # Dashboard route group
│   │   ├── layout.tsx             # Sidebar + auth check (server component)
│   │   ├── page.tsx               # Dashboard home ("Up next")
│   │   ├── accounts/
│   │   │   ├── page.tsx           # Accounts list
│   │   │   └── [id]/page.tsx      # Account detail
│   │   ├── contacts/
│   │   │   ├── page.tsx           # Contacts list
│   │   │   └── [id]/page.tsx      # Contact detail
│   │   ├── opportunities/
│   │   │   ├── page.tsx           # Pipeline kanban
│   │   │   └── [id]/page.tsx      # Deal detail
│   │   ├── chat/page.tsx          # AI chat
│   │   ├── sequences/
│   │   │   ├── page.tsx           # Sequences list
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # Sequence detail
│   │   │       └── review/page.tsx # Outbound review queue
│   │   ├── deliverability/page.tsx
│   │   ├── tasks/page.tsx
│   │   ├── meetings/page.tsx
│   │   ├── notes/page.tsx
│   │   └── settings/
│   │       ├── layout.tsx         # Settings tabs
│   │       ├── page.tsx           # Profile settings
│   │       ├── workspace/page.tsx
│   │       ├── mailboxes/page.tsx
│   │       ├── stages/page.tsx
│   │       ├── knowledge/page.tsx
│   │       ├── agent/page.tsx
│   │       ├── members/page.tsx
│   │       └── notifications/page.tsx
│   └── api/                       # 50 API route files
│       ├── accounts/              # CRUD + contacts, lifecycle, suggested
│       ├── actions/               # AI-generated next actions
│       ├── activities/            # Activity timeline
│       ├── admin/purge-fake-data/ # Data cleanup
│       ├── auth/[...nextauth]/    # NextAuth handler
│       ├── calendar/sync/         # Google Calendar sync
│       ├── chat/                  # AI chat (RAG)
│       ├── contacts/              # CRUD
│       ├── dashboard/summary/     # Dashboard stats
│       ├── deals/                 # CRUD + analyze, extract, timeline
│       ├── deliverability/        # Email health metrics
│       ├── email/                 # Sync + status
│       ├── emails/                # Generate + follow-up + suggest-reply
│       ├── embed/                 # Batch embedding
│       ├── enrich/                # Company enrichment
│       ├── enrich-contacts/       # Contact enrichment
│       ├── import/                # CSV import
│       ├── inngest/               # Inngest serve handler
│       ├── insights/              # Business insights
│       ├── opportunities/         # CRUD + extract-intel
│       ├── outbound/review/       # Outbound review queue
│       ├── pipeline/analytics/    # Pipeline metrics
│       ├── score/                 # Company scoring
│       ├── score-contacts/        # Contact scoring
│       ├── search/                # Vector search + TAM search
│       ├── sequences/             # CRUD + autopilot, enroll, steps, suggestions
│       ├── settings/              # Workspace, stages, knowledge, mailboxes, custom-signals
│       ├── signals/               # Signal detection
│       ├── tam/                   # TAM builder
│       ├── tasks/                 # Task CRUD
│       └── webhooks/emailengine/  # Webhook handler
├── auth.ts                        # NextAuth config
├── components/
│   ├── email-composer.tsx         # Only 2 shared components
│   └── scoped-chat.tsx
├── db/
│   ├── index.ts                   # Drizzle client
│   └── schema.ts                  # 548 lines, all tables
├── inngest/
│   ├── client.ts                  # Inngest client
│   └── functions.ts               # 4 Inngest functions
├── lib/
│   ├── apollo-client.ts           # Apollo.io API client
│   ├── calendar.ts                # Google Calendar client
│   ├── embeddings.ts              # OpenAI embeddings + pgvector
│   ├── gmail.ts                   # Gmail API client
│   ├── language.ts                # Language detection
│   ├── lifecycle.ts               # Lifecycle stage logic
│   └── momentum.ts                # Deal momentum calc
└── middleware.ts                   # Auth middleware (protects all routes except auth/static)
```

**Assessment**: Structure is CLEAN and LOGICAL. Standard Next.js App Router conventions. Route groups used appropriately. API routes organized by domain entity.

**Issues**:
- Only 2 shared components — most UI is duplicated inline in page files
- Test files are flat in `__tests__/` with no organization mirroring the source
- `g-features-batch.test.ts` / `g-features-batch2.test.ts` naming suggests rushed test creation
- No shared types, utilities, or hooks directories
- No `/types` directory — types are defined inline everywhere

## 2. Circular Dependencies

No circular dependency tool installed. Manual analysis:

- `db/index.ts` → `db/schema.ts` (one-way, clean)
- `auth.ts` → `db/index.ts` → `db/schema.ts` (one-way chain)
- All API routes → `auth.ts`, `db/index.ts` (one-way)
- Some API routes → `lib/*` (one-way)
- `inngest/functions.ts` → `db/index.ts`, `lib/embeddings.ts` (one-way)
- Components → nothing (they're leaf nodes)

**Assessment**: No circular dependencies detected. The dependency graph is a clean DAG (directed acyclic graph). Everything flows downward: pages → API routes → lib → db.

## 3. Database Schema Analysis

**Tables: 18** (4 auth + 14 business)

### Schema Quality

**Auth tables (4)**: `auth_user`, `auth_account`, `auth_session`, `auth_verificationToken`
- Standard NextAuth/DrizzleAdapter tables. Correct.

**Core tables (8)**: `tenants`, `users`, `companies`, `contacts`, `deals`, `activities`, `notes`, `tasks`
- All have `tenant_id` FK to tenants
- All use text UUIDs as primary keys
- Timestamps with timezone on all tables

**Sequence tables (3)**: `sequences`, `sequence_steps`, `sequence_enrollments`
- Proper FK constraints with cascade deletes on steps/enrollments

**Email tables (4)**: `connected_mailboxes`, `outbound_emails`, `warmup_emails`, `email_optouts`
- Comprehensive outbound email tracking

**Chat tables (2)**: `chat_threads`, `chat_messages`

### Indexes

**Good**: 35+ indexes defined. Every `tenant_id` column is indexed. Key lookup columns indexed (email, domain, stage, status, occurred_at). Composite indexes on entity lookups.

**Missing indexes**:
- `warmup_emails` — no indexes at all
- No GIN index on JSONB `properties` columns (queries against properties will be slow)
- No index on `outbound_emails.createdAt` (needed for time-range queries on email history)

### Constraints

**Good**:
- FK constraints on all relationships
- Cascade deletes on sequence steps/enrollments
- Unique constraint on `auth_account(provider, providerAccountId)`
- Unique constraint on `connected_mailboxes(tenantId, emailAddress)`
- Unique constraint on `email_optouts(tenantId, emailAddress)`

**Missing constraints**:
- No `UNIQUE` on `companies(tenant_id, domain)` — can create duplicate companies for same domain
- No `UNIQUE` on `contacts(tenant_id, email)` — can create duplicate contacts
- No `CHECK` constraints on enum-like text fields (`status`, `priority`, `role`)
- `deals.value` is `integer` — cannot represent cents/fractional amounts
- No `NOT NULL` on `contacts.email` — contacts without email can't receive sequences
- `users.clerkId` references Clerk but auth uses NextAuth — schema inconsistency

### Normalization

**Assessment: Adequate (3NF) but relies heavily on JSONB**

- `properties: jsonb` on companies, contacts, deals — schema-less by design (Lightfield pattern)
- `metadata: jsonb` on activities, chat_messages — reasonable for polymorphic data
- `scoreReasons: jsonb` on companies, contacts, deals — could be a separate table but JSONB is acceptable
- No separate `industries` or `company_sizes` reference tables — all stored as free text
- `sendDays: jsonb` on `connected_mailboxes` stores array of day strings — minor denormalization

The JSONB approach is intentional (the spec calls for "schema-less customer memory"). This is a design choice, not a deficiency.

## 4. Tenant Isolation / RLS

### RLS: NOT CONFIGURED

The research documents (`data-architecture.md`, `security-privacy.md`) extensively describe RLS implementation plans. **None of this is implemented.**

Evidence:
- No SQL migration files contain `ENABLE ROW LEVEL SECURITY` or `CREATE POLICY`
- The Drizzle schema has no RLS configuration
- The database is on Neon PostgreSQL but RLS is not enabled

### Current isolation: Application-level `WHERE tenant_id = X`

**But worse**: The application doesn't even use real tenant IDs. 17 API routes hardcode `tenantId: "default"`:

```
accounts/route.ts:45 — tenantId: "default", // TODO: use real tenant from session
activities/route.ts:60
calendar/sync/route.ts:34,60
email/sync/route.ts:62
import/route.ts:89,110
opportunities/route.ts:41
outbound/review/route.ts:21
sequences/route.ts:65
settings/mailboxes/route.ts:15,92
tam/route.ts:145,221
tasks/route.ts:45
```

**Assessment: CRITICAL.** Multi-tenancy is completely fake. Every user shares the same "default" tenant. There is no mechanism to resolve the current user's tenant ID from their session. The `users` table has `tenantId` but it's never read during API calls. If a second workspace were created, all data would be visible to all users.

## 5. Credentials / Secrets

### Hardcoded secrets in source: NONE

No API keys, tokens, or passwords found in source code. All secrets accessed via `process.env`:
- `DATABASE_URL`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`
- `APOLLO_API_KEY`
- `EMAILENGINE_URL`
- `REDIS_URL`

### .gitignore: Properly configured

```
_credentials/
node_modules/
.env*
.next/
dist/
harness/
credentials/
.playwright-mcp/
```

`.env*` is in `.gitignore` — secrets won't be committed.

## 6. Inngest Functions

**4 functions registered, all with real triggers:**

| Function | Trigger Event | Real? |
|----------|--------------|-------|
| `enrichCompany` | `company/created` | Yes — fired from `accounts/route.ts` POST handler |
| `enrichContact` | `contact/created` | Yes — but no code fires this event (no import/create path sends it) |
| `sendSequenceStep` | `sequence/step-due` | Partial — the event is defined but no cron/scheduler fires it. The `autopilot/route.ts` creates enrollments but doesn't schedule step execution. |
| `processReply` | `email/reply-received` | Partial — the webhook handler at `webhooks/emailengine/route.ts` could fire this but the code just upserts activities, doesn't emit the Inngest event. |

**Assessment**: Only `enrichCompany` has a complete trigger chain. The other 3 functions exist but their trigger events are never emitted by any code path. They are scaffolded but disconnected.

### Inngest function quality:
- `enrichCompany`: Uses LLM `generateObject` to hallucinate firmographics (not Apollo). The API route (`enrich/route.ts`) uses Apollo but the Inngest function does not.
- `enrichContact`: Same pattern — LLM hallucination, not Apollo.
- `sendSequenceStep`: Full implementation — template substitution, LLM personalization, opt-out checking, outbound email creation, activity logging, step advancement. Well-structured.
- `processReply`: Reply classification via LLM (positive/negative/ooo/unsubscribe). Proper.

## 7. State Management

**Pattern: `useState` everywhere. No state library.**

- **No** zustand, jotai, recoil, Redux, or Context API
- Every page component manages its own state with `useState`
- `accounts/page.tsx` alone has **16 separate `useState` calls**
- `sequences/[id]/page.tsx` has **14 `useState` calls**
- `opportunities/page.tsx` has **10 `useState` calls**

**No shared state** between components. Each page fetches its own data on mount.

**Assessment**: For the current complexity level, `useState` is acceptable — this is a Next.js app where most data comes from API calls. However:
- The sheer number of `useState` calls per page (16!) suggests these pages should be decomposed into smaller components
- No data caching or SWR/React Query — every navigation refetches everything
- No optimistic updates
- The dashboard layout is a server component (good) but all child pages are client components that re-fetch data the server already has access to

## 8. Error Handling Patterns

**Pattern: inconsistent and ad-hoc.**

### API Routes
Every API route follows this pattern:
```ts
try {
  // ... business logic ...
  return NextResponse.json(result);
} catch (error) {
  console.error("X failed:", error);
  return NextResponse.json({ error: "X failed" }, { status: 500 });
}
```

Issues:
- Error messages are generic ("X failed") — no error codes for client-side handling
- The actual error is logged but never sent to the client (good for security, bad for debugging)
- No middleware pattern — every route duplicates the try/catch
- No error classification (is it a 400? 500? 503?)

### Frontend Pages
Every page follows:
```ts
try {
  const res = await fetch("/api/...");
  const data = await res.json();
  setState(data);
} catch {
  console.error("Failed to...");
  // user sees nothing
}
```

Issues:
- HTTP status codes are **not checked** — `fetch` doesn't throw on 4xx/5xx
- Most catches are empty — no user-facing error messages
- No retry logic
- No error state UI (no "Something went wrong" messages)

**Assessment: POOR.** Error handling is the weakest part of the codebase. The combination of swallowed errors, no error boundaries, and no error state UI means users will encounter silent failures with no feedback.
