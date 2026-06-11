/**
 * GET/PUT /api/settings/product — Product & Voice (Phase 1,
 * _specs/icp-unification R4.9).
 *
 * The 4 seller-context fields the legacy "ICP & Product" page mixed
 * into targeting. Same tenants.settings keys as always — the ~20 LLM
 * consumers (chat, call scripts, sequences, replies, proposals…) read
 * them unchanged. Open to every member, like the legacy page was
 * (api/settings/icp's documented de-gate decision).
 */

import { getAuthContext } from "@/lib/auth/auth-utils";
import { getTenantSettings, updateTenantSettings } from "@/lib/config/tenant-settings";

const FIELDS = ["productDescription", "salesMotion", "primaryChallenge", "aiTone"] as const;

export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const s = await getTenantSettings(authCtx.tenantId);
  return Response.json({
    productDescription: s.productDescription || "",
    salesMotion: s.salesMotion || "",
    primaryChallenge: s.primaryChallenge || "",
    aiTone: s.aiTone || "",
  });
}

export async function PUT(req: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  for (const f of FIELDS) {
    if (body[f] !== undefined) {
      if (typeof body[f] !== "string") {
        return Response.json({ error: `${f} must be a string` }, { status: 400 });
      }
      updates[f] = body[f] as string;
    }
  }
  await updateTenantSettings(authCtx.tenantId, updates);
  return Response.json({ success: true });
}
