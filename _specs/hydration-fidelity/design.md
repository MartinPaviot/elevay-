# Hydration Fidelity — Design (Kiro)

Per-requirement design decisions. Fixes are small and local; the shared theme is
"load the real value, scope it to the tenant, degrade the lane independently."

## R2 — Account contacts
**Decision:** support `companyId` on `GET /api/contacts` AND drop the redundant
second fetch on the account page.
- `api/contacts/route.ts` GET: read `url.searchParams.get("companyId")`; when a
  valid uuid, add `eq(contacts.companyId, companyId)` to `baseWhere`.
- `accounts/[id]/page.tsx`: prefer `data.contacts` already in the account payload
  (`api/accounts/[id]/route.ts:54-69`); keep the endpoint fix for other callers.
- Edge: invalid `companyId` → ignore the filter (don't 500); 0 contacts → written
  empty state.

## R3 — Deal bookings≠ARR split
**Decision:** investigate storage first (one read), then either surface or remove.
- Check whether `projectAmount`/`platformArr` live on `deals.properties` or are
  real columns. If on `properties`: map them onto the `deal` payload in
  `api/opportunities/[id]/route.ts:82-98`. If never written anywhere: the split is
  correctly absent → remove the dead split branch in `page.tsx:831-852` (or gate it
  behind a real value) so the UI stops advertising a split that can't render.
- Guardrail: bookings≠ARR is load-bearing — do NOT collapse them into one number.

## R4 — Skills registry warm
**Decision:** warm the registry inside the GET handler, idempotently.
- `api/settings/skills/route.ts`: call `registerAllSkills()` (or the idempotent
  warm used by `api/skills/[slug]`) before `listSkills()`. Map system skills with
  their real `steps/constraints/parameters/guidelines` (drop the `hasSteps:false`
  hardcode) so the detail panel is complete.
- Edge: registry empty after warm → written "No system skills".

## R5 — CS Today ARR exposure
**Decision:** write `arrExposureUsd` at snapshot time from real deal/ARR value.
- In the CS health snapshot writer (the daily cron that inserts the snapshot row),
  compute `arrExposureUsd` from the account's open/won deal value and include it in
  the insert.
- If a tenant has no ARR signal, leave null AND soften the header copy
  (`cs/today/page.tsx:89`) so it doesn't promise "risk × ARR".

## R6 — Pricing current plan
**Decision:** client-fetch the tenant plan and mark the matching tier.
- `pricing/page.tsx`: on mount, `GET /api/billing/subscription` → `tenant.plan`;
  derive `currentTier` from the plan; render "Current Plan" + disabled CTA on the
  match; suppress upgrade CTAs for owned tiers. Loading: skeleton on the marker.
  On failure: no current-plan marker (never the wrong one).

## R7 — Notifications Slack webhook hydration
**Decision:** GET also returns the tenant's `settings.slackWebhookUrl`.
- `api/notifications/preferences/route.ts` GET: in parallel with the user prefs
  read, read `tenants.settings` for `authCtx.tenantId`; return
  `slackWebhook: settings.slackWebhookUrl ?? null` in BOTH the defaults branch and
  the real branch. Page already reads `data.slackWebhook` and derives the badge.

## R8 — Billing mailboxes meter (LOW, dev-only)
**Decision:** pass the real connected-mailbox count to the meter.
- `billing-client.tsx:439`: replace `current={0}` with the tenant's mailbox count
  (already available via `/api/billing/usage` or a small count query). Defer until
  the page is un-gated in prod, unless trivial alongside R6.

## R9 — H2 → H1 (per-lane degradation), spine order
**Pattern fix, applied per page (one task each):**
- Replace swallowed `console.warn`-only fetch failures with a per-lane error state
  (written message + retry) so one lane failing never blanks the page.
- Replace global spinners with shape-matching skeletons where a lane loads
  independently.
- Reference implementation: Home `up-next-view.tsx` + the satellite widgets.
- Scope per page = the "Pires défauts" lists in `_reports/hydration-audit/NN-*.md`.

## Testing strategy
- Each route fix gets a vitest regression that asserts the corrected behavior
  (tenant-scoping, field presence, registry warm) using the existing db-mock
  pattern (see `deliverability-api.test.ts`).
- Page-level behavior verified live via Playwright after the route fixes land
  (one browser, per the hard rule).
