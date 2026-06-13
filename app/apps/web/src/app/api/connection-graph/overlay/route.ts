import { getAuthContext } from "@/lib/auth/auth-utils";
import { isConnectionGraphEnabled } from "@/lib/connection-graph/config";
import { getIcpOverlay } from "@/lib/connection-graph/repository";
import { NextResponse } from "next/server";

/**
 * GET /api/connection-graph/overlay
 *
 * The "you're already connected to N people at ICP accounts" overlay for
 * the signed-in user's own LinkedIn graph (personal scope).
 *
 * DORMANT: returns 404 when the feature is disabled (prod default) — the
 * same prod-hidden posture as the billing/TAM-proposals surfaces. Becomes
 * live only when LINKEDIN_GRAPH_ENABLED is set AND a provider has ingested
 * the user's edges.
 */
export async function GET(req: Request) {
  if (!isConnectionGraphEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const authCtx = await getAuthContext();
  if (!authCtx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url, "http://localhost");
  const minFit = Math.min(1, Math.max(0, Number(searchParams.get("minFit") || 0.5)));

  const assets = await getIcpOverlay(authCtx.userId, authCtx.tenantId, minFit);

  // Distinct ICP-fit accounts the founder has an insider at.
  const accountCount = new Set(assets.map((a) => a.companyId)).size;

  return NextResponse.json({
    accountCount,
    connectionCount: assets.length,
    assets,
  });
}
