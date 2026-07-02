# chat-opener — Design (v1)

## Architecture

```
chat-dock.tsx (open, no messages)
  └─ fetch GET /api/chat/opener        (sessionStorage cache, TTL 60s)
       ├─ up-next GET (internal import — same pattern up-next uses for
       │   dashboard summary, up-next/route.ts:13) → todos: NeedsYouItem[]
       ├─ count(sequence_drafts WHERE tenant, status='pending_approval')
       └─ latest chat_threads row for user (id, title, updatedAt)
     → buildOpener(inputs)  [pure, lib/chat/opener.ts]
     → { text, chips, counts, hasWork }
```

## Module: `lib/chat/opener.ts` (pure, unit-tested)

```ts
type OpenerChip = {
  id: string;                       // stable analytics id
  kind: "reply"|"drafts"|"deal_risk"|"meeting"|"resume"|"recipe";
  label: string;                    // chip text, slot-filled
  send?: string;                    // message for chat send()
  href?: string;                    // direct navigation (drafts → /sequences/review)
  resumeThreadId?: string;          // resume chip
};
buildOpener(inputs: {
  todos: OpenerTodo[];              // projection of NeedsYouItem
  draftsPending: number;
  lastThread: { id, title, updatedAt } | null;
}): { text: string; chips: OpenerChip[]; hasWork: boolean;
      counts: { replies, drafts, deals, meetings } }
```

Text: sentences in priority order [replies, drafts, top deal, meeting],
capped at 3, joined. All-clear copy when no work. Chips: same priority,
cap 4; resume chip appended last if a slot remains; recipe chips fill up
to 3 when fewer than 3 work chips exist.

Chip → action mapping (all existing plumbing):
- reply    → send: `Draft a reply to {addr} about "{subject}"` (suggestEmailReply path)
- drafts   → href: `/sequences/review` (no chat tool lists drafts; deterministic nav)
- deal     → send: `Coach me on the "{name}" deal…` (getDealCoaching)
- meeting  → send: `Prepare me for "{title}" at {time} today` (generateMeetingPrep)
- resume   → load thread into dock (GET /api/chat/threads/{id} → setMessages)
- recipes  → getCallList / email search / getDealsAtRisk sends

## Route: `GET /api/chat/opener`

Auth via getAuthContext. Each source in its own try/catch → degrades to
[]/0/null. Returns buildOpener output + generatedAt. No LLM call.

## Dock changes (`components/chat/chat-dock.tsx`)

- Empty state: fetch opener (cache sessionStorage `elevay:chat-opener:v1`,
  60s TTL) → skeleton rows while loading → render as an assistant-style
  turn (ElevayMark header + text + chips), fallback to legacy static chips
  on error/401.
- Resume: fetch thread messages, map to UIMessage
  ({id, role, parts:[{type:"text",text:content}]}), chat.setMessages,
  setThreadId, setLastSavedCount(messages.length) so saveMessages only
  appends genuinely new turns.
- Metrics: `chat_opener_shown` {replies,drafts,deals,meetings,hasWork},
  `chat_opener_chip_clicked` {kind,position}, `chat_dock_first_action`
  {ms,source:"chip"|"composer"} once per dock open.

## What does NOT change

- Scoped-page suggestions (suggestionsFor) — v1 targets the global default.
- /chat page empty state — follow-up.
- Send pipeline, thread persistence, memory extraction.
- The opener never auto-sends anything (the human decides — charte).
