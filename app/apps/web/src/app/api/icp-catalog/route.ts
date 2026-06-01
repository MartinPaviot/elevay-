/**
 * GET /api/icp-catalog
 *
 * Returns the effective field catalog for the tenant (global Apollo
 * standard fields + tenant custom). Feeds the rule-builder's field
 * picker. Read-only.
 */

import { getAuthContext } from "@/lib/auth/auth-utils";
import { resolveCatalogRows } from "@/lib/icp/catalog-db";

export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const fields = await resolveCatalogRows(authCtx.tenantId);
  return Response.json({ fields });
}
