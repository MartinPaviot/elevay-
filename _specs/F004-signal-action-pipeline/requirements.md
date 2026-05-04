# F004 — Signal→Action Pipeline

## User Story

As a founder, when a buying signal fires on a company (funding round, hiring
spike, tech adoption), I want the agent to automatically act — enrich the
company, find contacts, draft outreach, and optionally launch a sequence —
instead of just displaying a badge on a table.

## Acceptance Criteria

### AC-1: Every signal fires the agent reactor

GIVEN a signal is detected on a company
WHEN the signal evaluation completes (real-time or batch)
THEN it fires `agent/react` with trigger=`signal_detected`
AND includes signal type, confidence, and company context

### AC-2: Agent decides signal-appropriate action

GIVEN a `signal_detected` event reaches the reactor
WHEN the agent evaluates the signal
THEN it considers signal strength and type:
  - High-value signal (funding round, $10M+) → research + enrich + draft outreach
  - Medium signal (hiring spike) → enrich + create deal + monitor
  - Low signal (tech adoption) → monitor
AND creates/updates the work item with the appropriate strategy

### AC-3: Signal-to-deal creation is automatic

GIVEN a high-confidence signal on a company with no open deal
WHEN the agent decides to create a deal
THEN a lead-stage deal is created automatically
AND contacts at the company are enriched
AND the agent plans the first outreach action

### AC-4: Signal-to-sequence is agent-driven (not hardcoded)

GIVEN the agent reactor handles signal events
THEN the existing `signal-to-sequence.ts` hardcoded auto-enroll is bypassed
AND the reactor's LLM-driven decision replaces it
AND the reactor can choose NOT to enroll if context says otherwise
  (e.g., company already approached, contact opted out, sequence already active)

## Edge Cases

- Signal on company with existing deal → agent updates strategy, doesn't create duplicate
- Signal on opted-out contact → skip outreach, just track
- Multiple signals on same company within 1h → deduplicated by reactor
- Signal with low confidence → monitor only, no action
