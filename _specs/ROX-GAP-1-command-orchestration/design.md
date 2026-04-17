# ROX-GAP-1 — Design: Multi-Step Command Orchestration

## System Fit

The chat route (`src/app/api/chat/route.ts`) already supports tool use via the AI SDK's `streamText` with `maxSteps`. The current `maxSteps` likely limits the number of sequential tool calls. The fix is primarily in the system prompt — instructing the LLM to chain tools without asking confirmation — plus a higher `maxSteps` ceiling.

## Approach

### Option A: Increase maxSteps + prompt engineering (CHOSEN)
- Set `maxSteps: 10` (currently likely 3-5)
- Update the chat system prompt to include orchestration instructions
- The LLM naturally chains tools when given permission
- Cheapest change, leverages existing infrastructure

### Option B: Explicit orchestration engine
- Parse compound instructions into a plan → execute plan steps
- More reliable but requires a planner LLM call + execution loop
- Over-engineered for current needs

## Data Flow

```
User: "Find CTOs at fintech companies, enrich them, create a sequence"
  ↓
Chat route (maxSteps: 10)
  ↓ Step 1: LLM calls buildTAM or findLeadsByDomain
  ↓ Step 2: LLM calls enrichContact for each result
  ↓ Step 3: LLM calls createSequence with the enriched contacts
  ↓ Step 4: LLM summarizes what was done
  ↓
Streamed to user with per-step progress
```

## Changes Required

### 1. Chat system prompt (`src/lib/prompts/chat-system-prompt.ts`)
Add orchestration instructions:
```
When the user gives a compound instruction that requires multiple tools,
execute all steps sequentially without asking for intermediate confirmation.
Show progress as you go: "Step 1: [action]... done. Step 2: [action]..."
If a step fails, report what succeeded and what failed — do not undo
completed steps. If the tenant requires approval for emails/deal changes,
pause at that specific step and ask.
```

### 2. Chat route (`src/app/api/chat/route.ts`)
- Increase `maxSteps` from current value to 10
- Ensure `stepCountIs` guard allows enough steps

### 3. No schema changes needed
### 4. No new files needed

## Failure Handling

- Step fails → LLM reports failure in the stream, stops chain
- Timeout → AI SDK handles via `maxDuration`
- Approval-gated step → LLM writes "Awaiting your approval for..." and stops

## Security

- No new attack surface — same tools, same auth context
- Approval mode respected for sensitive actions
- `maxSteps: 10` caps runaway loops
