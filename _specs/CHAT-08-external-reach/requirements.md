# CHAT-08 — Requirements

## User stories

> **U1** (GTM rep): I want to ask LeadSens questions and trigger actions from Slack so I don't have to switch contexts.

> **U2** (GTM rep): I want to connect Claude Desktop / ChatGPT / Cursor to my LeadSens workspace so my favorite AI client can read and write CRM data on my behalf.

> **U3** (Admin): I want to audit external (Slack/MCP) tool calls separately from in-app calls.

## Acceptance criteria

### AC1 — Slack install + auth
- **GIVEN** a tenant admin
- **WHEN** they click "Add to Slack" from `/settings/integrations`
- **THEN** a standard Slack OAuth flow launches, scopes include `commands`, `chat:write`, `app_mentions:read`, `im:history`, `users:read`
- **AND** on success, a row lands in `slack_installations` (new table) with `{tenantId, slackTeamId, botToken (encrypted), installedByUserId}`
- **AND** the user lands back on `/settings/integrations` showing "Connected to <workspace>"

### AC2 — Slack slash command (read)
- **GIVEN** a Slack user whose email matches a LeadSens user in the same installed workspace
- **WHEN** they run `/leadsens show my pipeline health`
- **THEN** the bot acknowledges within 3 s (Slack's deadline)
- **AND** posts a streamed response in the channel where the command was run
- **AND** the trace in `agentTraces` has `surfaceType='slack'` and references the user

### AC3 — Slack @mention (read)
- **GIVEN** the bot is in a channel
- **WHEN** a user `@leadsens who are the decision-makers at acme.com?`
- **THEN** the bot replies threaded to the original message with the answer

### AC4 — Slack interactive writes (v1 w/ approval)
- **GIVEN** the resolver detects the user intent is a mutation
- **WHEN** it would normally produce an ActionCard in-app
- **THEN** Slack receives an interactive message with **Approve** / **Deny** buttons containing the pending mutation spec
- **AND** on Approve, the mutation executes and the bot replies confirming
- **AND** on Deny, the bot replies "cancelled"
- **AND** destructive tools (in `DESTRUCTIVE_TOOLS`) are never offered on Slack (CHAT-08 v1)

### AC5 — Public MCP server
- **GIVEN** a user has an account at LeadSens
- **WHEN** they point Claude Desktop (or Cursor/ChatGPT) to `https://mcp.leadsens.com/mcp` with OAuth
- **THEN** login succeeds via NextAuth OAuth provider (Google or Microsoft — same as the web app)
- **AND** the MCP tool list returned contains **≥ 40 tools** (filtered via resolver with `surface={type: "mcp"}`, role preserved, `allowDestructive=false`, `planTier` from billing)
- **AND** `createContact { firstName: "Test", email: "ext@test.com" }` via the MCP client persists a contact visible in the LeadSens web UI
- **AND** `agentTraces` records `surfaceType='mcp'` plus a `mcpClient` string parsed from User-Agent

### AC6 — External surface attribution in observability
- **GIVEN** a mix of in-app + Slack + MCP traffic
- **WHEN** I query `agentTraces GROUP BY surfaceType`
- **THEN** rows separate cleanly into `global`, `contact`, `account`, `deal`, `meeting`, `list`, `slack`, `mcp`
- **AND** the per-tool dashboard (CHAT-09) shows per-surface success rates

## Edge cases

1. **Slack user not in LeadSens**: bot replies with "this user isn't linked to a LeadSens account" + onboarding instructions. Never queries tenant data for an unmapped user.
2. **Slack user in multiple LeadSens tenants**: requires explicit `/leadsens --workspace=<slug>` until multi-tenant Slack is designed (deferred).
3. **MCP session timeout**: NextAuth refresh. If the refresh fails, MCP client gets a clean 401 with re-auth URL.
4. **MCP tool schema update between client caches**: the MCP SDK handles this; ship the tool list as dynamic not static.
5. **Slack button click after thread archived**: interactive button returns a graceful "this approval expired" message.

## Out of scope

- Slack Enterprise Grid cross-workspace features.
- Cross-tenant Slack (one Slack workspace → multiple LeadSens tenants).
- MCP resource discovery beyond tools (future v2 — expose entity type schemas as MCP `resources`).
- Voice interfaces.
- Mobile push notifications.

## Evaluation steps (manual QA before merge)

1. Fresh Slack workspace: install LeadSens app, run `/leadsens pipeline` → expect pipeline summary in channel.
2. In a channel with the bot: `@leadsens create a task for John about Q2 renewal` → expect interactive Approve/Deny.
3. Click Approve → task created, visible in `/tasks` in the LeadSens UI.
4. Claude Desktop: configure MCP at `mcp.leadsens.com`, log in via Google → expect 40+ tools listed.
5. Claude Desktop: `createContact` → row appears in LeadSens UI with `agentTraces` row tagged `surfaceType='mcp'`.
6. Admin `/settings/audit` (from CHAT-04 deferred work): filter by surfaceType=slack → sees the task creation with the Slack interactive approval trail.
