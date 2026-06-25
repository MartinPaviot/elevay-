# S06 — settings-signals (`/settings/signals`) — audit d'hydratation

**Verdict global : H1 (fidèle).** This is a custom-signals config page that is faithfully wired to real tenant-scoped data. The "Your signals" list loads from GET /api/custom-signals (tenant-scoped via eq(customSignals.tenantId, authCtx.tenantId)), the create form persists via POST and round-trips by reloading the list, and backfill status chips poll every 5s to flip from Backfilling to Ready. The only meaningful gap: the GET loader swallows non-ok responses (if (!res.ok) return) so an API error renders as the empty "no signals" state instead of a distinct error state, making the list H2 on error handling.

Entrée : `app/apps/web/src/app/(dashboard)/settings/signals/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Your signals list (signal cards: name, description, created date) | app/apps/web/src/app/(dashboard)/settings/signals/page.tsx:233-284 | GET /api/custom-signals via load() at page.tsx:48-58; route app/apps/web/src/app/api/custom-signals/route.ts:20-45 (db.select from customSignals) | H2 | yes | none | handled | silent | poll | Real tenant-scoped data with empty state and 5s poll for pending backfills, but GET failure is swallowed (page.tsx:51 `if (!res.ok) return`) and surfaces as the empty 'no signals yet' copy instead of an error state — silent stale/error => H2. |
| Backfill status chip (Ready / Backfilling) | app/apps/web/src/app/(dashboard)/settings/signals/page.tsx:259-268 | s.backfilledAt from GET /api/custom-signals (route.ts:41); polled at page.tsx:66-71 | H1 | yes | none | n/a | silent | poll | Faithful — reflects real backfilledAt timestamp, polls every 5s while pending so the chip flips live without refresh. |
| New signal form (Name input, Detect-when textarea, Create & backfill button) | app/apps/web/src/app/(dashboard)/settings/signals/page.tsx:172-204 | POST /api/custom-signals via createSignal() at page.tsx:80-110; route.ts:56-149 (insert + Inngest backfill); round-trips via load() at page.tsx:101 | H1 | yes | spinner | n/a | independent | once | Faithful create control (not a stored-value setting): blank-by-design, validates, persists tenant-scoped, shows inline error and a Generating-plan… spinner, and reflects back by reloading + highlighting the new card. |
| Header title/subtitle and helper copy | app/apps/web/src/app/(dashboard)/settings/signals/page.tsx:149-152, 206-211 | static | H0 | n/a | n/a | n/a | n/a | static | Pure help/chrome copy — correctly hardcoded. |

## Pires défauts

1. GET loader silently swallows API failures: app/apps/web/src/app/(dashboard)/settings/signals/page.tsx:51 (`if (!res.ok) return`) sets loaded=true with an empty list, so a 500/network error renders the 'You haven't defined any custom signals yet.' empty state (page.tsx:229) and is indistinguishable from a genuinely empty list — no error state.
2. No loading skeleton: while !loaded the page returns null (page.tsx:145), so a slow/hung GET shows nothing rather than a loading affordance.
3. Catch branch in load() (page.tsx:55) also marks loaded=true on a thrown fetch error, reinforcing the silent-empty failure mode.
