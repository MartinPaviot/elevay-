# Per-page coverage audit — 2026-06-06

Method: page = feature unit (from sidebar nav). 6 parallel Sonnet agents read the REAL code
(page + primary component + API) for 24 user-facing surfaces; Opus synthesis. Lens = COVERAGE
(critical functionality MISSING vs the page's job-to-be-done), not quality polish.
Tags: BLOCKS-CORE-JOB / DEGRADES-TRUST / TABLE-STAKES-GAP. Confidence high (file:line evidence).

Result: ~19/24 surfaces have a BLOCKS-CORE-JOB gap; 24/24 have at least one critical gap.
Martin's claim ("each page has critical functionality not implemented") = confirmed.

## Per-page (critical findings, with evidence)

### Chat-first core
- `/chat` REAL — citations injected to LLM but never rendered as clickable source cards [BLOCKS].
  Thread history drops tool-call parts on save → audit trail lost on reload [DEGRADES].
- `/` Up next REAL — `POST /api/agent-actions/[id]/approve` route missing (only `reverse` exists)
  → every approve click 404s [BLOCKS]. "Suggested follow-up" (home/page.tsx:918) and "Draft email"
  are hardcoded template strings styled as AI [DEGRADES]. Actions are 6 hardcoded SQL patterns,
  no ML/signal ranking [TABLE-STAKES]. Feed polls 15s; rest of page static until reload.

### CRM
- `/accounts` REAL — no saved views (3 hardcoded tabs, page.tsx:1183); sort hardcoded score DESC
  (1014), no clickable column sort [BLOCKS]; no column show/hide; no CSV import/export; cells
  read-only; no owner reassign (PUT doesn't whitelist ownerId, [id]/route.ts:186).
- `/accounts/[id]` PARTIAL — API returns `timeline` ([id]/route.ts:149) but page discards it
  (page.tsx:59 destructures only account/deals) → zero interaction history shown [BLOCKS]; no notes
  [BLOCKS]; no tasks [BLOCKS]; AI summary only renders if pre-existing; contacts show name/title
  only (no email/phone); no enrichment provenance/re-enrich.
- `/accounts/[id]/brain` REAL — read-only dump, no links to artifact detail pages, no write ops,
  "load more" requires manual URL edit, transcript chips not openable, no AI synthesis.
- `/contacts` REAL — no "Add to sequence" in list or bulk bar (bulk = Enrich/Merge/Delete only,
  page.tsx:353) [BLOCKS]; column filters run client-side on current page of 50 → wrong results
  (page.tsx:302) [DEGRADES]; no saved segments; no export; no row email/call quick-action.
- `/contacts/[id]` REAL — no sequence enroll [BLOCKS]; no linked opportunities section (page.tsx:342)
  [DEGRADES]; activity timeline read-only (no "log call/note"); firstName/lastName not inline-editable.
- `/contacts/merge` REAL — dedup is email-only (no fuzzy name/phone/LinkedIn) [DEGRADES]; no
  field-level merge picker; no side-by-side comparison before merge; no bulk merge-all.
- `/opportunities` REAL (most complete) — kanban drag-drop + Monte Carlo forecast + stall detection
  real. Missing: inline card edit; export; per-deal ML win-prob in list (uses static stageProbability,
  page.tsx:1155); multi-contact per deal (schema single contactId).
- `/opportunities/[id]` REAL — right panel fully read-only, no inline edit of value/stage/close
  (page.tsx:711) [BLOCKS]; "Email contact" opens composer with `to:""` (page.tsx:337) [DEGRADES];
  `ExtractedIntel` declared (1148) but never rendered = dead code; no manual activity log; no
  contact name/link.

### Engage / Outbound
- `/inbox` PARTIAL — queries `outboundEmails` only (route.ts:17), no inbound capture, reply body
  not accessible (only 1-line snippet), threadId fetched but never rendered → no thread view
  [BLOCKS ×3]. Composer sends to toEmails[0] only (email-composer-panel.tsx:271) [DEGRADES]; no
  snippets/templates; no opt-out from inbox; pagination not wired.
- `/call-mode` REAL+stub — Twilio dial/SSE/voicemail real. Mute button `disabled` hardcoded
  (page.tsx:854), no Device.mute() call [BLOCKS]; no post-call disposition picker [BLOCKS]; no
  recording playback; no local presence; "trial expiring"/"reply received" filter chips inert
  placeholders (page.tsx:241) [DEGRADES]; no after-call note/summary panel.
- `/deliverability` PARTIAL — metrics real; `/api/deliverability/verify` does full SPF/DKIM/DMARC
  but page never calls/renders it [BLOCKS]; no warmup progress UI; no inbox-placement test; no
  blacklist check; healthScore hardcoded 0 when totalSent=0 (route.ts:182) [DEGRADES].
- `/sequences` REAL — no search/filter; no bulk pause/archive on active; open/reply rates not shown
  (only sent, page.tsx:157); no channel badge.
- `/sequences/[id]` REAL — no A/B variants (singular templates, page.tsx:19); no per-sequence
  send-window; enrollments capped 20 no pagination (page.tsx:577); no true unenroll; reply-auto-pause
  not surfaced.
- `/sequences/review` REAL — no per-draft AI "regenerate"; bug recipientName=subject (page.tsx:414);
  no bulk-reject.

### Activity
- `/meetings` PARTIAL — `scheduleRecallBot` only when startTime<=in15min AND only on page load
  (route.ts:109), no cron → missed page load = no recording [BLOCKS]; MeetingCard toggles inline,
  no router.push to detail → detail page unreachable from list (page.tsx:355) [BLOCKS]; no search;
  no action-item/signal count in card.
- `/meetings/[id]` REAL (richest) — Recall webhook (webhooks/recall/route.ts) processes transcript
  but does NOT call /post-call → tasks/follow-up/CRM update need manual "Confirm & update CRM" click
  (page.tsx:513) [BLOCKS]; no speaker re-labelling; follow-up subject generated empty
  (post-call/route.ts:261); transcript_chunks returns [] silently on DB error (route.ts:57).
- `/meetings/upload` REAL — audio hard-capped 25MB, no chunking (route.ts:41) → most 1h recordings
  rejected [BLOCKS]; after upload routes to /meetings list not the new meeting; no progress during
  Whisper; OPENAI_API_KEY only path.
- `/notes` PARTIAL-STUB — no edit/delete (api/notes has only GET+POST), content truncated 200 chars
  no expand [BLOCKS]; no entity picker at creation (addNote sends {content} only, page.tsx:104)
  [BLOCKS]; plain textarea no markdown; meeting notes go to activities.metadata.structuredNotes NOT
  notes table → /notes always empty after N meetings (post-call never inserts notes) [DEGRADES].
- `/tasks` REAL (complete) — no inline due-date setter (quick-add title-only, page.tsx:350); no
  delete (api/tasks/[id] PATCH only); no reminders/notifications; assignee/description not surfaced;
  auto-task from meeting needs manual Confirm click.

### Intelligence / AI / Proposals
- `/insights` REAL — only internal CRM data; no external signal feed (job changes/funding/news/
  intent) — the Clay core value [BLOCKS]; alerts are plain strings, no "why now" citation
  (page.tsx:203) [DEGRADES]; no impact-weighted ranking ($100k and $3k stall both "high"); no ICP
  fit inline. Sub: /insights/pilae hardcoded single-tenant €1M target; /insights/hot-to-call Call
  button enabled but errors without Twilio (no disabled prop) [DEGRADES]; /insights/playbook STUB —
  LLM extractor not built, empty unless typed [BLOCKS].
- `/reports` REAL-shallow — "Schedule weekly" sends `reports/schedule.requested` with NO Inngest
  handler → silent dead (schedule/route.ts:29) [BLOCKS]; no date-range/filter (hardcoded windows)
  [BLOCKS]; history localStorage-only cap 5; no charts; export = clipboard markdown only.
- `/knowledge` REAL — RAG/embedding/retrieval real and wired into chat. No search UI on the page
  [BLOCKS]; no file/doc import (PDF/DOCX/URL); staleness computed but not shown [DEGRADES]; no
  "used by AI" audit trail.
- `/skills` REAL — "Run" redirects to /chat, no inline run+result [DEGRADES]; no edit form for
  custom skills (PUT exists, no UI); system registry only has registerSkill()-ed entries → may be
  empty; no scheduled/triggered runs.
- `/proposals` REAL — deal selection is a raw UUID `<input>` (page.tsx:471) → unusable for a
  non-technical founder [BLOCKS]; no send/share/email-to-contact [BLOCKS]; no open tracking; no
  preview pane; PDF layout-unfaithful by design (SI-5).

### Orphans / non-nav
- Not in sidebar: `voice-of-customer`, `cs/today`, `test-page` (decide keep/remove).
- `graph` = admin-only (per project rule). `onboarding-v3` = dead code (wizard removed 2026-06-05).

## 6 systemic root causes (60+ gaps reduce to these)

1. LAST-MILE GAP — backend route exists and works, UI never calls/renders it. (account timeline
   discarded; deliverability/verify unused; Recall webhook → no post-call; reports schedule no
   handler; chat citations not rendered; agent approve route missing.) Highest leverage.
2. "AUTO" NEEDS A MANUAL CLICK — meeting bot only at T-15 no cron; post-call/tasks/notes only on
   Confirm. Breaks the zero-manual-entry / auto-capture thesis.
3. FAKE-AI / HARDCODED where AI is promised — home suggested follow-up + draft email static;
   hot-to-call "disabled" but live. Trust erosion at the moat.
4. LIST-ACTION POVERTY — no saved views/sort/export; no sequence-enroll from accounts/contacts/opps.
5. INBOUND BLINDNESS — inbox is outbound-only; no reply bodies, no threads.
6. SILENT CORRECTNESS BUGS — contacts filter on current page only (wrong results); composer drops
   all but first recipient; deal Email contact opens blank to:.

## Fix plan (leverage-ranked)

- BATCH 1 LAST-MILE (backend done; unblocks ~7 BLOCKS in days): render accounts/[id] timeline;
  wire /deliverability/verify into page; trigger post-call from Recall webhook; add Inngest handler
  for reports/schedule.requested; render chat citation source cards; add agent-actions approve route;
  list→detail link on meetings.
- BATCH 2 KEEP THE "AUTO" PROMISE: cron bot-scheduling fallback (outside 15-min window); auto
  post-call; meeting notes → notes table.
- BATCH 3 CORE GTM ACTION: sequence-enroll from contacts/accounts lists+details; saved views + sort
  + export on accounts/contacts/opportunities.
- BATCH 4 INBOUND + TRUST: inbound capture + thread view (inbox); replace fake-AI with real
  generation; fix the 3 silent bugs.
