# F001 — Agent Event Loop: Design

## System Fit

The agent event loop sits between existing event emitters (webhooks, crons,
sync functions) and the existing action infrastructure (agent_actions,
approval mode, email send worker). It adds a decision layer that doesn't
exist today.

```
[Email Webhook]  ──┐
[Signal Detector]──┤
[Email Sync]     ──┤──→  agent/react  ──→  [Agent Reactor]  ──→  [Decision]
[Activity Log]   ──┤                            │                     │
[Sequence Cron]  ──┘                            │                     ▼
                                          [Context Load]    [enforceApprovalMode]
                                                                      │
                                                              ┌───────┴───────┐
                                                              ▼               ▼
                                                        [Auto-execute]  [Queue for review]
                                                              │               │
                                                              ▼               ▼
                                                        [agent_actions]  [agent_actions]
                                                        status=executed  status=scheduled
```

## Event Schema

All events funnel through a single Inngest event: `agent/react`

```typescript
interface AgentReactEvent {
  name: "agent/react";
  data: {
    tenantId: string;
    trigger: AgentTrigger;
    entityType: "contact" | "company" | "deal" | "email";
    entityId: string;
    metadata: Record<string, unknown>;
    // For dedup
    deduplicationKey: string; // e.g. "email_opened:contact_123:email_456"
    firedAt: string; // ISO timestamp
  };
}

type AgentTrigger =
  | "email_opened"
  | "email_replied"
  | "email_bounced"
  | "email_clicked"
  | "signal_detected"
  | "deal_stale"
  | "meeting_completed"
  | "contact_enriched"
  | "sequence_completed"
  | "inbound_email"
  | "deal_stage_changed"
  | "daily_sweep"; // fallback from cron
```

## Decision Schema

The LLM returns a structured decision:

```typescript
interface AgentDecision {
  actions: AgentAction[];
  reasoning: string;
  confidence: number;
}

interface AgentAction {
  type: "send_followup" | "draft_reply" | "advance_deal" | "create_task"
      | "create_deal" | "enroll_sequence" | "alert_founder" | "research_company"
      | "enrich_contact" | "hold";
  params: Record<string, unknown>;
  expectedOutcome: string;
}
```

## Data Model Changes

### New table: `agent_reactions`

Tracks every evaluation the agent makes, whether it acts or not.

```sql
CREATE TABLE agent_reactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  trigger TEXT NOT NULL,           -- AgentTrigger enum
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  deduplication_key TEXT NOT NULL,
  context_snapshot JSONB NOT NULL, -- what the agent saw
  decision JSONB NOT NULL,         -- AgentDecision
  actions_taken INTEGER NOT NULL DEFAULT 0,
  actions_deferred INTEGER NOT NULL DEFAULT 0,
  actions_skipped INTEGER NOT NULL DEFAULT 0,
  processing_time_ms INTEGER,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_reactions_dedup ON agent_reactions(tenant_id, deduplication_key);
CREATE INDEX idx_agent_reactions_entity ON agent_reactions(tenant_id, entity_type, entity_id);
```

## Deduplication Strategy

Before processing, check if `deduplication_key` exists in `agent_reactions`
within the last 60 minutes. If so, skip.

The deduplication key is constructed as: `{trigger}:{entityType}:{entityId}`

For burst events (multiple opens), this collapses them into one evaluation.

## Context Loading

Reuse existing functions where possible:

1. Entity data: direct Drizzle query for company/contact/deal
2. Recent activities: `WHERE entityId = ? ORDER BY occurredAt DESC LIMIT 10`
3. Active sequences: join sequenceEnrollments
4. Signals: join with signal detectors
5. Past agent actions: `WHERE entityId = ? ORDER BY createdAt DESC LIMIT 5`
6. ICP/business context: from tenantSettings

Budget: keep context under 4000 tokens to leave room for decision.

## LLM Decision

Model: Claude Haiku 4.5 (fast, cheap — this runs on every event)
Fallback: rule-based heuristics if LLM unavailable

System prompt: concise, structured — tell the agent what happened, what it
knows about the entity, and ask for a decision in JSON format.

Temperature: 0.2 (deterministic decisions)

## Concurrency & Rate Limiting

- Inngest concurrency: 5 per tenant (prevents one tenant from monopolizing)
- Inngest throttle: max 60 events per tenant per hour
- Batch processing: if >5 events queue for same tenant, process as batch

## Failure Handling

- LLM timeout (>10s): fall back to rule-based heuristics
- LLM error: retry once, then log and skip
- DB write failure: retry via Inngest built-in retry (3 attempts)
- Invalid decision schema: log warning, take no action

## Rule-Based Fallback Heuristics

When LLM is unavailable:
- `email_opened` + deal exists → no action (just track)
- `email_replied` + positive → advance deal to next stage
- `email_bounced` → pause enrollment, alert founder
- `signal_detected` + no deal → create lead-stage deal
- `deal_stale` >14 days → create follow-up task
- `meeting_completed` → create follow-up task for next day

## Integration Points

### Emitters (fire `agent/react`)

1. `webhooks/resend/route.ts` — on open/click/bounce events
2. `webhooks/emailengine/route.ts` — on reply received
3. `inngest/functions.ts` — after enrichment completes
4. `inngest/signal-to-sequence.ts` — when signal detected (before auto-enroll)
5. `inngest/reply-handler.ts` — after reply classified
6. Email sync function — on new inbound email
7. New daily sweep cron — for deal_stale detection

### Consumers (read `agent_reactions`)

1. Chat system prompt — "Recent agent decisions" section
2. Home dashboard — feed of agent actions
3. Outcome tracking (F003) — links reactions to outcomes
