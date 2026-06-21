# VERIFY — inbox-list-and-thread

Live verification on :3007 (worktree → PROD DB) vs Upstream captures.
Screenshots saved at repo root: `OURS-*.png`, `UP-*.png`.

## What was built + verified

| Task | Status | Evidence |
|------|--------|----------|
| LT-1 email-first | DONE | `OURS-thread-emailfirst.png`: subject + sender + message render first under the header; no card wall. |
| LT-2 intelligence panel | DONE | `OURS-thread-intel-panel.png`: "INTELLIGENCE 2" collapsed bar below the email; `OURS-thread-intel-expanded.png`: expands to PROSPECT BRIEF / ASK / PRIVATE NOTES on click. Resets collapsed per thread (key=conversationKey). |
| LT-3 toolbar (partial) | PARTIAL | Header is one tidy action row (Reply · Book meeting · Assign · Label · Snooze · Done). Full ⋮-overflow DEFERRED (see below). |
| LT-7 subject hierarchy | DONE | `OURS-thread-emailfirst.png`: subject 17px semibold leads; sender 13px secondary line. Matches `UP-thread-detail.png` hierarchy (scaled to pane). |
| LT-4 composer hint | DONE | DOM-verified: textarea placeholder = "Write your reply — or hit ⌘/Ctrl+J to draft with AI". |
| LT-5 unread bold | N/A | No read/unread flag exists on `ConversationListItem` — can't fake it. Calmed weights instead (LT-7-list). |
| LT-6 multi-select checkbox | ALREADY DONE | `_inbox-row.tsx` already renders a hover/selected checkbox (opacity-0 group-hover). |
| LT-7-list calm weights | DONE | `OURS-list-calm.png`: sender semibold, subject medium, snippet muted (was everything-bold). |
| Mailbox "All inboxes" switcher | ACCOUNTED FOR | `_inbox-folders.tsx` Mailboxes sub-segment (All inboxes + per-box), gated `>= 2` boxes. Hidden for Martin's single box by design. |

Tests: 75 inbox tests green (incl. new `intelligence-panel.test.tsx` + updated
`inbox-row.test.tsx`). tsc clean.

## Deferred (with rationale)

- **LT-3 full toolbar overflow (⋮ More).** Moving Book-meeting / Assign /
  Labels / Presence / Stop-sequence into a popover means wrapping THREE stateful
  widgets (`ThreadAssignment`, `ThreadLabels`, `ThreadPresence`) + the meeting
  scheduler — high risk to verified behaviour, low incremental feel-value once
  email-first landed. The action row already reads as ONE row (Assign only
  appears for 2+ member workspaces; hidden for a solo founder). Flagged, not done.

## Known pre-existing issue (NOT introduced here)

- `GET /api/settings/mailboxes` → 500 on :3007. Cause: the route does
  `db.select()` (all columns) on `connected_mailboxes`; PROD's table is behind
  the Drizzle schema (a recent A2/A3 column is absent) — the
  [[reference_prod-schema-behind-drizzle]] hazard. The pane degrades gracefully
  (`{mailboxes: []}` fallback → empty From selector). Untouched by this change.
  Fix later by narrowing the SELECT to known-safe columns OR deploying the
  migration to prod (never from this unmerged branch).
