# 22 — deliverability (`/deliverability`) — audit d'hydratation

**Verdict global : H5 (cassé).** The /deliverability page is largely faithfully hydrated: KPIs (Sent/Open/Reply/Bounce/Spam/Replied), week-over-week trend arrows, mailbox health cards, recommendations, and the DNS auth checker all trace to real, tenant-scoped data from /api/deliverability and /api/deliverability/verify with loading skeleton + empty state + null-data fallback handled. The single meaningful defect is a TENANT LEAK: the "Sequence Enrollments" panel's enrollmentsByStatus is queried across ALL tenants (no eq(tenantId)) on default page load, so it shows other tenants' enrollment counts. Secondary: the page has no per-element error degradation (one fetch failure blanks the whole page) and freshness is fetch-once-on-mount with no refresh.

Entrée : `app/apps/web/src/app/(dashboard)/deliverability/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Header Health Score + label badge | page.tsx:367-383 | GET /api/deliverability healthScore/healthLabel (route.ts:174-187) | H1 | yes | skeleton | handled | global | once | Real tenant-scoped; computed from tenant-filtered outboundEmails. Empty handled via totalSent===0 'No emails sent yet' badge. |
| KPI: Sent | page.tsx:465-470 | route.ts:23-35 count() of outboundEmails where tenantId=ctx (line 19-20,33) | H1 | yes | skeleton | handled | global | once | faithful |
| KPI: Open Rate + trend arrow | page.tsx:471-485 | route.ts:43 openRate; prevWeek.openRate route.ts:163-171 | H1 | yes | skeleton | handled | global | once | Real tenant-scoped rate + real WoW trend (prev 7-14d, tenant-filtered). |
| KPI: Reply Rate + trend | page.tsx:486-500 | route.ts:44 replyRate; prevWeek route.ts:163-171 | H1 | yes | skeleton | handled | global | once | faithful |
| KPI: Bounce Rate + trend (color-banded) | page.tsx:501-517 | route.ts:45 bounceRate; prevWeek route.ts:167 | H1 | yes | skeleton | handled | global | once | faithful |
| KPI: Spam Rate + trend | page.tsx:518-532 | route.ts:49-54 spamRate (bounceType='complaint', tenant-filtered) | H1 | yes | skeleton | handled | global | once | faithful |
| KPI: Replied | page.tsx:533-538 | route.ts:27 totalReplied | H1 | yes | skeleton | handled | global | once | faithful |
| Recommendations (critical/warning/info banners) | page.tsx:392-450 | derived client-side from data via getRecommendations (page.tsx:52-128) | H1 | yes | skeleton | handled | global | once | Derived from real tenant-scoped metrics + mailboxHealth; self-hides when no recs. |
| Legacy API warnings | page.tsx:452-461 | route.ts:190-194 warnings[] | H1 | yes | skeleton | handled | global | once | Real, tenant-derived; only shown when recommendations empty. |
| Mailbox Health cards (email, status, health, sent/limit, bounces, usage bar) | page.tsx:542-591 | route.ts:110-121 connectedMailboxes where tenantId=ctx | H1 | yes | skeleton | handled | global | once | Tenant-scoped per-mailbox real data; section self-hides when none. No 'as of' timestamp (stale risk). |
| Sequence Enrollments panel (status -> count chips) | page.tsx:594-610 | route.ts:99-101 sequenceEnrollments status — NO tenantId filter on default load | H5 | no | skeleton | handled | global | once | TENANT LEAK: enrollment counts are aggregated across ALL tenants (query lacks eq(sequenceEnrollments.tenantId)); column exists at outbound.ts:133 but is unused unless sequenceId param is passed. |
| DNS Auth check (SPF/DKIM/DMARC/MX rows + score + recs) | page.tsx:164-280, 386-389 | POST /api/deliverability/verify real DNS lookups (verify/route.ts:15-138) | H1 | n/a | spinner | handled | independent | once | Real on-demand DNS resolution; has its own loading ('Checking...'), inline error, and result state. Domain prefilled from first mailbox. Not tenant-data (DNS is global) so tenantScoping n/a. |

## Pires défauts

1. TENANT LEAK: Sequence Enrollments panel — enrollmentsByStatus query at app/apps/web/src/app/api/deliverability/route.ts:99-101 selects from sequenceEnrollments with NO tenantId filter on default load (only filters by sequenceId when provided). sequenceEnrollments.tenantId exists (db/schema/outbound.ts:133) but is ignored, so the panel at page.tsx:594-610 renders cross-tenant enrollment counts.
2. No independent/per-element error degradation: a single /api/deliverability failure sets data=null and replaces the ENTIRE page with 'Failed to load deliverability data.' (page.tsx:344-353, 287-292) — unlike the Home reference where each lane degrades independently.
3. Stale/no-refresh freshness: deliverability data is fetched once on mount with no polling/refetch (page.tsx:286-292); connectedMailboxes.sentToday/healthScore/bounceCount7d are shown as-is with no 'as of' timestamp, so the mailbox cards (page.tsx:548-588) can silently show stale capacity.
