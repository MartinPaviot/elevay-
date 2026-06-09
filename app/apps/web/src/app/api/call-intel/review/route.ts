/**
 * POST /api/call-intel/review  body { entityType: "deal"|"company"|"contact", entityId, action: "approve"|"dismiss" }
 *
 * Human-in-the-loop for post-call qualification. When the tenant is in
 * captureApprovalMode='review', applyCallToCrm parks the captured facts under a
 * `pending*` namespace on the record. This endpoint resolves a pending proposal:
 *   - approve → the pending value becomes the live value
 *   - dismiss → the pending value is discarded
 * Either way the pending key(s) are removed. Tenant-scoped.
 */
import { getAuthContext } from "@/lib/auth/auth-utils";
import { apiError } from "@/lib/infra/api-errors";
import { db } from "@/db";
import { deals, companies, contacts } from "@/db/schema";
import { and, eq } from "drizzle-orm";

function resolvePending(
  properties: unknown,
  pairs: [pending: string, live: string][],
  action: "approve" | "dismiss",
): { props: Record<string, unknown>; changed: boolean } {
  const props = { ...((properties as Record<string, unknown>) || {}) };
  let changed = false;
  for (const [pendKey, liveKey] of pairs) {
    if (pendKey in props) {
      if (action === "approve") props[liveKey] = props[pendKey];
      delete props[pendKey];
      changed = true;
    }
  }
  return { props, changed };
}

export async function POST(req: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx) return apiError("UNAUTHORIZED", "Authentication required");

  const body = (await req.json().catch(() => ({}))) as {
    entityType?: string;
    entityId?: string;
    action?: string;
  };
  const { entityType, entityId } = body;
  const action = body.action;
  if (!entityId || (action !== "approve" && action !== "dismiss")) {
    return apiError("VALIDATION_ERROR", "entityId and action ('approve'|'dismiss') are required");
  }
  const t = authCtx.tenantId;

  if (entityType === "deal") {
    const [row] = await db.select({ properties: deals.properties }).from(deals).where(and(eq(deals.id, entityId), eq(deals.tenantId, t))).limit(1);
    if (!row) return apiError("NOT_FOUND", "Deal not found");
    const { props, changed } = resolvePending(row.properties, [["pendingMeddic", "meddic"], ["pendingEvidence", "evidence"]], action);
    if (changed) await db.update(deals).set({ properties: props, updatedAt: new Date() }).where(and(eq(deals.id, entityId), eq(deals.tenantId, t)));
    return Response.json({ ok: true, applied: action === "approve" && changed });
  }

  if (entityType === "company") {
    const [row] = await db.select({ properties: companies.properties }).from(companies).where(and(eq(companies.id, entityId), eq(companies.tenantId, t))).limit(1);
    if (!row) return apiError("NOT_FOUND", "Account not found");
    const { props, changed } = resolvePending(row.properties, [["pendingCallIntel", "callIntel"]], action);
    if (changed) await db.update(companies).set({ properties: props, updatedAt: new Date() }).where(and(eq(companies.id, entityId), eq(companies.tenantId, t)));
    return Response.json({ ok: true, applied: action === "approve" && changed });
  }

  if (entityType === "contact") {
    const [row] = await db.select({ properties: contacts.properties }).from(contacts).where(and(eq(contacts.id, entityId), eq(contacts.tenantId, t))).limit(1);
    if (!row) return apiError("NOT_FOUND", "Contact not found");
    const { props, changed } = resolvePending(row.properties, [["pendingCallProfile", "callProfile"]], action);
    if (changed) await db.update(contacts).set({ properties: props, updatedAt: new Date() }).where(and(eq(contacts.id, entityId), eq(contacts.tenantId, t)));
    return Response.json({ ok: true, applied: action === "approve" && changed });
  }

  return apiError("VALIDATION_ERROR", "entityType must be 'deal', 'company' or 'contact'");
}
