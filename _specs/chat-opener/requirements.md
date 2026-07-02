# chat-opener — Requirements (v1)

## Problem (one sentence)

The chat dock opens on a blank "Ask about your workspace" + 3 canned prompts
(the ChatGPT-wrapper pattern); an AI-native product opens with the agent's own
first turn: what is waiting, what it prepared, and one-tap ways to act.

## Scope v1 (decided 2026-07-02 with founder)

- Agent-authored opener message, **assembled deterministically** (zero
  inference at open): sources = up-next todos + sequence drafts pending
  approval + last chat thread.
- 3-4 chips, slot-filled with tenant data, wired to the existing `send()`
  path (or a direct `href` navigation when a deterministic page beats the
  agent loop — drafts review).
- Thread continuity via a "Continue: …" chip that loads the last thread
  into the dock.
- Metrics: opener shown, chip CTR, time-to-first-action.

**Deferred, named:**
- Tool pre-routing (chip → direct tool execution skipping the agent loop):
  needs a new execution seam; v2.
- Autonomy nudge inside the opener: nudge UI already shipped (#531 banner);
  no duplication in v1.
- LLM-personalized opener copy: deterministic templates first; revisit only
  if openers feel repetitive.

## Acceptance criteria (GIVEN / WHEN / THEN)

1. GIVEN a tenant with ≥1 attention-lane reply, ≥1 pending draft, ≥1 deal at
   risk WHEN the dock opens with no messages THEN the empty state shows an
   agent message stating (in priority order, max 3 sentences) the reply
   count + latest sender, the pending-draft count, and the top silent deal,
   plus chips ordered reply > drafts > deal > meeting (max 4).
2. GIVEN zero replies/drafts/deals/meetings WHEN the dock opens THEN the
   message is the all-clear copy and the chips are the 3 recipe fallbacks
   (call list, inbound recap, deals at risk).
3. GIVEN a last thread exists and a chip slot remains WHEN the opener renders
   THEN a "Continue: {title}" chip appears last; clicking it loads that
   thread's messages into the dock (no navigation away).
4. GIVEN the opener fetch fails or times out WHEN the dock opens THEN the
   legacy static suggestions render (no error state, no blank).
5. GIVEN the opener fetch is in flight THEN skeleton rows render (no canned
   text swap — same rule as /chat starter suggestions).
6. WHEN a chip is clicked THEN `chat_opener_chip_clicked` fires with
   {kind, position} and, for send-chips, the message goes through the
   existing `send()` (thread persistence + memory extraction unchanged).
7. WHEN the opener renders THEN `chat_opener_shown` fires with counts;
   WHEN the first user action of a dock session happens (chip or composer)
   THEN `chat_dock_first_action` fires with ms-since-open and source.
8. Scoped surfaces (account/contact/deal/meeting/list pages): unchanged in
   v1 — the page-aware static suggestions stay.
9. The opener route never throws: each source degrades independently to
   empty/zero (same contract as /api/home/up-next).

## Edge cases

- 1 reply (singular copy), 0 subject (omit subject clause), subject > 40
  chars (ellipsis truncation), task-kind todos (ignored in v1: no text, no
  chip), test-label rows (already filtered by buildNeedsYou upstream),
  quotes in subjects (safe string embedding), draft count 1 (singular),
  >4 candidate chips (hard cap 4), no last thread (no resume chip),
  unauthenticated (401 → fallback chips).

## Copy rules

English (DEFAULT_LOCALE=en), no emoji, no em-dash, factual sentences,
counts always real. Recipe chips only reference always-available tools
(getCallList, email search, getDealsAtRisk).
