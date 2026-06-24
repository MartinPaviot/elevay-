# Hydration Fidelity — Requirements (Kiro)

_Source: `_reports/hydration-audit/` (T1 spine 36p, T2 settings 38p; T3 peripheral
auditing). Reference bar = the Home page (`01-home.md`): every lane wired to real
tenant-scoped data, degrades independently to a written empty state, self-hides
when empty._

## Goal

Bring every data-bearing element of the product up to **H1 (faithful)**: its
value loads from real tenant-scoped persisted data, saves round-trip, and the
loading / empty / error states are handled per-lane. P0 = the H5 (broken) and H4
(unwired) elements where the displayed value is WRONG or never loaded.

Rubric H0–H5 and the full per-page tables live in `_reports/hydration-audit/`.

---

## P0 — broken / unwired (the displayed value is wrong or never loads)

### R1 — Deliverability: tenant-scope the enrollment-status breakdown — DONE
**Status: shipped on `fix/deliverability-tenant-leak` (305cf5a2), not merged.**
- WHEN `/api/deliverability` runs on default load (no `sequenceId`), the system
  SHALL filter `sequenceEnrollments` by `authCtx.tenantId`.
- Acceptance — GIVEN two tenants with enrollments, WHEN tenant A opens
  `/deliverability`, THEN the "Sequence Enrollments" panel SHALL count ONLY
  tenant A's enrollments. (Regression test in `deliverability-api.test.ts`.)

### R2 — Account detail: show THIS account's contacts
Evidence: `accounts/[id]/page.tsx:90` fetches `/api/contacts?companyId=<id>`, but
`api/contacts/route.ts` GET (`:29-70`) never reads `companyId` → returns the first
50 of ALL tenant contacts. The correctly-scoped set is already in the
`/api/accounts/[id]` payload (`route.ts:54-69`) and discarded.
- WHEN the account-detail page renders "Contacts at this account", the system
  SHALL display only contacts linked to that account.
- WHEN `/api/contacts` receives a `companyId` query param, it SHALL filter
  contacts to that company (tenant-scoped).
- Acceptance — GIVEN account X with 3 contacts and the tenant has 200 contacts,
  WHEN the user opens account X, THEN "Contacts (N)" SHALL read 3 and list those 3.
- Edge: account with 0 contacts → written empty state, not a blank lane.
- Design choice to resolve: reuse the account payload's contacts (frontend-only,
  smaller blast radius) VS add `companyId` support to `/api/contacts` (fixes the
  endpoint for every caller). Lean: support `companyId` on the endpoint AND drop
  the redundant second fetch — fixes both the bug and the wasted round-trip.

### R3 — Opportunity detail: real bookings≠ARR split (or remove the dead UI)
Evidence: `opportunities/[id]/page.tsx:831-852` renders Project bookings / Platform
ARR / Total via `getDealAmountDisplay`, but `api/opportunities/[id]/route.ts:82-98`
returns only `value` (no `projectAmount`/`platformArr`) → `isSplit` always false.
Note: `route.ts:89` returns `properties: deal.properties`.
- INVESTIGATE FIRST: are `projectAmount` / `platformArr` stored on `deal.properties`
  (or columns)? If present → surface them so the split renders. If never written →
  the split is correctly hidden; then the dead split UI SHALL be removed OR the
  fields populated at deal-write time.
- WHEN a deal has a project-bookings + platform-ARR split, the detail page SHALL
  show both lines and the combined total. (bookings≠ARR is a load-bearing rule.)
- Acceptance — GIVEN a deal with projectAmount=10k and platformArr=2k/mo, WHEN
  opened, THEN the right rail SHALL show both, not a single `value`.

### R4 — Skills: System skills must load on a cold process
Evidence: `api/settings/skills/route.ts:6,19` calls `listSkills()` against the
in-memory registry, but never calls `registerAllSkills()` (only `api/skills/[slug]`
does). Cold process → System section + Explore tab render empty. System skills also
map with `useCount:0/lastUsedAt:null/hasSteps:false` (`:27-30`) → thin detail.
- WHEN `GET /api/settings/skills` runs, the system SHALL ensure the skill registry
  is populated (call `registerAllSkills()` / idempotent warm) before `listSkills()`.
- WHEN mapping a system skill, the response SHALL include its real
  steps/constraints/parameters/guidelines so the detail panel is complete.
- Acceptance — GIVEN a freshly-started server, WHEN the user opens `/skills`,
  THEN the System section and Explore tab SHALL list the registered skills.
- Edge: registry genuinely empty → written "No system skills" (not a blank tab).

### R5 — CS Today: wire ARR exposure end-to-end (or stop advertising it)
Evidence: `arrExposureUsd` is READ (badge `cs/today/page.tsx:156`, sort tie-breaker
`api/cs/today/route.ts:105`) and NEVER written (no write anywhere in `src`). Header
copy claims "ranked by risk × ARR" (`page.tsx:89`).
- WHEN the CS health snapshot is computed, the cron SHALL write `arrExposureUsd`
  from the account's real ARR/deal value.
- WHEN ARR is genuinely unknown for a tenant, the header copy SHALL NOT promise
  "risk × ARR" ranking; the badge SHALL self-hide (already does).
- Acceptance — GIVEN an account with a won/active deal value, WHEN its snapshot
  is built, THEN `arrExposureUsd` SHALL be non-null and the badge SHALL render and
  participate in the sort tie-break.

### R6 — Pricing: reflect the tenant's real current plan
Evidence: `pricing/page.tsx:19-62` is a hardcoded `tiers` array; `cta:"Current Plan"`
is pinned to Free Trial (`:25`). The page never calls the existing tenant-scoped
`/api/billing/subscription` (`route.ts:36-44` returns `tenant.plan`).
- WHEN the pricing page loads, the system SHALL fetch the tenant's plan and mark
  the matching tier as "Current Plan", disabling its CTA.
- Tiers the tenant already owns SHALL NOT show an upgrade CTA.
- Acceptance — GIVEN a Starter tenant, WHEN opening `/pricing`, THEN "Current
  Plan" SHALL appear on Starter (not Free Trial), and Starter's button SHALL be
  inert.
- States: loading skeleton on the plan marker; on fetch failure, fall back to no
  current-plan marker (never the wrong one).

### R7 — Notifications: Slack webhook must re-hydrate on load
Evidence: `api/notifications/preferences/route.ts:39-43` GET returns
`{emailEnabled, inAppEnabled, preferences}` only; the webhook is persisted in
`tenants.settings.slackWebhookUrl` (PUT `:57-62`) and read by the client as
`data.slackWebhook` (`notifications/page.tsx:68`) → always blank after reload.
- WHEN `GET /api/notifications/preferences` runs, it SHALL also read the tenant's
  `settings.slackWebhookUrl` and return it as `slackWebhook`.
- Acceptance — GIVEN a tenant that saved a Slack webhook, WHEN they reopen
  `/settings/notifications`, THEN the webhook input SHALL be pre-filled and the
  "Connected" badge SHALL show.

### R8 — Billing: Mailboxes usage meter must count real mailboxes (LOW — dev-only)
Evidence: `settings/billing/billing-client.tsx:439` hardcodes the Mailboxes meter
`current={0}`. The whole page is gated off in production
(`lib/billing/page-visibility.ts:9`), so this only renders on dev.
- WHEN the billing page renders the Mailboxes meter, it SHALL use the tenant's
  real connected-mailbox count.
- Priority: LOW (page hidden in prod). Fix opportunistically with R6/billing work.

---

## P1 — the dominant H2 pattern: independent lane degradation

38 pages are H2 (real tenant data, but a missing state). The recurring gap vs the
Home bar: a fetch failure is swallowed (`console.warn`) or blanks the WHOLE page,
instead of the failing lane degrading on its own to a written error/empty.

### R9 — Per-lane degradation on the H2 pages
- WHEN a single data lane's fetch fails, the system SHALL degrade THAT lane to a
  written error/empty state and keep the rest of the page usable (Home bar).
- WHEN a lane is loading, it SHALL show a skeleton matching its final shape, not a
  global spinner or a blank.
- Scope: enumerated per page in `_reports/hydration-audit/NN-*.md` "Pires défauts".
  Implement in spine order (02→36), then settings. Tracked as one task per page in
  `tasks.md`.

---

## Out of scope
- T3 (auth/marketing/legal): mostly static-by-design (H0). Defects, if any, fold
  into this spec after the T3 audit completes.
- Visual/feel (F-track) — separate from data hydration. See `feedback_inbox-feel-gap`.
