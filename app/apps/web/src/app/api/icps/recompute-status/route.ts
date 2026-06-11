/**
 * GET /api/icps/recompute-status — the editor's diff-after-save poll
 * (Phase 1, _specs/icp-unification R7.1).
 *
 * Returns tenants.settings.lastIcpRecompute, written by the recompute's
 * final step (Phase 0 R3.3). The editor polls this every 3 s after a
 * save until `at` postdates the save, then shows
 * "N regraded (X up, Y down), Z unowned".
 */

import { getAuthContext } from "@/lib/auth/auth-utils";
import { getTenantSettings } from "@/lib/config/tenant-settings";

export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await getTenantSettings(authCtx.tenantId);
  return Response.json({ lastIcpRecompute: settings.lastIcpRecompute ?? null });
}
