# F009 — Conversational Onboarding

## User Story

As a founder signing up, I want to describe my business in a conversation
("I sell monitoring to CTOs at B2B SaaS companies in Europe") and have the
agent configure everything — ICP, stages, signals, knowledge — without
me ever touching a settings form.

## Acceptance Criteria

### AC-1: Chat replaces the wizard

GIVEN a new user completes auth
WHEN they land on the app for the first time
THEN they see a chat interface (not the 7-step wizard)
AND the agent asks: "Tell me about your business and who you sell to"
AND from the conversation, it infers: product description, ICP (industries,
  sizes, roles, geographies), sales motion, tone
AND it confirms: "I've set up your ICP as [summary]. Want me to adjust anything?"

### AC-2: Agent configures pipeline stages from context

GIVEN the agent knows the sales motion
WHEN it sets up the pipeline
THEN it proposes stages appropriate to the motion
  (e.g., inbound: Lead → Qualified → Demo → Trial → Close
   outbound: Cold → Warm → Meeting → Proposal → Close)
AND the user can accept or modify via chat

### AC-3: Settings pages become read-only after onboarding

GIVEN the agent configured all settings via conversation
WHEN the user navigates to /settings/icp or /settings/stages
THEN they see the current configuration in read-only view
AND a "Reconfigure via chat" button that opens the chat

### AC-4: Email/calendar connection stays as OAuth flow

GIVEN email connection requires OAuth
THEN the agent says "Connect your email so I can start working"
AND shows the OAuth button inline in the chat
AND after connection, the agent continues the setup

## Implementation Notes

- Reuse the existing chat agent tools (updateICP, updatePipelineStages, etc.)
- The onboarding chat is a special thread with contextType="onboarding"
- The system prompt variant for onboarding is discovery-focused
- Feature flag: `onboarding.v3.conversational`
