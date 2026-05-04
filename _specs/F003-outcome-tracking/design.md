# F003 — Outcome Tracking: Design

## System Fit

Outcome tracking is the feedback loop that makes the agent intelligent.
It sits downstream of actions and upstream of trust/strategy adjustment.

```
[Agent Action] ──→ [Outcome Watcher Created] ──→ [Outcome Detector Cron]
                                                        │
                                              ┌─────────┴─────────┐
                                              ▼                   ▼
                                        [Outcome Found]     [Window Expired]
                                              │                   │
                                              ▼                   ▼
                                        resolved (+/-)       expired (0.0)
                                              │                   │
                                              └─────────┬─────────┘
                                                        ▼
                                               [Trust Model F005]
                                               [Strategy Adjust]
```

## Data Model

### Table: `action_outcomes`

```sql
CREATE TABLE action_outcomes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  action_id TEXT NOT NULL REFERENCES agent_actions(id),
  reaction_id TEXT REFERENCES agent_reactions(id),  -- which reactor evaluation caused this

  -- What we're watching for
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action_type TEXT NOT NULL,         -- from agent_actions.actionType
  expected_outcome TEXT NOT NULL,    -- "email_reply" | "email_open" | "deal_advance" | "meeting_booked" | "task_completed"
  observation_window_hours INTEGER NOT NULL DEFAULT 168, -- 7 days

  -- What happened
  status TEXT NOT NULL DEFAULT 'watching', -- "watching" | "resolved" | "expired" | "cancelled" | "orphaned"
  outcome_type TEXT,                 -- specific outcome: "replied_positive" | "replied_negative" | "opened" | "bounced" | "advanced" | "no_response"
  positivity REAL,                   -- -1.0 to 1.0
  time_to_outcome_hours REAL,        -- how long it took
  outcome_metadata JSONB DEFAULT '{}',

  -- Context at time of action (for learning)
  trigger_type TEXT,                 -- from agent_reactions.trigger
  entity_snapshot JSONB DEFAULT '{}', -- entity state when action was taken

  -- Timestamps
  watching_since TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_expires_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_action_outcomes_watching
  ON action_outcomes(tenant_id, status, window_expires_at)
  WHERE status = 'watching';

CREATE INDEX idx_action_outcomes_action
  ON action_outcomes(action_id);

CREATE INDEX idx_action_outcomes_entity
  ON action_outcomes(tenant_id, entity_type, entity_id);

CREATE INDEX idx_action_outcomes_stats
  ON action_outcomes(tenant_id, action_type, status, positivity);
```

## Outcome Detection Strategy

### Cron: `outcome-detector` — runs every 15 minutes

1. Fetch all `watching` outcomes where `window_expires_at <= now + 15min` (about to expire) OR where we should check
2. For each, check if outcome occurred:

| action_type | What to check | Where to check |
|-------------|---------------|----------------|
| `email-send` | opened/clicked/replied | `outboundEmails` WHERE contactId AND openedAt/repliedAt |
| `email-reply` | replied back | `outboundEmails` WHERE threadId AND repliedAt > action time |
| `deal-stage-change` | deal advanced | `activities` WHERE entityId=dealId AND activityType='deal_stage_changed' |
| `task-create` | task completed | `tasks` WHERE id AND completedAt |
| `sequence-enrollment` | replied during sequence | `sequenceEnrollments` WHERE status='replied' |
| `contact-create` | enrichment completed | `contacts` WHERE id AND score > 0 |

### Real-time detection (event-driven, preferred)

Instead of only polling, wire into existing event handlers:
- Email opened webhook → check if any `watching` outcome for this email → resolve
- Reply received → check if any `watching` outcome → resolve
- Deal stage changed → check if any `watching` outcome → resolve

This is faster than cron and catches outcomes immediately.

## Positivity Scoring

| Outcome | Positivity |
|---------|-----------|
| replied_positive (interested, meeting_request) | +1.0 |
| meeting_booked | +0.9 |
| deal_advanced | +0.8 |
| replied_neutral (question, clarification) | +0.4 |
| email_opened (no reply) | +0.1 |
| email_clicked | +0.3 |
| no_response (window expired) | 0.0 |
| replied_negative (not_interested) | -0.3 |
| unsubscribed | -0.6 |
| bounced | -0.8 |
| deal_lost (after agent action) | -1.0 |

## Aggregation Queries

```sql
-- Agent hit rate by action type
SELECT action_type,
  COUNT(*) FILTER (WHERE positivity > 0.3) AS wins,
  COUNT(*) AS total,
  ROUND(AVG(positivity), 2) AS avg_positivity
FROM action_outcomes
WHERE tenant_id = ? AND status IN ('resolved', 'expired')
GROUP BY action_type;

-- Best trigger → action → outcome combinations
SELECT trigger_type, action_type, outcome_type,
  COUNT(*) AS count,
  ROUND(AVG(positivity), 2) AS avg_positivity
FROM action_outcomes
WHERE tenant_id = ? AND status = 'resolved'
GROUP BY trigger_type, action_type, outcome_type
ORDER BY avg_positivity DESC;
```

## Integration with Agent Reactor (F001)

After the reactor dispatches an action via `recordAgentAction()`:
1. Create `action_outcomes` row with appropriate window
2. Set `reaction_id` to link back to the evaluation
3. Snapshot relevant entity fields

## Integration with Trust Model (F005)

On outcome resolution:
1. Fire `outcome/resolved` Inngest event
2. Trust model reads action_type + positivity
3. Adjusts threshold for that action type
