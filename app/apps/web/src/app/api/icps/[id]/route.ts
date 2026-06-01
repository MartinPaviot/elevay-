/**
 * GET    /api/icps/[id]  — one ICP + its criteria
 * PATCH  /api/icps/[id]  — replace name/status/priority/criteria
 * DELETE /api/icps/[id]  — delete the ICP (cascades criteria + fit rows)
 *
 * All tenant-scoped. PATCH re-validates against the catalog and
 * replaces the criteria set wholesale (simpler + race-free than diffing).
 * Mutations re-trigger the tenant recompute.
 */

import { getAuthContext, requireAdmin } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { icps, icpCriteria } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { validateIcpInput } from "@/lib/icp/validation";
import { resolveCatalogForValidation } from "@/lib/icp/catalog-db";
import { inngest } from "@/inngest/client";

async function loadOwnedIcp(id: string, tenantId: string) {
  const [icp] = await db
    .select()
    .from(icps)
    .where(and(eq(icps.id, id), eq(icps.tenantId, tenantId)))
    .limit(1);
  return icp ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const icp = await loadOwnedIcp(id, authCtx.tenantId);
  if (!icp) return Response.json({ error: "ICP not found" }, { status: 404 });

  const criteria = await db
    .select()
    .from(icpCriteria)
    .where(eq(icpCriteria.icpId, id));

  return Response.json({ icp, criteria });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const adminCheck = requireAdmin(authCtx);
  if (adminCheck) return adminCheck;
  const { id } = await params;

  const icp = await loadOwnedIcp(id, authCtx.tenantId);
  if (!icp) return Response.json({ error: "ICP not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const catalog = await resolveCatalogForValidation(authCtx.tenantId);
  const validation = validateIcpInput(body as Record<string, unknown>, catalog);
  if (!validation.ok) {
    return Response.json({ error: validation.error }, { status: 400 });
  }
  const { name, status, priority, description, criteria } = validation.value;

  await db.transaction(async (tx) => {
    await tx
      .update(icps)
      .set({ name, status, priority, description, updatedAt: new Date() })
      .where(eq(icps.id, id));
    // Replace the criteria set wholesale.
    await tx.delete(icpCriteria).where(eq(icpCriteria.icpId, id));
    if (criteria.length > 0) {
      await tx.insert(icpCriteria).values(
        criteria.map((c) => ({
          icpId: id,
          fieldKey: c.fieldKey,
          operator: c.operator,
          value: c.value as object,
          weight: c.weight,
          isRequired: c.isRequired,
        })),
      );
    }
  });

  inngest
    .send({ name: "icp/recompute-tenant", data: { tenantId: authCtx.tenantId } })
    .catch(() => {});

  return Response.json({ id, name, status, priority });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const adminCheck = requireAdmin(authCtx);
  if (adminCheck) return adminCheck;
  const { id } = await params;

  const icp = await loadOwnedIcp(id, authCtx.tenantId);
  if (!icp) return Response.json({ error: "ICP not found" }, { status: 404 });

  // icp_criteria + company_icp_fit cascade via FK ON DELETE CASCADE.
  await db.delete(icps).where(eq(icps.id, id));

  inngest
    .send({ name: "icp/recompute-tenant", data: { tenantId: authCtx.tenantId } })
    .catch(() => {});

  return Response.json({ deleted: id });
}
