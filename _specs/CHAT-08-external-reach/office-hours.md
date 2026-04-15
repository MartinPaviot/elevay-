# CHAT-08 — Office Hours

## Problem statement (one sentence)

LeadSens chat is locked inside the `/chat` page and a handful of detail-page side panels; to reach parity with Attio (and beat their Slack read-only limitation) the chat needs to be accessible from Slack (read + write) and from external MCP clients (Claude Desktop, ChatGPT, Cursor) via OAuth-authenticated tool access.

## Why now

The capability resolver (CHAT-02) already shapes tool access per surface — `surface.type = "slack"` and `"mcp"` are first-class. The tool registry (CHAT-01, 113 tools) is complete enough to offer meaningful external reach. The undo layer (CHAT-04) is instrumented on 11 tools, so Slack writes can be bounded to reversible ops for safety. The remaining blocker is transport: Slack Events API + OAuth flow, MCP JSONRPC protocol + OAuth domain.

## Premise challenge — is this the right thing to build next?

**Alternative 1: Skip Slack, ship MCP only.**
- Pro: MCP unlocks Claude Desktop / ChatGPT / Cursor, reaches developer users immediately.
- Con: Slack is where GTM teams live; skipping it leaves the "Attio is read-only, we're better" story on the floor. And Slack UX is the higher bar — if we can nail Slack, MCP is easier.
- Verdict: reject. Ship both in CHAT-08.

**Alternative 2: Wrap each tool call in a Slack message round-trip by hand.**
- Pro: no shared infra needed.
- Con: per-call handcoding won't scale; resolver + tool registry become decorative.
- Verdict: reject. Use the shared registry and adapt transport.

**Alternative 3 (chosen): One Slack Bolt app + one public MCP SSE endpoint, both routed through `resolveCapabilities` + `buildAllChatTools`.**
- Pro: single integration point. Slack interactive buttons handle approval for writes. MCP OAuth domain separates external traffic from in-app. Both reuse all existing tool logic.
- Con: Slack OAuth requires app-listing review (can ship as "private" first). MCP requires a stable OAuth provider (we already have NextAuth).

## Layer check (CLAUDE.md three-layer rule)

- **Layer 1 — tried and true**: Slack Bolt SDK for Node, `@modelcontextprotocol/sdk` for MCP transport. Both battle-tested.
- **Layer 2 — new and popular**: MCP is ~6mo old — popular but fast-moving. Lock to the current stable (0.5.x or whatever is latest at implementation time).
- **Layer 3 — first principles**: Nothing to invent. Integrations are reductions to existing transports.

## Completeness target

**8/10 for v1 ship, then iterate to 10/10.**

v1 (8/10):
- Slack slash command `/leadsens <query>` works, returns streamed response.
- Slack `@leadsens` mentions work in channels + DMs.
- Write ops via Slack interactive buttons (approve/deny).
- Public MCP at `mcp.leadsens.com/mcp`, OAuth-only, 40+ tools (subset of the 113 registry — destructive tools gated, admin-only tools gated by role).
- Tested end-to-end against Claude Desktop.

Deferred to v2 (10/10):
- `@leadsens` auto-react on mentions in any channel (not just where the app is installed).
- MCP resource discovery (beyond the 40 tools, expose entity schemas as MCP resources).
- Cross-workspace Slack (one Slack workspace serving multiple LeadSens tenants).
- Attio-parity: MCP tool for every single registry tool (113).

## Known pitfalls to avoid

1. **Don't put OAuth secrets in the tenant settings JSON.** Use a dedicated `slack_installations` table (FK on tenantId). MCP uses NextAuth sessions — no new secrets.
2. **Don't forget rate limits.** Slack has per-app posting limits; MCP has per-token call limits. Wrap all outbound with the existing `checkRateLimit` helper.
3. **Destructive tools are OFF on Slack even when `allowDestructive=true` at tenant level.** Slack UX has no reliable way to do two-step confirmation (interactive buttons get disabled after 15 min, user may have left the channel).
4. **MCP auth must be per-user, not per-workspace.** Each OAuth login gets its own session, scoped to that user's permissions. Admin-only tools stay admin-only even in MCP.
5. **Don't ship public MCP without logging.** Every external MCP call lands in `agentTraces` with `surfaceType='mcp'` and ideally an externalClientId (Claude Desktop vs ChatGPT vs Cursor identified via user-agent).

## Definition of done for CHAT-08

- Slack app installable on a workspace, `/leadsens` works end-to-end for 5 canned scenarios (see `_specs/CHAT-08-external-reach/requirements.md` AC1-AC5).
- MCP server at `mcp.leadsens.com`, OAuth login succeeds, Claude Desktop lists ≥ 40 tools, `createContact` executes and shows up in the LeadSens UI.
- `agentTraces` rows confirm `surfaceType` is correctly attributed on both surfaces.
- Capability resolver filters correctly for both surfaces (Slack blocks mutations pre-v2, MCP gates destructive/admin).
- No regression: chat/route.ts still works unchanged for in-app users.
