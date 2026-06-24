import { getAuthContext } from "@/lib/auth/auth-utils";
import { computeCampaignRollups } from "@/lib/analytics/rollups/db-rollups";

/**
 * GET /api/analytics/rollups — spec 29. Campaign-dimension rollups (sent /
 * delivery / reply / positive / bounce / spam counts + rates + benchmark flags +
 * variant·step attribution) computed on-read from outbound_emails over the last
 * 30 days. Tenant-scoped, read-only. (A metric_events table + daily cron would
 * amortize this for high-volume tenants — a documented follow-up.)
 */
export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rollups = await computeCampaignRollups(authCtx.tenantId);
    return Response.json(rollups);
  } catch (error) {
    console.error("Failed to compute campaign rollups:", error);
    return Response.json({ error: "Failed to compute rollups" }, { status: 500 });
  }
}
