# 25 — insights-hot-to-call (`/insights/hot-to-call`) — audit d'hydratation

**Verdict global : H1 (fidèle).** This page is faithfully hydrated. Every data-bearing element (name, company, title, phone, hotness, headline signal, signal chips, speed-window badge, refresh meta) traces to real tenant-scoped data from GET /api/dashboard/hot-to-call, which joins outboundEmails/visits/contacts/companies with eq(tenantId) on every query (route.ts:110,117,151,158,251) and computes hotness via lib/hot-to-call/scoring.ts. Loading ('Loading…'), a written empty state, and an independent error banner are all handled, matching the Home reference bar. The only nit is H2: loading surfaces only as a text label in the meta line — there's no skeleton/spinner for the card list during the initial fetch.

Entrée : `app/apps/web/src/app/(dashboard)/insights/hot-to-call/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Page header (title/subtitle) | page.tsx:145-148 | static (PageHeader props) | H0 | n/a | n/a | n/a | n/a | static | pure chrome label, correctly static |
| Window chips (Last hour / 24h / 7d) | page.tsx:152-167 | local useState `hours` (page.tsx:64) | H0 | n/a | n/a | n/a | n/a | n/a | client-side filter control, not data-bearing; correctly static |
| Refresh meta line (N contacts · last refresh time · window Nh) | page.tsx:172-181 | GET /api/dashboard/hot-to-call -> items.length/generatedAt/windowHours (route.ts:318-322) | H1 | yes | none | handled | independent | poll | real tenant-scoped counts + server generatedAt; shows 'Loading…' until first response |
| Error banner | page.tsx:184-195 | fetch error/!res.ok (page.tsx:122-131) | H1 | n/a | n/a | n/a | independent | poll | independent error degradation with status code, written message |
| Empty state | page.tsx:197-199,369-383 | items.length===0 after load (page.tsx:197) | H1 | n/a | n/a | handled | n/a | poll | written empty state explaining no signals / no phone on file; gated on !loading so no flash |
| HotCard — contact name | page.tsx:261 | contacts.firstName/lastName/email (route.ts:288-291) filtered eq(contacts.tenantId) | H1 | yes | none | handled | independent | poll | real tenant-scoped contact identity with Unknown fallback |
| HotCard — Speed window badge | page.tsx:263-273 | isInSpeedWindow(headline.at,now) (route.ts:299) | H1 | yes | none | n/a | independent | poll | computed from real headline signal timestamp |
| HotCard — Hotness score | page.tsx:278 | computeHotness(signals) (route.ts:262,298) via lib/hot-to-call/scoring.ts | H1 | yes | none | n/a | independent | poll | real computed score from tenant signals |
| HotCard — title · company | page.tsx:285-287 | contacts.title + companies.name/domain (route.ts:294-297) eq(companies.tenantId) | H1 | yes | none | handled | independent | poll | real tenant-scoped company join with — fallback |
| HotCard — headline signal (kind · min ago · detail) | page.tsx:292-300 | pickHeadlineSignal + minutesAgo (route.ts:300-304) | H1 | yes | none | n/a | independent | poll | real signal from outboundEmails opens/clicks + visits, tenant-scoped |
| HotCard — signal chips | page.tsx:302-326 | bucket.signals (route.ts:306-314) | H1 | yes | none | handled | independent | poll | real aggregated tenant signals, capped at 20/displayed 8 |
| HotCard — phone number | page.tsx:333 | contacts.phone, isNotNull filter (route.ts:99,111) | H1 | yes | none | handled | independent | poll | real tenant-scoped phone; list pre-filtered to contacts with a phone |
| HotCard — Call button | page.tsx:335-349 | POST /api/calls/start with contactId (page.tsx:74) | H1 | yes | none | n/a | independent | n/a | action button (not data display); wired to real call-start endpoint with coded error toasts (voice_not_configured/no_phone/dnc/quiet_hours) |
| List loading state | page.tsx:65,178-180 | loading flag (page.tsx:116,132) | H2 | n/a | none | handled | independent | poll | loading is tracked but only surfaces as 'Loading…' in the meta line — no skeleton/spinner for the card list itself; during poll refresh stale cards remain (acceptable). Minor: no list-level loading affordance. |

## Pires défauts

1. No list-level loading affordance: the `loading` flag (page.tsx:65,116) only renders 'Loading…' in the meta line (page.tsx:179); the card area shows nothing during the initial fetch instead of a skeleton — minor H2.
2. Company lookup loads ALL tenant companies into a map rather than filtering by the collected companyIds (route.ts:241-258) — tenant-scoped so no leak, but an efficiency/scale wart on large tenants.
3. Call button (page.tsx:335-349) is always enabled and visually styled as primary even though the entry-file doc (page.tsx:11-14) says the Twilio+Deepgram dialer isn't on main; the real gating is delegated to /api/calls/start error codes, so a misconfigured tenant only learns via a toast after clicking.
