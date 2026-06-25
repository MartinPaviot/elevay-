# 13 — sequence-detail (`/sequences/[id]`) — audit d'hydratation

**Verdict global : H2 (partiel).** The page is largely faithful: sequence header, step timeline, enrolled-contacts table, and the entire Analytics tab (funnel, rates, per-step breakdown, enrollment breakdown) are all wired to real tenant-scoped data via /api/sequences/:id and /api/sequences/:id/analytics, both of which gate on eq(sequences.tenantId) and 404 cross-tenant. The notable defect is the "Campaign launched" stat tiles (Queued/Sent/Opened/Replied): their source (emailStats) is only ever populated by the 3s poll that runs while status==='preparing', and that poll clearInterval's on launch. On initial load of an already-launched campaign, fetchSequence never sets emailStats, so all four tiles render a hardcoded 0 despite a real source existing in the status route. Loading/empty/error states are handled on the main fetch (spinner, "Sequence not found", empty-step card) and analytics (loading text, "No analytics yet"), but campaign-status polling failures degrade silently.

Entrée : `app/apps/web/src/app/(dashboard)/sequences/[id]/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Header title (sequence name) | page.tsx:500 | GET /api/sequences/:id → data.sequence.name (route.ts:25-29, tenant-scoped) | H1 | yes | spinner | handled | global | once | faithful |
| Header subtitle (To {firstContact} and N more) | page.tsx:501 | data.enrollments[0] / .length (route.ts:45-69) | H1 | yes | spinner | handled | global | once | faithful; falls back to description when no enrollments |
| Status badge | page.tsx:503-505 | data.sequence.status (route.ts:25-29) | H1 | yes | spinner | n/a | global | once | faithful |
| Step timeline cards (subject, body, delay, number) | page.tsx:598-711 | data.steps from sequenceSteps where sequenceId (route.ts:35-39) | H1 | yes | spinner | handled | global | once | faithful; empty-state card at page.tsx:582-591. Tenant safety via parent-sequence 404 (steps carry no tenantId) |
| Step count / total-delay header | page.tsx:578-580 | derived from data.steps (page.tsx:495) | H1 | yes | spinner | handled | global | once | faithful |
| Campaign 'preparing' stats (companies/contacts/emails drafted) | page.tsx:730-732 | campaignConfig.stats on load (page.tsx:124) + poll /api/campaigns/:id/status .stats (status route.ts:81) | H2 | yes | spinner | blank | silent | poll | poll runs only while preparing; .stats is config.stats (idle returns null), values default to 0 — partial/silent on poll failure |
| Campaign 'ready' stats | page.tsx:742-744 | campaignStats from campaignConfig.stats (page.tsx:124) | H2 | yes | spinner | blank | silent | once | sourced from stored config.stats; not recomputed live |
| Campaign 'launched' tiles: Queued/Sent/Opened/Replied | page.tsx:765-775 | emailStats — only set by poll (page.tsx:150); status route computes from outboundEmails (status route.ts:54-77) | H4 | yes | none | blank | silent | poll | DEFECT: emailStats is never set on initial load (fetchSequence at page.tsx:113-137 omits it); the only writer is the preparing-poll which clearInterval's on launch (page.tsx:150-153). An already-launched campaign opened fresh shows hardcoded 0 in all four tiles. Also status route emailStats has no 'opened'/'replied' keys so those tiles are always 0 even when populated |
| Enrolled-contacts table (name, email, step, status) | page.tsx:806-852 | data.enrollments joined to contacts (route.ts:45-69, leftJoin gated on contacts.tenantId) | H1 | yes | spinner | handled | global | once | faithful; self-hides when empty (page.tsx:788), '+N more' beyond 20, unknown contact → 'Unknown'/— |
| Analytics funnel (Enrolled/Sent/Opened/Clicked/Replied bars) | page.tsx:894-929 | GET /api/sequences/:id/analytics → enrollment + emails (analytics route.ts:49-121, tenant-scoped) | H1 | yes | skeleton | handled | global | once | faithful; loading text + 'No analytics yet' empty state; toast on fetch error |
| Analytics rate tiles (open/click/reply/bounce) | page.tsx:939-951 | data.rates (analytics route.ts:123-130) | H1 | yes | skeleton | handled | global | once | faithful; computed over sent+delivered+bounced |
| Per-step performance table + drop-off bars | page.tsx:977-1044 | data.perStep from outboundEmails grouped by stepNumber (analytics route.ts:136-178) | H1 | yes | skeleton | handled | global | once | faithful; self-hides when perStep empty (page.tsx:955) |
| Enrollment breakdown tiles (Active/Paused/Completed/Replied) | page.tsx:1052-1063 | data.enrollment by status (analytics route.ts:49-69) | H1 | yes | skeleton | handled | global | once | faithful |

## Pires défauts

1. Campaign 'launched' tiles (Queued/Sent/Opened/Replied) render hardcoded 0 on initial page load: emailStats is never populated by fetchSequence (page.tsx:113-137) and the only writer is the preparing-poll, which clearInterval's the moment status becomes launched (page.tsx:150-153). page.tsx:765-775
2. Even when the poll does run, the status route's emailStats only emits draft/queued/sent/total keys (status route.ts:54-77) — it never computes 'opened' or 'replied', so the Opened and Replied launched tiles (page.tsx:768-769) are structurally always 0.
3. Campaign-status poll failures degrade silently — the poll (page.tsx:144-156) has no catch/error branch, so a 500 from /api/campaigns/:id/status leaves the campaign section showing stale/zero values with no error surfaced, unlike the analytics tab which toasts.
