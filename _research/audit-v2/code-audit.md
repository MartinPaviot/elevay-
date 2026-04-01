# Code Quality Audit — 2026-04-01

## 1. TypeScript Type Checking

```
npx tsc --noEmit → ZERO errors
```

Clean compile. No type errors detected.

## 2. Type Bypasses (`as any`)

**Count: 0**

No `as any` casts found anywhere in `app/apps/web/src/`. This is unusual and good.

## 3. TODO / FIXME / HACK

**Count: 2**

| File | Line | Content |
|------|------|---------|
| `api/email/status/route.ts` | 44 | `lastSync: null, // TODO: track actual last sync timestamp` |
| `api/accounts/route.ts` | 45 | `tenantId: "default", // TODO: use real tenant from session` |

The second one is more serious — hardcoded tenant ID means no real multi-tenancy.

## 4. Console Logging

**Count: 86 console.log/error/warn calls**

Breakdown:
- `console.error`: ~55 instances — used in every API route's catch block
- `console.warn`: ~25 instances — used for non-fatal fallbacks (e.g., Apollo unavailable, embed failure)
- `console.error` in frontend: ~25 instances — used in page component catch blocks

**Assessment**: No proper logging framework (Pino, Winston, structured JSON). Every API route uses raw `console.error("X failed:", error)`. This is debug-grade logging, not production-grade. No request correlation IDs, no structured metadata, no log levels configured.

Frontend console.error calls are also raw — no error reporting service (Sentry, etc.).

## 5. Swallowed Errors (empty catch blocks)

**Count: 48 instances of `catch { }` or `catch { /* */ }`**

Critical examples:
| File | Pattern |
|------|---------|
| `email-composer.tsx:37` | `catch { /* */ } finally { setSending(false); }` — user gets no error feedback |
| `chat/route.ts:33` | `catch { }` — silently fails parsing messages |
| `accounts/page.tsx:77,93,126,136,145` | 5 separate swallowed catches on the accounts page |
| `contacts/page.tsx:74,110,137,168` | 4 swallowed catches |
| `opportunities/page.tsx:82,94,125,145` | 4 swallowed catches |
| `settings/mailboxes/route.ts:129` | `catch {}` — silently fails EmailEngine operations |
| `tam/route.ts:97,127,166,231` | 4 swallowed catches in TAM generation |

**Assessment: SEVERE.** Nearly every frontend page silently swallows errors. Users will see loading states that never resolve, or stale data, with zero indication of what went wrong. The backend swallows errors in secondary operations (embed, enrich) which is more defensible but still masks problems.

## 6. Hardcoded Colors

**Count: ~80+ hardcoded hex colors in TSX files**

Located in:
- `accounts/page.tsx:31-50` — 20 hardcoded colors for lifecycle/badge colors
- `contacts/page.tsx:29-38,51-54` — 14 hardcoded colors for badges + score thresholds
- `opportunities/page.tsx:46-51` — 6 hardcoded stage colors
- `sign-in/page.tsx:30-33` — Google brand colors (acceptable)
- `settings/mailboxes/page.tsx:126-130,283-299` — Google/Microsoft brand SVG colors (acceptable)
- `lib/momentum.ts:24` — 1 hardcoded Tailwind arbitrary color

The design system in `globals.css` defines CSS variables (`--color-badge-0` through `--color-badge-9`, `--color-success`, etc.) but **the page components use raw hex values instead of the CSS variables**. These are the SAME colors — the design system was set up but not fully adopted.

## 7. Hardcoded API URLs

**Count: 2 (non-test)**

| File | URL |
|------|-----|
| `lib/apollo-client.ts:6` | `https://api.apollo.io` — acceptable (fixed external API base) |
| `settings/mailboxes/route.ts:38,126` | `http://localhost:3100` as fallback for EmailEngine — hardcoded dev URL |

The `localhost:3100` fallback is a risk if `EMAILENGINE_URL` env var is unset in production.

## 8. Magic Numbers

Several instances:
- `score/route.ts` — numeric weights (25, 15, 10, etc.) for scoring factors without named constants
- `insights/route.ts` — 14 days for stall detection, 20 days in tests
- `tam/route.ts` — batch size of 30 for TAM generation
- `enrich/route.ts`, `enrich-contacts/route.ts` — batch limit of 20
- `deliverability/route.ts` — 7 (days for rate windows), rate thresholds
- Various date arithmetic: `setDate(getDate() + 2)`, etc.

None are extracted to named constants or configuration.

## 9. Error Boundaries (React)

**Count: ZERO**

- No `error.tsx` files exist anywhere in the app directory
- No `loading.tsx` files exist anywhere
- No `ErrorBoundary` component found
- No React error boundaries of any kind

**Assessment: CRITICAL.** Any unhandled error in a React component will crash the entire app to a white screen. Next.js provides `error.tsx` convention for route-level error boundaries — none are implemented. No loading states at the framework level either.

## 10. Loading/Error States in Page Components

Every page component (`"use client"`) manually manages its own loading state via `useState(true)`:

- `accounts/page.tsx` — has loading state, no error state display
- `contacts/page.tsx` — has loading state, no error state display (errors swallowed)
- `opportunities/page.tsx` — has loading state, no error state display
- `deliverability/page.tsx` — has loading state, no error state display
- `sequences/page.tsx` — has loading state, no error state display
- `tasks/page.tsx` — no loading state at all
- `meetings/page.tsx` — not checked (likely similar)
- `notes/page.tsx` — no loading state

**Assessment: POOR.** Every page rolls its own loading pattern. No shared loading UI component. Error states are universally absent — catches are swallowed.

## 11. Auth Checks on API Routes

**50 route files total. Auth coverage:**

| Category | Routes | Count |
|----------|--------|-------|
| Has `auth()` | Most routes | 47 |
| No `auth()` | `chat/route.ts`, `auth/[...nextauth]/route.ts`, `inngest/route.ts`, `webhooks/emailengine/route.ts` | 4 |

- `auth/[...nextauth]/route.ts` — correctly unauthenticated (it IS the auth endpoint)
- `inngest/route.ts` — correctly unauthenticated (Inngest uses its own signing keys)
- `webhooks/emailengine/route.ts` — **SHOULD have webhook signature verification** but doesn't
- **`chat/route.ts` — SECURITY VULNERABILITY. No auth check. Anyone can query the AI assistant and access CRM data via RAG.**

## 12. Input Validation on API Routes

**Zod schema validation on request bodies: 14 routes** (only for LLM output schemas or import schemas)

**Manual validation (typeof/Array.isArray checks): most routes**

**No validation at all: several routes**

No route uses Zod to validate the incoming request body. Zod is only used for:
- LLM `generateObject()` output schemas
- Import CSV field mapping

Manual checks are inconsistent — some check `Array.isArray(ids)`, others just destructure and hope. No shared validation middleware.

## Summary Severity

| Issue | Severity | Count |
|-------|----------|-------|
| Zero error boundaries | CRITICAL | 0 error.tsx files |
| Chat route no auth | CRITICAL | 1 route |
| Swallowed errors | SEVERE | 48 empty catch blocks |
| No structured logging | HIGH | 86 raw console calls |
| No input validation | HIGH | 0 Zod request schemas |
| Hardcoded colors (design system exists but unused) | MEDIUM | ~80 hex values |
| No loading.tsx framework files | MEDIUM | 0 files |
| Magic numbers | LOW | ~20 instances |
| Hardcoded localhost URL | LOW | 1 instance |
| TODO comments | LOW | 2 instances |
