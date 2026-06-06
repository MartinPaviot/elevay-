# Pre-launch audit — fixes applied (2026-06-06)

Branch `fix/audit-fluidity`. Verification: `tsc --noEmit` clean · `next build` succeeds · `vitest run` = 3233 passed, 2 failed (pre-existing, flagged below), 1 skipped. No regressions introduced.

## Commits
- `5d5079c9` — P0 chat soft-delete + delete-all footgun + notes 500
- `db15b971` — P1 chat no-emoji/labels, account-detail hydration, sign-out a11y, onboarding dedup/dismiss
- `fbab051a` — P2 branded 404, page titles, term/plural consistency, English date, responsive sidebar (+ stale-test alignment)

## P0 (launch blockers) — DONE
- **Chat reported soft-deleted records as live** (2,287/519/$618k vs UI 767/0/$0). Added `deleted_at IS NULL` to every chat data path: `chat/tools/query.ts`, `chat/tools/intelligence.ts`, `chat/tools/forecast.ts`, `deals/deal-briefing.ts`, `sandbox/crm-bridge.ts` (activities), `analysis/win-loss-engine.ts`. (`stall-predictor.ts` already filtered.) DB-verified the gaps were 100% soft-deletes. Added `__tests__/chat-soft-delete-guard.test.ts` so every chat `.from(<soft table>)` must filter `deletedAt`.
- **"Delete all accounts" toolbar footgun** — removed the always-visible button from `accounts/page.tsx` (bulk/single delete + Settings → Privacy remain).
- **`GET /api/notes` 500** — replaced malformed `ANY(($1,$2))` with drizzle `inArray` (`api/notes/route.ts`).

## P1 — DONE
- Chat: forbid emoji in output (system prompt); friendly tool-step labels + humanizing fallback (`tool-call-panel.tsx`) so internal names (runBasicReport/executeCode/…) never leak.
- Account detail: fixed `<button>`-in-`<button>` hydration error (`company-dossier.tsx` header → role=button div, keyboard-accessible); render "Not scored" instead of a contradictory ICP % when scoring is unavailable.
- Sidebar: account/sign-out menu is now a focusable `<button>` (click + keyboard + Escape), not hover-only.
- Onboarding: fixed setState-in-render in `OnboardingConfirmationCard` (notify parent via effect); made the modal dismissable (Escape + "Skip for now", sticky); removed the duplicate 7-phase wizard banner → single onboarding surface.

## P2 — DONE
- Branded global `not-found.tsx` (Back to home / Ask Elevay).
- Per-route titles: proposals, inbox, call-mode, insights, knowledge, skills.
- Term consistency: tab titles "Opportunities" (was Pipeline), "Campaigns" (was Sequences).
- Pluralization: "1 step / 1 contact / 1 day".
- English chrome date on home (was `navigator.language` → "sam. 6 juin").
- Sidebar auto-collapses below 768px (mobile).

## NOT changed — needs Martin's decision (flagged, not silently "fixed")
- **Chat connectivity is environmental, not code.** Local fails TLS to api.openai/anthropic (MITM proxy on this machine — Neon DB TLS works); prod is missing the LLM key. Action: set the prod LLM key + verify; for local, set `NODE_EXTRA_CA_CERTS` (or run off the intercepting network).
- **EU data-residency ("Sovereignty pack") is NOT active.** `smoke-product.test.ts` expects EU-by-default but `ANTHROPIC_REGION=eu` is absent from `.env.local`, so LLM calls route to US Anthropic. For a GDPR/EU product this is a real gap — but enabling EU routing is a compliance/config decision (and the smoke test also carries the old non-`/v1` URL). Left the 2 smoke tests red on purpose rather than mask it. Decide: set `ANTHROPIC_REGION=eu` (local + prod) + update the smoke URL to `https://eu.anthropic.com/v1`.
- Chat route returns HTTP 200 on a fully-failed stream — largely inherent to streaming (the client already surfaces the error); deferred.
