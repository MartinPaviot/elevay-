# CHAT-08 — Tasks

Copy of the implementation plan. Design rationale lives in office-hours.md + design.md.

## Phase A — Slack integration (≈3 weeks)

- **A.1** Schema + migration 0016_slack.sql (slack_installations + pending_slack_approvals tables).
- **A.2** Install `@slack/bolt` + `@slack/web-api`. Add SLACK_CLIENT_ID / SLACK_CLIENT_SECRET / SLACK_SIGNING_SECRET env vars.
- **A.3** `GET /api/slack/install` + `GET /api/slack/oauth/callback`. UI "Connect Slack" button in /settings/integrations.
- **A.4** `lib/slack/app.ts` factory (per-installation Bolt app); `lib/slack/user-map.ts` Slack↔LeadSens user via email.
- **A.5** `/leadsens` slash command handler. Ack ≤3s, run async, post via response_url. Uses buildAllChatTools + resolver(surface="slack").
- **A.6** `app_mention` event handler. Threaded replies.
- **A.7** Interactive approval for mutations: pending_slack_approvals row + Approve/Deny message.
- **A.8** E2E in a dev Slack workspace.

## Phase B — Public MCP (≈2 weeks)

- **B.1** Install `@modelcontextprotocol/sdk`.
- **B.2** Migration 0017: agent_traces.mcp_client column. Extend TraceMetadata.
- **B.3** `lib/mcp/zod-to-jsonschema.ts` adapter (zod → JSON-Schema 7).
- **B.4** `lib/mcp/server.ts` — per-request MCP Server instance, ToolContext derived from session, buildAllChatTools + resolver(surface="mcp").
- **B.5** `GET /api/mcp/sse` (SSE transport).
- **B.6** `POST /api/mcp/messages` (JSON-RPC). Parse User-Agent → trace.mcpClient.
- **B.7** Subdomain `mcp.leadsens.com` via DNS + route config.
- **B.8** E2E with Claude Desktop, Cursor, ChatGPT.

## Phase C — Hardening + launch (≈1 week)

- **C.1** Rate limits: Slack per-tenant, MCP per-user.
- **C.2** /admin/evals per-surface dashboard overlap (CHAT-09).
- **C.3** Public docs at docs.leadsens.com/mcp + /slack.
- **C.4** Feature flag flip to true.

## Exit criteria

All 8 AC items in requirements.md pass. agentTraces shows surfaceType attribution across `global`, surface variants, `slack`, `mcp`. No regression in in-app chat.
