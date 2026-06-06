# Elevay — Pre-Launch PM Review (2026-06-06)

**Reviewer:** Claude, acting as PM doing a hostile pre-launch walkthrough.
**Scope:** clicked through every user-facing page + global controls, and stress-tested the chat end-to-end against the real Pilae dataset (tenant `47dca783`, logged in as martin@elevay.dev).
**Environment:** local dev (`localhost:3000`), branch `fix/audit-fluidity`. Detailed evidence + per-page log in `FINDINGS.md`; screenshots in `screenshots/` (001–041).

> **Important environment caveat.** This machine MITM-intercepts TLS to `api.openai.com` / `api.anthropic.com` ("unable to verify the first certificate"), so the chat failed until I relaunched dev with cert-verification relaxed (dev-only). Everything below about chat *behaviour* was observed with that workaround; the *connectivity* failure itself is environmental (proxy/AV), not app code.

---

## Verdict: NOT ready to ship. ~1 focused week of fixes.

The shell is genuinely impressive — the chat's rendering, the command palette, account dossiers, empty states and dashboards are production-grade. **But the flagship promise — "ask your pipeline and trust the answer" — is currently false**, because the chat reports deleted records as live data and disagrees with the UI on every core number. That single class of bug, plus a one-click "delete everything" button and a broken/duplicated onboarding, are the things that would burn a first customer.

Fix the P0s and the P1 cluster and this is a strong launch.

---

## P0 — Launch blockers

1. **The chat reports SOFT-DELETED data as live and contradicts the UI on every core metric.** (Evidence: screenshots 031/034; DB-verified.)
   - "How many accounts/contacts?" → chat says **2,287 accounts / 519 contacts**; UI shows **767 / 0**.
   - "Pipeline summary" → chat says **$618,999 across 12 open deals**, lists deal names, and coaches "close SmartGrid this week"; Opportunities/Home/Insights show **0 deals / $0**.
   - Root cause: the `deals` table's 13 rows and all 519 contacts carry `deleted_at` (2026-06-05 cleanup). The UI filters soft-deletes; **the chat's data tools don't**. It's even tool-inconsistent (one contact tool returned 0, the count tool returned 519).
   - **Fix:** every chat tool must apply the same tenant + `deleted_at IS NULL` + entity-definition filters as the UI — ideally share one query layer. Add a regression test asserting chat counts == UI counts.

2. **Chat doesn't complete in any environment I can reach.** Local = TLS MITM (above); prod = LLM key missing (per prior audit, `/api/chat` 500). The flagship feature is down everywhere right now. **Fix:** set the prod LLM key + verify; document local egress needs (`NODE_EXTRA_CA_CERTS`). Make it demonstrably work before any demo.

3. **"Delete all" button in the Accounts toolbar** — title literally "Delete every account in this workspace", sitting next to Signals/Enrich/Create. One mis-click wipes all 767 accounts. Looks like a leftover dev tool. **Fix:** remove from the toolbar (or bury in Settings → Data behind typed confirmation). (Screenshot 006.)

---

## P1 — Fix before launch

4. **Onboarding is broken as a first impression.** (Screenshots 003/004/041.)
   - Auto-opens a setup modal **over an already-populated home** for an established tenant (767 accounts).
   - The modal is **not dismissable** — `role="dialog"` but no close/Esc, no backdrop, no focus trap; only exit is "build my pipeline" (which triggers paid enrichment).
   - **Two onboarding systems coexist**: this one-screen modal AND the live 7-phase wizard at `/onboarding-v3` (linked from the home "7 phases left" card). Pick one; delete the other.
   - React error on edit: `setState during render` in `OnboardingConfirmationCard`.

5. **Notes feature is broken.** `GET /api/notes` → 500 (malformed array query at `src/app/api/notes/route.ts:48`: `ANY(($1,$2))` instead of a single array param). The "No notes yet" empty state masks the error. (Screenshot 019; server log.)

6. **Account detail: invalid HTML + misleading AI state.** `<button>` nested in `<button>` (in `CompanyDossier`) throws a React hydration error every load; ICP-fit shows "50%" while text says "scoring unavailable (LLM not configured)"; competitive analysis "unavailable" despite keys. (Screenshot 008.)

7. **Chat failure UX & polish.** Fails in ~22s after 3× retries; `/api/chat` returns **HTTP 200 on total failure** (invisible to monitoring); generic "Something went wrong"; "top N by X" is computed over a recent subset (not all rows); **emoji in output** (🔴🟠🟡 — violates the no-emoji brand rule); internal tool names leak to users ("runBasicReport", "executeCode", "briefAllDeals").

8. **Account/sign-out menu is hover-only.** The footer (avatar+name) has `cursor:default`, no click handler, no focusable trigger; the menu (Settings/theme/**Log out**) only appears on mouseenter → undiscoverable, keyboard-inaccessible, broken on touch. It's the only path to sign out. Make it a real button.

9. **Not responsive (if mobile is in scope).** At 390px the full desktop sidebar still renders; content squeezed to ~150px, text wraps one word per line, no hamburger. (Screenshot 040.)

---

## P2 — Polish (post-launch acceptable, but cheap wins)

- **Consistency of naming:** sidebar "Opportunities" vs title "Pipeline"; sidebar "Campaigns" vs url `/sequences` vs title "Sequences". Pick one noun each.
- **Browser tab titles:** many pages fall back to the generic default (account detail, brain, proposals, inbox, call-mode, insights, knowledge, skills, settings). Add per-route titles.
- **Pluralization:** "1 steps", "SEQUENCE (1 STEP · 1 DAYS)".
- **Score shown inconsistently:** account detail "Not scored" vs brain "0.8" for the same company.
- **Notifications panel** opens to a blank void — no "you're all caught up" empty state.
- **Skills** ships with System(0) — no starter skills (empty on day one for an "autonomous" product).
- **Insights** is thin (just a pipeline block) + slow (~8s skeleton); its sub-routes (`/insights/pilae|hot-to-call|playbook`) are orphans (not linked anywhere).
- **Accounts:** two search inputs (NL "Smart search" + plain) on one page.
- **Tasks:** Overdue badge says 2 but 3 items show "overdue".
- **Brain page** leaks internal jargon ("Graph facts", "Memories") to end users.
- **Custom 404 missing** (bare Next.js default, no "back home").
- **French date strings** ("sam. 6 juin") in otherwise-English chrome.
- **Inconsistent greeting** ("Good morning" vs "Welcome back").
- **Home** shows 3 different enrichment denominators (1202 vs 767) on one screen.
- **Chat follow-up chips** sometimes mismatched ("Draft an email to them" after a count).

---

## What's genuinely strong (don't touch)

- **Chat rendering layer** — real HTML tables, clickable entity chips/links, bolded numbers, collapsible tool steps with ✓ and inline result counts, per-message Copy, context-aware follow-up chips, concise answers, **strong anti-hallucination** (refused to invent a CEO), honest caveats. The *presentation* is best-in-class.
- **Command palette** (sidebar Search) — fuzzy entity search with logos, grouped results, keyboard hints. Excellent.
- **Account research dossier** — funding, 23-item tech stack, hiring-signal interpretation ("uses Salesforce — may be looking for alternatives"). Real differentiation.
- **Empty states** across Contacts/Meetings/Inbox/Call Mode — human copy + the right 2 CTAs. Boils the lake on dead-ends.
- **Deliverability dashboard, Opportunities Kanban, Reports** — complete and professional.
- **Onboarding modal structure** — provenance chips ("AI · elevay.dev"), live TAM count. Right idea, wrong gating.
- Dark mode, skeleton loaders, no-emoji discipline in UI chrome (holds everywhere except chat output).

---

## Suggested fix order (one week)

1. **Day 1–2:** Chat data correctness (P0 #1) — share the UI's filtered query layer across all chat tools; regression test chat==UI. Set prod LLM key (P0 #2).
2. **Day 2:** Remove "Delete all" (P0 #3); fix `/api/notes` query (P1 #5); fix nested-button hydration (P1 #6).
3. **Day 3:** Onboarding — one system, dismissable, don't show to set-up tenants (P1 #4).
4. **Day 4:** Chat polish — fail-fast + 5xx on error + specific copy; server-side sort for top-N; strip emoji + tool-name labels (P1 #7). Sign-out button (P1 #8).
5. **Day 5:** P2 sweep (titles, naming, pluralization, 404, notifications empty state) + responsive sidebar if mobile is in scope.
