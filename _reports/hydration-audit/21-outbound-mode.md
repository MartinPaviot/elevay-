# 21 — outbound-mode (`/outbound-mode`) — audit d'hydratation

**Verdict global : H1 (fidèle).** The "Outbound du jour" cockpit is genuinely data-hydrated: a single client fetch to GET /api/outbound/queue feeds every element with real, tenant-scoped data (replies, sequence touches, pending drafts), and the page handles loading, empty, and error states explicitly. All three DB reads are tenant-scoped (outbound_emails.tenant_id, contacts.tenant_id, sequence_drafts.tenant_id). The one fidelity gap vs the Home reference bar: there is a single global error/loading path covering all three lanes rather than independent per-lane degradation — if the route 500s, the whole page shows one error line instead of each lane self-degrading.

Entrée : `app/apps/web/src/app/(dashboard)/outbound-mode/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Header title 'Outbound du jour' | app/apps/web/src/app/(dashboard)/outbound-mode/page.tsx:88 | static (hardcoded label) — page.tsx:89 | H0 | n/a | n/a | n/a | n/a | static | Pure chrome heading + descriptive subtitle; appropriately static. |
| Counts strip — replies count | app/apps/web/src/app/(dashboard)/outbound-mode/page.tsx:98 | GET /api/outbound/queue → counts.replies (route.ts:151, from outbound_emails tenant-scoped query route.ts:54-75) | H1 | yes | skeleton | handled | global | once | Real tenant-scoped count; only renders when data present (loading shows text, error shows global line). Count is array .length over a LIMIT 50 cap, so could under-report beyond 50 replies — minor. |
| Counts strip — touches count | app/apps/web/src/app/(dashboard)/outbound-mode/page.tsx:101 | counts.reminders (route.ts:152, sequence_enrollments joined to contacts, tenant via contacts.tenant_id route.ts:77-99) | H1 | yes | skeleton | handled | global | once | Tenant scoping applied via contacts.tenant_id (innerJoin) rather than sequence_enrollments.tenant_id — correct since inner join forces same-tenant contact, but indirect. LIMIT 50 cap on count. |
| Counts strip — drafts count | app/apps/web/src/app/(dashboard)/outbound-mode/page.tsx:104 | counts.drafts (route.ts:153, sequence_drafts tenant-scoped, status=pending_approval route.ts:101-120) | H1 | yes | skeleton | handled | global | once | Real tenant-scoped count of pending drafts. LIMIT 100 cap. |
| Queue list (rows: reply/reminder/draft) | app/apps/web/src/app/(dashboard)/outbound-mode/page.tsx:132-185 | data.items via assembleOutboundQueue (lib/outbound/queue.ts:96-146) from the three tenant-scoped queries (route.ts:54-146) | H1 | yes | skeleton | handled | global | once | Each row is real data, priority-ordered by a pure unit-testable function. Written empty state at page.tsx:126-130. Faithful. |
| Row title / subtitle (who replied, touch context, draft subject) | app/apps/web/src/app/(dashboard)/outbound-mode/page.tsx:158-169 | item.title/subtitle composed in assembleOutboundQueue (queue.ts:106-143) from contact name/subject/classification/sequenceName | H1 | yes | skeleton | handled | global | once | Real contact/subject/classification data; falls back to 'Unknown contact' / '(no subject)' gracefully (queue.ts:93,114,139). |
| Quality score badge (drafts) | app/apps/web/src/app/(dashboard)/outbound-mode/page.tsx:171-179 | item.qualityScore → sequence_drafts.qualityScore (route.ts:105, queue.ts:138) | H1 | yes | skeleton | handled | global | once | Real qualityScore mapped to a 0-100 banded badge; null → 'unscored' fallback (page.tsx:48). Faithful. |

## Pires défauts

1. Single global error/loading path covers all three lanes — page.tsx:120-124 renders one error line for the whole queue, so a route failure collapses all lanes at once instead of degrading lane-by-lane like the Home reference bar.
2. Counts are computed as array .length under per-source LIMIT caps (route.ts:75 LIMIT 50, :99 LIMIT 50, :120 LIMIT 100), so the displayed reply/touch/draft counts (page.tsx:98-104) silently cap and can under-report a busy tenant rather than showing a true total.
3. Freshness is fetch-once on mount with no poll/refresh (page.tsx:61-82) — the queue can go stale (replies/drafts arriving after load are not reflected) with no visible staleness cue.
