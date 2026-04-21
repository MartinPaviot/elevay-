import { getAuthContext } from "@/lib/auth-utils";
import { findWarmPathsToCompany } from "@/lib/relationship-graph";

/**
 * GET /api/warm-paths?companyId=UUID
 *
 * Returns warm paths (one-hop) from any tenant user to contacts at
 * the requested company. Used by the accounts list "Connected to"
 * column and the account detail page to surface founder-led
 * warm-intro levers.
 */
export async function GET(req: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) {
    return Response.json({ error: "companyId query param required" }, { status: 400 });
  }

  try {
    const paths = await findWarmPathsToCompany({
      tenantId: authCtx.tenantId,
      companyId,
    });
    return Response.json({ paths });
  } catch (err) {
    console.error("warm-paths: lookup failed", err);
    return Response.json({ error: "warm-paths lookup failed" }, { status: 500 });
  }
}
