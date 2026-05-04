# F002 — Agent State Machine

## User Story

As a founder, I want the AI agent to remember what it's tracking, what
strategy it's following per deal, and what it planned to do next — so that
it behaves like a persistent employee, not a stateless chatbot that forgets
everything between sessions.

## Acceptance Criteria

### AC-1: Agent maintains a work queue

GIVEN the agent takes or plans an action
WHEN the action involves a deal, contact, or company
THEN the agent creates or updates a work item tracking:
  - Entity being tracked (deal, contact, company)
  - Current strategy (nurture, push, re-engage, monitor)
  - Next planned action and when
  - Priority level (critical, high, medium, low)
  - Reasoning for current strategy
AND this work queue persists across chat sessions

### AC-2: Agent state loaded into chat context

GIVEN a user opens a new chat session
WHEN the system prompt is assembled
THEN it includes the agent's current work queue (top 10 items by priority)
AND the agent can reference its own prior decisions naturally
AND the agent can say "I was planning to follow up with Acme tomorrow"

### AC-3: Agent state loaded into reactor context

GIVEN the agent reactor (F001) evaluates an event
WHEN it loads context for the entity
THEN it includes the agent's current work item for that entity (if any)
AND uses the existing strategy to inform its decision
AND updates the work item after making a decision

### AC-4: Agent updates strategy based on events

GIVEN the agent has a strategy for a deal (e.g., "nurture")
WHEN a significant event occurs (positive reply, meeting booked, signal)
THEN the agent evaluates whether to change strategy
AND updates the work item with the new strategy and reasoning

### AC-5: Completed items are archived

GIVEN a deal is won or lost
WHEN the agent detects the closure
THEN it archives the work item with final outcome
AND the archived item is available for F003 outcome analysis

## Edge Cases

- Agent has 100+ active work items → load only top 10 by priority into context
- Work item for deleted entity → auto-archive with reason "entity_deleted"
- Conflicting strategies (reactor says push, user says hold) → user override wins, agent records override
- New tenant with no data → empty work queue, agent bootstraps from first events
