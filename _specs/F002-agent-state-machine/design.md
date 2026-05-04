# F002 — Agent State Machine: Design

## System Fit

The state machine sits between the reactor (F001) and the chat system.
It's the agent's persistent memory of what it's doing and why.

```
[Agent Reactor F001] ──→ reads/writes ──→ [Agent Work Items]
                                               ↕
[Chat System]        ──→ reads         ──→ [Agent Work Items]
                                               ↕
[Outcome Tracker F003]──→ reads/archives ──→ [Agent Work Items]
```

## Data Model

### Table: `agent_work_items`

```sql
CREATE TABLE agent_work_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  entity_type TEXT NOT NULL,         -- "deal" | "contact" | "company"
  entity_id TEXT NOT NULL,
  entity_label TEXT NOT NULL,        -- human-readable: "Acme Corp — Series A deal"

  strategy TEXT NOT NULL,            -- "nurture" | "push" | "re_engage" | "monitor" | "close" | "research"
  strategy_reasoning TEXT NOT NULL,  -- why this strategy was chosen
  strategy_set_at TIMESTAMPTZ NOT NULL,

  priority TEXT NOT NULL DEFAULT 'medium', -- "critical" | "high" | "medium" | "low"
  priority_reasoning TEXT,

  next_action TEXT,                  -- "send_followup" | "schedule_meeting" | "research" | etc.
  next_action_detail TEXT,           -- human-readable: "Send case study email"
  next_action_at TIMESTAMPTZ,       -- when to execute next action

  last_agent_action_id TEXT REFERENCES agent_actions(id),
  last_evaluated_at TIMESTAMPTZ,
  evaluation_count INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'active', -- "active" | "paused" | "archived"
  archived_reason TEXT,              -- "deal_won" | "deal_lost" | "entity_deleted" | "user_override"
  archived_at TIMESTAMPTZ,

  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_agent_work_items_entity
  ON agent_work_items(tenant_id, entity_type, entity_id)
  WHERE status = 'active';

CREATE INDEX idx_agent_work_items_next_action
  ON agent_work_items(tenant_id, next_action_at)
  WHERE status = 'active';

CREATE INDEX idx_agent_work_items_priority
  ON agent_work_items(tenant_id, priority, updated_at DESC)
  WHERE status = 'active';
```

## Strategy Enum

| Strategy | Meaning | Typical actions |
|----------|---------|-----------------|
| `research` | Gathering information | Enrich, dossier, signal scan |
| `nurture` | Building relationship, not pushing | Share content, light touches |
| `push` | Actively driving toward close | Follow-ups, meeting requests, proposals |
| `re_engage` | Gone cold, trying to revive | Re-engagement email, new angle |
| `monitor` | Watching for signals, not acting | Track signals, wait for trigger |
| `close` | Deal in final stages | Contract follow-up, negotiation support |

## Context Serialization

For chat system prompt, serialize top 10 work items as:

```
## Your Active Work Queue

1. **Acme Corp** (deal, push) — Next: Send proposal follow-up (overdue by 2d)
   Strategy: Pushing for close after positive demo feedback
2. **Fintech Co** (company, research) — Next: Enrich contacts (tomorrow)
   Strategy: New TAM company with hiring signal, gathering intel
...
```

For reactor context, serialize only the relevant work item for the entity
being evaluated, in full detail.

## Integration with F001 Agent Reactor

After the reactor makes a decision:
1. Check if work item exists for entity
2. If yes: update strategy/next_action/priority based on decision
3. If no + decision includes action: create new work item
4. Always update `last_evaluated_at` and increment `evaluation_count`

## Integration with Chat

In `buildChatSystemPrompt()`, add a new context section:
- Load top 10 active work items by priority
- Serialize as shown above
- Insert after CRM snapshot section

## Archival

Triggered by:
- Deal won/lost activity → archive with reason
- Entity deleted → archive with reason
- User says "stop tracking X" in chat → archive with user_override
- No evaluation in 30 days → auto-archive with reason "stale"
