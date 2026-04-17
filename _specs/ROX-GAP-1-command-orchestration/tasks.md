# ROX-GAP-1 — Tasks

## T1: Update chat system prompt with orchestration instructions
- File: `src/lib/prompts/chat-system-prompt.ts`
- Add section instructing LLM to chain tools on compound requests
- Include progress format: "Step N: [action]... done"
- Include approval-mode pause rules
- Verify: prompt includes "execute sequentially without intermediate confirmation"

## T2: Increase maxSteps in chat route
- File: `src/app/api/chat/route.ts`
- Find `maxSteps` or `stepCountIs` configuration
- Set to 10 (allowing up to 10 sequential tool calls per turn)
- Verify: `maxSteps` is at least 10

## T3: Test compound instruction
- Start dev server
- Send: "Show me my top 3 accounts by score, then analyze the pipeline"
- Verify: agent calls queryAccounts → analyzePipeline sequentially without asking
- Verify: progress shown in stream

## T4: Test approval-mode pause
- Set tenant `agentApprovalMode` to "ask"
- Send: "Draft and send a follow-up email to my top deal contact"
- Verify: agent drafts the email, then pauses with "Awaiting your approval..."
- Verify: agent does NOT auto-send
