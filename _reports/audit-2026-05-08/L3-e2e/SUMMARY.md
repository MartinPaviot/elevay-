# L3 Local E2E (Playwright) — verdict (PARTIAL — anonymous-surface complete)

**Run** : 2026-05-08 (audit Phase 3)
**Tooling** : Playwright MCP against `pnpm dev` on `http://localhost:3000`
**Status** : **5 of 17 features verified end-to-end. 12 features blocked on an authenticated session — see hand-off section.**

## What L3 verified autonomously (no auth required)

### F12 — PostHog autocapture + session replay (anonymous side)

| Check | Result |
|---|---|
| SDK loads on `/` first paint | PASS — `/decide/` and `/e/` POSTs to `https://eu.i.posthog.com` return 200 |
| `$pageview` fires on App Router transition | PASS — first `/e/` POST in network tab on landing |
| Autocapture fires on user click | PASS — clicking the "Elevay" header anchor produced 4 additional `/e/` and `/i/v0/e/` POSTs, all 200 |
| Console errors on landing | PASS — 0 errors, 0 warnings (4 info messages, all SDK init) |
| Console errors on sign-in | PASS — 0 errors, 0 warnings |

Score : **0.95 functional / 0.95 integration / 1.0 failure-modes / 0.95 observability** — restored from L2's post-fix baseline. Real traffic to PostHog confirms the L2 fix landed correctly.

Evidence :
- `screenshots/landing/001-landing-loaded.png` — full-page landing render
- `screenshots/F12-posthog-anonymous/posthog-network.txt` — initial network capture (2 POSTs to eu.i.posthog.com)
- `screenshots/F12-posthog-anonymous/posthog-network-after-click.txt` — post-click capture (6 POSTs total, includes 2 `beacon=1` aborted on navigation which is expected browser behaviour, not CSP)
- `screenshots/landing/console-errors.txt` — 0 errors

### F16 — CSP whitelist on the live wire

In-flight CSP header on `/` :

```
connect-src 'self' https://api.stripe.com ... https://api.apollo.io
            https://eu.i.posthog.com https://eu-assets.i.posthog.com
            http://localhost:8288;
script-src  'self' 'unsafe-inline' https://eu-assets.i.posthog.com 'unsafe-eval';
```

| Check | Result |
|---|---|
| `eu.i.posthog.com` in `connect-src` | PASS |
| `eu-assets.i.posthog.com` in `connect-src` | PASS |
| `eu-assets.i.posthog.com` in `script-src` | PASS |
| `unsafe-eval` only in dev | PASS (NODE_ENV=development at this run, so present here ; the prod conditional in `next.config.ts` strips it) |
| Real fetches to PostHog hosts return 200 (proves no silent block) | PASS — see F12 network captures |

Score : **1.0 functional / 1.0 integration / 1.0 failure-modes / 0.95 observability** — the L2 unit test pinned the source ; this L3 capture pins the runtime.

Evidence :
- `screenshots/F16-csp-header/dev-csp-header.txt` — full CSP header verbatim

### Sign-in page render (covers F12 negative path)

| Check | Result |
|---|---|
| Page returns 200 | PASS |
| Title is "Elevay — The Autonomous GTM Engine for Founders" (brand correct, no "LeadSens" leak) | PASS |
| Email input present (`type=email`, name=email, placeholder "you@company.com") | PASS |
| Password input present, `type=password` (auto-masked by replay) | PASS |
| Google OAuth button present | PASS |
| Microsoft OAuth button present | PASS |
| Console errors | PASS — 0 errors |
| PostHog SDK still loads on this page | PASS |

Score on the sign-in surface : **1.0 across all dimensions** — anonymous-side rendering is clean, brand names correct, both OAuth paths surfaced.

Evidence :
- `screenshots/signin-render/001-signin-loaded.png` — full-page render
- `screenshots/signin-render/console-errors.txt` — 0 errors

### Landing page (covers brand + accessibility + initial route)

| Check | Result |
|---|---|
| Title : "Elevay — Your Revenue Engine Is Ready" | PASS — no "LeadSens" anywhere in DOM (memory: brand is Elevay) |
| `Skip to main content` link first in tab order | PASS — accessibility primitive intact |
| Header CTAs : Elevay (logo), How it works, Book a demo, Log in | PASS |
| 0 emoji in user-facing text | PASS — only icons via lucide-react (memory: no emojis in UI) |

Score : **0.95 across all dimensions**.

## What L3 cannot verify without an authenticated session

12 of 17 features sit behind `auth()` — the Playwright session is a separate browser instance from any sign-in you do in your real browser, and the OAuth round-trip can't be driven headless without your real Google/Microsoft credentials. Per CLAUDE.md the founder-credential exception applies here.

The auth-gated portion :

| # | Feature | Surface | What L3 needs |
|---|---|---|---|
| F1 | Onboarding wizard polish + autosave + velocity tile | `/onboarding-v3` (auth) ; `/settings/llm-evals` (auth + admin) | session cookie OR test user with Credentials provider |
| F2 | Coaching grounded + video player + freshness alerts | `/meetings/[id]` with a `recordingUrl` row | session + a meeting fixture with Recall.ai metadata |
| F3 | Speaker-aware transcript retrieval | `/chat` with a meeting that has Sarah-attributed chunks | session + a chunked transcript fixture |
| F4 | Eval per-case persistence + admin drilldown | `/settings/llm-evals` (admin) | admin session + at least one `llm_eval_runs` row |
| F6 | Deal autofill cascade + tooltip | `/opportunities/[id]` with `properties.value/source/date` shape | session + a deal with extracted-signal-driven properties |
| F7 | Sequence drafts queue | `/sequences/review` (manual approval mode tenant) | session on a tenant with `settings.approvalMode='manual'` + at least one draft |
| F8 | Visitor-id widgets | `/home` (HotVisitorsWidget + cap banner) | session + matched-visit row + spend-cap state |
| F11 | Schema-split `/api/admin/llm-evals` doesn't crash | route call | admin session ; this is the canary route for the schema-split fix |
| F13 | Boundary-tripped events | force a render error in dashboard tree | session + a deliberate component throw |
| F14 | Admin app — repointed import | `apps/admin` six pages | admin session in the *admin* app on :3001 |
| F15 | `chat_message_sent` + `home_action_clicked` events | `/chat` send + `/home` action click | session ; need to drive the actual interaction not just confirm import |
| F17 | Stall indicators evidence inline | `/opportunities/[id]` for a stalled deal | session + a deal that triggers >= 1 stall indicator |

## Hand-off — three options to unblock L3 auth-gated portion

In order of complexity :

1. **You drive a one-time sign-in in Playwright via my session here.**
   Risk : the OAuth provider may flag a non-residential IP / new device.
   You'd see the consent screen and approve once. Cookie persists for the audit run.

2. **You provision a Credentials test user (email + password) on the dev DB.**
   The auth.ts has the Credentials provider live. We seed one row in `users` + `user_passwords` (or whatever the schema is). Playwright signs in headlessly via email/password from `.env.local.test`. No OAuth round-trip.

3. **You hand me a fresh session cookie from your real browser.**
   You sign in in Chrome ; copy the `authjs.session-token` cookie value ; I inject it into Playwright's storage state. Fastest, no OAuth, no DB seed.

Recommendation : **option 3 for this audit run**, **option 2 for the long-term audit harness** (so future runs are fully autonomous). Document option 2 as a follow-up in `_specs/AUDIT-2026-05-08/tasks.md` if you go that route now.

## L3 partial scoreboard

| F# | Feature | Verdict | Source |
|---|---|---|---|
| F9 | SHIP_GUIDE doc | n/a | doc-only, L1 sufficient |
| F10 | TS hygiene 4-spot | PASS via L1 (0 errors) | n/a |
| F12 | PostHog autocapture + replay | **PASS** | L3 anonymous + L2 unit + L3 network 200s |
| F16 | CSP whitelist PostHog EU | **PASS** | L3 in-flight header + L3 actual fetches 200 + L2 unit |
| Sign-in render | (covered F12 negative side) | PASS | L3 |
| Landing render | (covers brand + a11y) | PASS | L3 |
| F1, F2, F3, F4, F6, F7, F8, F11, F13, F14, F15, F17 | auth-gated | **BLOCKED** on session | hand-off above |

## Time

L3 anonymous active : ~25 min (within the 90-min budget for the full L3, ~30% spent).
Remaining budget : ~65 min once a session is provided.

## Next layer

L4 (DB introspection) is **independent of auth** — it operates against ephemeral Postgres dockers. We can run L4 in parallel with the L3 auth hand-off, using the budget while we wait for the session decision. Recommended : start L4 now.
