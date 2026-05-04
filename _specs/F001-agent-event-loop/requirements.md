# F001 — Agent Event Loop

## User Story

As a founder doing founder-led sales, I want the AI agent to react to every
significant event in real-time (email opened, reply received, signal detected,
deal stalling, meeting completed) so that I never have to initiate an action
myself — the agent acts and I supervise.

## Acceptance Criteria

### AC-1: Event-driven reactor replaces batch cron

GIVEN the agent event loop is deployed
WHEN any of the following events occur:
  - Email opened by prospect
  - Email replied by prospect
  - Email bounced
  - Email clicked by prospect
  - Signal detected on a company (funding, hiring, etc.)
  - Deal stale for >7 days with no activity
  - Meeting completed
  - Contact created or enriched
  - Sequence enrollment completed (all steps sent)
  - Inbound email received (not a reply to outbound)
THEN the agent evaluates the event within 30 seconds
AND decides on 0-N actions (follow-up, stage change, task, alert, draft email)
AND executes actions through the existing approval mode guardrails
AND records the decision with reasoning to `agent_actions`

### AC-2: Agent decisions are contextual

GIVEN an event triggers the agent reactor
WHEN the agent evaluates what to do
THEN it loads:
  - The entity context (contact, company, deal involved)
  - Recent activities on that entity (last 10)
  - Active sequences involving that contact
  - Current deal stage and age-in-stage
  - Relevant signals on the company
  - The tenant's ICP and business context
  - The agent's past actions on this entity (last 5)
AND uses this context to make a decision that accounts for history

### AC-3: Agent respects guardrails

GIVEN the agent decides to take an action
WHEN the action is evaluated against approval mode
THEN the existing `enforceAgentApprovalMode()` is used
AND the action is either auto-executed or queued for review
AND the decision is always recorded regardless of execution

### AC-4: Agent does not duplicate actions

GIVEN the agent receives an event
WHEN a similar event was already processed in the last hour
THEN the agent skips evaluation
AND logs the dedup decision

### AC-5: Agent explains its reasoning

GIVEN the agent takes (or queues) an action
WHEN the action is recorded
THEN it includes:
  - `triggerEvent`: what event caused the evaluation
  - `reasoning`: why this action was chosen
  - `confidence`: 0.0-1.0
  - `alternativesConsidered`: what else was considered and why rejected
  - `expectedOutcome`: what the agent expects to happen

### AC-6: Existing cron becomes fallback

GIVEN the agent event loop is running
WHEN the 9am daily cron fires
THEN it only processes deals that had NO event-driven evaluation in the last 24h
AND it serves as a safety net, not the primary driver

## Edge Cases

- Burst of events (10 emails opened in 1 minute) → deduplicate, process once
- Event on entity with no deal → agent may create deal if signal is strong enough
- Event on opted-out contact → skip, log reason
- LLM unavailable → fall back to rule-based decisions (defined heuristics)
- Event loop backpressure → Inngest concurrency limits prevent overload
