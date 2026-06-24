# 12 — sequences (`/sequences`) — audit d'hydratation

**Verdict global : H2 (partiel).** The Campaigns/sequences page is almost fully faithful: every data-bearing element (list cards, step/contact counts, sent-email stat, status badge, header count, test-mode banner, inline Start/Reject) is wired to real tenant-scoped queries with a loading skeleton, a written empty state, and a self-hiding test-mode banner. The single fidelity gap is error degradation on the list: a 500 or network failure is swallowed (console.warn) and any non-ok response is ignored, so a failed load renders the 'No campaigns yet' empty state — indistinguishable from a genuinely empty account. Mutations (Start/Reject) degrade correctly with rollback + error toast.

Entrée : `app/apps/web/src/app/(dashboard)/sequences/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Header campaign count (subtitle) | app/apps/web/src/app/(dashboard)/sequences/page.tsx:185 | GET /api/sequences → db.select sequences where tenantId (app/apps/web/src/app/api/sequences/route.ts:20-24); sequences.length | H1 | yes | none | handled | silent | once | Shows live count of fetched sequences. Pre-fetch it renders 0 with no skeleton on the subtitle, but resolves correctly. |
| Test-mode banner (allowlist) | app/apps/web/src/app/(dashboard)/sequences/page.tsx:204-222 | GET /api/sending-mode → isOutboundTestMode()/outboundAllowlist() (app/apps/web/src/app/api/sending-mode/route.ts:9-17) | H1 | yes | none | handled | silent | once | Real env-derived guardrail state; auth-gated. Self-hides when testMode false. Fetch error swallowed (.catch noop) but default state is safe (testMode:false). |
| Sequence list / cards | app/apps/web/src/app/(dashboard)/sequences/page.tsx:238-307 | GET /api/sequences (app/apps/web/src/app/api/sequences/route.ts:20-63), tenantId-scoped | H2 | yes | skeleton | handled | silent | once | Real tenant-scoped data with loading skeleton (l.223-228) and written empty state (l.229-236). DEFECT: fetch failure (catch l.61-63) and any non-ok response (l.57 only sets on res.ok) leave sequences=[] and surface the 'No campaigns yet' empty state instead of an error state — a 500 looks identical to genuinely empty. |
| Card name + status badge | app/apps/web/src/app/(dashboard)/sequences/page.tsx:248-251 | sequence row .name/.status from /api/sequences (route.ts:20-24,54-59) | H1 | yes | skeleton | handled | silent | once | Faithful; status drives badge variant. |
| Step count | app/apps/web/src/app/(dashboard)/sequences/page.tsx:258 | count(*) sequenceSteps where sequenceId (route.ts:29-32) | H1 | yes | skeleton | n/a | silent | once | Tenant-safe via parent sequence already tenantId-filtered. |
| Enrolled contact count | app/apps/web/src/app/(dashboard)/sequences/page.tsx:259 | count(*) sequenceEnrollments where sequenceId (route.ts:34-37) | H1 | yes | skeleton | n/a | silent | once | Faithful real count. |
| Sent-email stat | app/apps/web/src/app/(dashboard)/sequences/page.tsx:260-262 | outboundEmails grouped by status where campaignId=seq.id (route.ts:40-52) | H1 | yes | skeleton | handled | silent | once | Self-hides when totalEmails==0; shows emailStats.sent. Faithful. |
| Inline Start/Reject (draft rows) | app/apps/web/src/app/(dashboard)/sequences/page.tsx:267-300 | PUT /api/sequences/[id] status transition, tenantId+permission scoped (app/apps/web/src/app/api/sequences/[id]/route.ts:77-119) | H1 | yes | spinner | n/a | independent | once | Optimistic update with rollback + error toast on failure (l.103-108); per-row pending spinner. Tenant + sequences:execute gated server-side. |

## Pires défauts

1. List fetch error is silent: catch only console.warns and the success branch only runs on res.ok, so a 500/network failure leaves sequences=[] and shows the 'No campaigns yet' empty state instead of an error state (app/apps/web/src/app/(dashboard)/sequences/page.tsx:54-65, 229-236).
2. sending-mode fetch error is swallowed with an empty .catch (page.tsx:73); safe default but no surfacing if the guardrail status genuinely fails to load.
3. Header subtitle count renders 0 during initial load with no skeleton on the header value, so the page briefly reads '0' campaigns before data resolves (page.tsx:185).
