# F010 — Feed-First UI

## User Story

As a founder, I want my primary view to be a feed of what the agent did
and what it recommends — not a dashboard with charts and numbers. The agent
acts, I supervise.

## Acceptance Criteria

### AC-1: Default view is the agent activity feed

GIVEN the user opens the app
WHEN they land on the home page
THEN they see a reverse-chronological feed of agent actions:
  - "Sent follow-up to John at Acme (deal stale 12 days)"
  - "Created deal for FinTech Co after funding signal detected"
  - "Drafted reply to Sarah's objection about pricing — review?"
  - "Enrolled 5 contacts from Series A companies into outbound sequence"

### AC-2: Feed items are actionable

GIVEN a feed item is a deferred action (needs approval)
THEN it shows approve/dismiss buttons inline
AND the user can approve or modify without leaving the feed

### AC-3: Feed items link to entities

GIVEN a feed item references a deal, contact, or company
THEN clicking the entity name opens the detail view

### AC-4: Feed is real-time

GIVEN the agent reactor processes an event
WHEN the user has the feed open
THEN the new action appears within 5 seconds (via SSE or polling)

### AC-5: CRUD pages become secondary

GIVEN the feed is the primary view
THEN /contacts, /accounts, /opportunities become drill-down views
AND the sidebar navigation deprioritizes them below the feed

## Data Source

The feed reads from `agent_reactions` and `agent_actions` tables joined:
- agent_reactions: what the agent decided and why
- agent_actions: what was executed or deferred
- agent_work_items: current strategy context

## Implementation Notes

- New route: /home or / (replaces current dashboard)
- Component: AgentFeed — reads agent_reactions + agent_actions
- Approval inline: uses existing agent-actions API
- Real-time: SSE endpoint or 10-second polling
