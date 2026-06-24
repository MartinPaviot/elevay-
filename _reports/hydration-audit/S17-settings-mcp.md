# S17 — settings-mcp (`/settings/mcp`) — audit d'hydratation

**Verdict global : H1 (fidèle).** The MCP settings page is data-faithful (H1). Its one data-bearing element — the API Keys list — loads from real tenant-scoped persisted config (getTenantSettings via eq(tenants.id, tenantId)), with create/revoke fully round-tripping through updateTenantSettings and the list refetched after each mutation. Loading, empty, and error states are all handled. All remaining content (server URL, protocol, setup snippets, available-tools catalog) is static help/chrome correctly rendered as H0. Note the page is admin-gated and dev-only (MCP_PAGE_ENABLED = NODE_ENV !== 'production'), so it 404s in prod — but the underlying API stays live.

Entrée : `app/apps/web/src/app/(dashboard)/settings/mcp/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| API Keys list (per-key card: name, prefix, created date, last-used badge) | app/apps/web/src/app/(dashboard)/settings/mcp/mcp-client.tsx:305-351 | GET /api/mcp/keys → getTenantSettings(authCtx.tenantId).mcpApiKeys (route.ts:23-46; tenant-settings.ts:542-557 eq(tenants.id,tenantId)) | H1 | yes | none | handled | global | once | Faithful: list loads from real tenant-scoped persisted config; values masked (keyPrefix, never raw). Refetched after create/revoke so it reflects back. lastUsedAt badge only renders when present. |
| Loading state for key list | app/apps/web/src/app/(dashboard)/settings/mcp/mcp-client.tsx:280-283 | loading flag from fetchKeys (mcp-client.tsx:30-41) | H1 | yes | spinner | handled | global | once | Text 'Loading...' shown until fetch resolves; not a permanent skeleton. |
| Empty state ('No API keys yet') | app/apps/web/src/app/(dashboard)/settings/mcp/mcp-client.tsx:284-303 | keys.length === 0 (mcp-client.tsx:35) | H1 | yes | none | handled | global | once | Written empty state with icon + CTA copy when tenant has no keys. |
| Create key form (name input + Generate) | app/apps/web/src/app/(dashboard)/settings/mcp/mcp-client.tsx:235-270 | POST /api/mcp/keys → updateTenantSettings persists entry (route.ts:50-119) | H1 | yes | spinner | n/a | global | once | Persists hashed key to tenant settings (max 5 enforced server-side); raw key revealed once via banner; list refetched (line 64). Round-trips. |
| Revealed-key banner | app/apps/web/src/app/(dashboard)/settings/mcp/mcp-client.tsx:171-211 | data.key.rawKey from POST response (mcp-client.tsx:61) | H1 | yes | none | n/a | global | once | Shows the freshly generated real key (only time it's returned), with copy/dismiss. |
| Revoke key (ConfirmDialog → DELETE) | app/apps/web/src/app/(dashboard)/settings/mcp/mcp-client.tsx:339-347,503-512 | DELETE /api/mcp/keys → updateTenantSettings filters key (route.ts:128-176) | H1 | yes | spinner | n/a | global | once | Removes key from tenant settings, busy flag on dialog, list refetched after; 404 if key not found in tenant. |
| MCP Server URL code block + Copy | app/apps/web/src/app/(dashboard)/settings/mcp/mcp-client.tsx:131-155 | static: window.location.origin + '/api/mcp' (mcp-client.tsx:107-110) | H0 | n/a | none | n/a | n/a | static | Derived from browser origin, not tenant data — correct chrome/help. Same shared MCP endpoint for all tenants (auth via per-tenant key). |
| Protocol description | app/apps/web/src/app/(dashboard)/settings/mcp/mcp-client.tsx:157-164 | static hardcoded copy | H0 | n/a | none | n/a | n/a | static | Pure help text — correctly H0. |
| Setup instructions (Claude Desktop / Code / cURL snippets) | app/apps/web/src/app/(dashboard)/settings/mcp/mcp-client.tsx:356-453 | static copy with mcpUrl interpolated (mcp-client.tsx:107-110) | H0 | n/a | none | n/a | n/a | static | Documentation snippets — correctly H0. |
| Available Tools list | app/apps/web/src/app/(dashboard)/settings/mcp/mcp-client.tsx:467-497 | hardcoded array literal (mcp-client.tsx:468-481) | H0 | n/a | none | n/a | n/a | static | Static documentation of the MCP tool catalog, not tenant-scoped config — correct as H0. (Could drift from actual server tool registry, but it's help copy, not a data-bearing control.) |

## Pires défauts

1. Minor: error handling is global (single error string at mcp-client.tsx:272-276) rather than per-control, and a GET failure shows the generic 'Failed to load API keys' rather than a retry affordance — acceptable but not ideal.
2. Cosmetic: the 'Available Tools' list (mcp-client.tsx:468-481) is a hardcoded array that can silently drift from the actual MCP server tool registry; it's help copy (H0) not config, so not a hydration defect, but it isn't sourced from the server's real tool list.
3. Page is gated to non-production (admin-tools-visibility.ts:17), so end customers never see this control even though the backing /api/mcp keys API is live — visibility, not a hydration, gap.
