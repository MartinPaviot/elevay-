# ROX-GAP-1 — Multi-Step Command Orchestration

## User Story

As a founder using the chat, I want to give a single complex instruction like "Find CFOs at fintech companies that raised Series B, enrich them, and start a 3-step email sequence" and have the agent execute all steps autonomously, instead of asking me to confirm each step individually.

## Background

Rox's "Command" feature lets users issue compound instructions that trigger chains of actions. Currently Elevay's chat executes one tool at a time — the user says "find leads at acme.com", waits for results, then says "enrich them", then "create a sequence". The orchestration is manual.

## Acceptance Criteria

### AC1: Multi-tool chaining
GIVEN the user sends a compound instruction in chat
WHEN the instruction implies 2+ sequential tool calls
THEN the agent executes them in order without asking for intermediate confirmation
AND shows progress as each step completes ("Step 1/3: Finding leads... Step 2/3: Enriching... Step 3/3: Creating sequence...")

### AC2: Rollback on failure
GIVEN a multi-step chain where step N fails
WHEN step N < total steps
THEN the agent stops execution, reports what succeeded vs what failed
AND does NOT undo already-completed steps (they produced valid data)

### AC3: Approval-mode respect
GIVEN the tenant has `agentApprovalMode = "ask"` or `"manual"`
WHEN a chain includes an action that sends an email or modifies a deal
THEN the agent pauses at that step and asks for confirmation
AND continues the chain after approval

### AC4: Progress streaming
GIVEN a multi-step chain is executing
WHEN each step starts/completes
THEN the chat UI shows a live progress indicator with step name and status

## Edge Cases

- User cancels mid-chain → agent stops, reports partial results
- One step returns empty results (e.g., no leads found) → agent skips dependent steps, explains why
- Chain includes a skill that takes >30s → agent shows "still working on step N..." message
- Circular dependencies → agent detects and refuses
