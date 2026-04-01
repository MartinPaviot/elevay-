# Next Loop Prompt — Quality & UX/UI Parity

## Context
52/53 features built, 99 tests, Phase 6 eval PASS (0.79). Data seeded.
Now we need to close the gap between "features exist" and "product-grade
quality" — matching Lightfield's polish and Monaco's intelligence depth.

## STATE SNAPSHOT (2026-04-01):
- Branch: main, commit ba66ed9
- 52/53 features passing (F2.2 Calendar blocked — Google OAuth)
- 99 tests across 19 files, all passing
- Production build passes
- DB: Supabase, 18 tables, 50 enriched accounts, 20 scored, 10 deals
- Dev server: `cd app/apps/web && npx next dev --port 3002`
- Auth: credentials provider (email: any, password: any)

## PRIORITY 1: Technical Reliability (avoid demo-breaking bugs)

### 1A. E2E Test Suite with Playwright
Write 10 critical-path E2E tests that run against the live dev server:
1. Sign in → dashboard loads with greeting
2. Navigate to Accounts → see enriched data in dense table
3. Click account → detail page with scoped chat
4. Send chat message → AI response streams with markdown
5. Navigate to Opportunities → see pipeline analytics + kanban with deals
6. Click "+ Create Deal" → form works, deal appears in kanban
7. Navigate to Contacts → 100 contacts visible with enriched status
8. Navigate to Sequences → empty state with CTA
9. Navigate to Settings → 7 sections, profile editable
10. Navigate to all sidebar links → no 404s

Save to `app/apps/web/e2e/` with `playwright.config.ts`.

### 1B. Error Boundaries
Add error boundaries to:
- Layout level (catch any page crash → show "Something went wrong" + retry)
- Chat component (catch streaming errors → show inline error)
- API routes (ensure all return proper error JSON, never crash silently)

### 1C. Loading States
Replace all "Loading..." text with skeleton screens per design-language.md:
- Accounts page: table skeleton rows
- Opportunities page: kanban skeleton columns
- Account detail: content skeleton
- Dashboard: card skeletons (already partially done)

### 1D. Toast Notifications
Add a toast system for user actions:
- "Account enriched successfully" / "Enrichment failed"
- "Deal created" / "Score updated"
- "Settings saved"
- "Chat message failed to send"
Use a simple toast context + component, no external lib needed.

## PRIORITY 2: UX/UI Parity with Lightfield

### 2A. Onboarding Flow
Lightfield has a guided first-run experience. Build:
- First login detection (no accounts yet)
- Step-by-step: "Welcome" → "Describe your ICP" → "Build TAM" → "Start chatting"
- Progress indicator (3-4 steps)
- Skip option

### 2B. Chat Citations with Hover Preview
Lightfield shows inline [source] links that expand on hover. Upgrade chat:
- When RAG context is used, show [Contact: Sarah Chen] or [Account: DataForge] inline
- On hover: mini card with key details
- Click: navigate to the entity page
This requires the API to return source references alongside the text.

### 2C. Inline Editing on Tables
Lightfield lets you edit fields directly in table cells:
- Click a cell → inline edit mode
- Tab to next cell
- Start with: company name, domain, lifecycle stage
- Auto-save on blur

### 2D. Drag-and-Drop Pipeline
The kanban should support drag-and-drop to move deals between stages:
- Use @dnd-kit/core (or HTML5 drag API)
- Visual feedback: ghost card, drop zone highlight
- Update deal stage on drop via API
- Optimistic update

### 2E. Keyboard Shortcuts
Add global shortcuts like Lightfield:
- `Cmd+K` → Global search (open search bar focused)
- `Cmd+N` → New chat
- `Cmd+Shift+A` → Go to Accounts
- `Cmd+Shift+O` → Go to Opportunities
- `/` → Focus chat input
Show shortcut hints in sidebar items on hover.

### 2F. Confirmation Dialogs
Add confirmation for destructive actions:
- Delete account/contact/deal
- Remove sequence enrollment
- Discard unsaved changes (navigate away from dirty form)

## PRIORITY 3: UX/UI Parity with Monaco

### 3A. Pipeline Trend Charts
Monaco shows time-series analytics. Add to /opportunities:
- Pipeline value trend (last 30 days, line chart)
- Win rate trend
- Stage conversion funnel
Use Recharts (already common in React projects).

### 3B. Deal Coaching Panel
Monaco has AI deal coaching. Enhance deal detail page:
- "Coach me" button → AI analyzes deal context and suggests specific actions
- Risk factors with recommended mitigations
- Competitive positioning advice
- Next best action

### 3C. Activity Heatmap
Monaco shows engagement patterns. Add to dashboard or accounts:
- 7x52 heatmap grid (GitHub-style) showing interaction density
- Hover: "3 emails, 1 meeting on March 15"
- Color intensity = activity level

### 3D. Score Trends & Sparklines
Monaco shows score history. Enhance accounts table:
- Mini sparkline next to each score showing trend (last 4 data points)
- Score change indicator (↑ +5, ↓ -3)

## PRIORITY 4: Data Quality & Realism

### 4A. Seed Realistic Activities
Create activities (emails, meetings, notes) linked to contacts and deals:
- 50+ activities across the 10 deals
- Date distribution over last 30 days
- Mix of types: email_sent, email_received, meeting, note, call
This makes the dashboard, timelines, and analytics meaningful.

### 4B. Detect Signals on Enriched Accounts
Run signal detection (via /api/signals) on all enriched accounts.
The signal column should show colored badges, not just "—".

### 4C. Score All Remaining Accounts
Run scoring on the 30 remaining unscored accounts.

## PRIORITY 5: Lightfield Trial Testing (expires 2026-04-13)

### 5A. Continue Teardown
The Lightfield trial expires in 12 days. Prioritize testing:
- Pipeline management (how Lightfield handles deals vs our kanban)
- Chat quality (run same queries on both, compare)
- Data capture flow (how they auto-capture from email)
- Export capabilities
- API/webhook documentation
Save all findings to `_research/teardown-lightfield-v2/`

## Execution Order
1. E2E tests (1A) — safety net before any changes
2. Loading states + toasts (1C, 1D) — quick polish wins
3. Error boundaries (1B) — crash protection
4. Seed activities (4A) + score/signal remaining (4B, 4C) — data realism
5. Drag-and-drop pipeline (2D) — highest UX impact
6. Chat citations (2B) — Lightfield's killer differentiator
7. Pipeline trends (3A) — Monaco's data depth
8. Onboarding flow (2A) — first impression
9. Inline editing (2C) — power user productivity
10. Remaining items in priority order

## Rules
- Override: skip checkpoints, log them, keep building. Don't ask anything.
- Commit after every completed item.
- Run `npx vitest run` after every code change.
- Screenshot before/after for every visual change.
- Write regression tests for every bug found.
