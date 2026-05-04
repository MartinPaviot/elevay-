# F003 — Outcome Tracking

## User Story

As the system, I need to link every agent action to a measurable outcome
so the agent can learn what works, adjust its strategy, and build trust
progressively (feeds F005 Learned Trust).

## Acceptance Criteria

### AC-1: Every agent action gets an outcome window

GIVEN the agent takes an action (send email, create task, advance deal, etc.)
WHEN the action is recorded in `agent_actions`
THEN an outcome tracking entry is created with:
  - Reference to the action
  - Expected outcome type (open, reply, meeting, deal_advance)
  - Observation window (e.g., 7 days for email reply, 14 days for deal advance)
  - Status: `watching`

### AC-2: Outcomes are detected automatically

GIVEN an outcome tracking entry is in `watching` status
WHEN the observation window is active
THEN the system checks for matching outcomes:
  - Email action → did recipient open/reply/click within window?
  - Deal stage change → did deal advance within window?
  - Task creation → was task completed within window?
  - Sequence enrollment → did contact reply/book meeting within sequence?
AND when outcome detected: status → `resolved`, outcome recorded
AND when window expires with no outcome: status → `expired`, outcome = `no_response`

### AC-3: Outcome data is structured for learning

GIVEN an outcome is recorded
WHEN the record is saved
THEN it includes:
  - `positivity`: -1.0 to 1.0 (replied positively = 1.0, bounced = -1.0, no response = 0.0)
  - `outcomeType`: what specifically happened
  - `timeToOutcome`: how long it took
  - `triggerContext`: what trigger led to the action (from agent_reactions)
  - `entitySnapshot`: entity state at time of action

### AC-4: Aggregated outcomes are queryable

GIVEN multiple outcomes exist for a tenant
WHEN the system queries outcomes
THEN it can answer:
  - What % of follow-up emails get replies? (by signal type, by deal stage)
  - What actions correlate with deal advancement?
  - What's the agent's hit rate by action type?
  - Which triggers lead to the best outcomes?

### AC-5: Outcomes feed the trust model (F005)

GIVEN an outcome is resolved
WHEN the resolution is positive (reply, meeting, advancement)
THEN the trust score for that action type increases
AND when the resolution is negative (bounce, no response, deal lost)
THEN the trust score for that action type decreases

## Edge Cases

- Action reversed by user before outcome window → status = `cancelled`, not counted
- Multiple outcomes for same action (opened then replied) → record best outcome
- Entity deleted during observation → status = `orphaned`
- Very long outcome windows (deal close can take months) → cap at 30 days
