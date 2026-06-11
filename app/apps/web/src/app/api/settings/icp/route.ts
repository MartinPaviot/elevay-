/**
 * GET /api/settings/icp — READ-ONLY since Phase 1
 * (_specs/icp-unification R5.3/R8.2).
 *
 * The flat target* keys are now a mirror written exclusively by the
 * rank-1 ICP profile's save (lib/icp/mirror.ts). The PUT that let this
 * surface write them directly is gone — the legacy "ICP & Product"
 * form it served no longer exists. GET survives until the last in-app
 * reader of this endpoint is confirmed gone.
 */

import { getAuthContext } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { deriveTargetRoles } from "@/lib/config/tenant-settings";

export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, authCtx.tenantId)).limit(1);
    if (!tenant) return Response.json({ error: "Workspace not found" }, { status: 404 });

    const s = (tenant.settings || {}) as Record<string, unknown>;
    // BUG-WS0-008: return derived targetRoles so the UI always reflects
    // the current seniorities + departments combination.
    const settingsTyped = s as import("@/lib/config/tenant-settings").TenantSettings;
    return Response.json({
      productDescription: s.productDescription || "",
      salesMotion: s.salesMotion || "",
      primaryChallenge: s.primaryChallenge || "",
      aiTone: s.aiTone || "",
      targetIndustries: s.targetIndustries || [],
      targetCompanySizes: s.targetCompanySizes || [],
      targetRoles: deriveTargetRoles(settingsTyped),
      targetGeographies: s.targetGeographies || [],
      // Full Apollo filter surface — parity with the onboarding card so
      // every persisted filter is visible + editable post-onboarding.
      targetKeywords: s.targetKeywords || [],
      targetRevenueMin: s.targetRevenueMin ?? null,
      targetRevenueMax: s.targetRevenueMax ?? null,
      targetTechnologies: s.targetTechnologies || [],
      excludeGeographies: s.excludeGeographies || [],
      fundingRecencyDays: s.fundingRecencyDays ?? null,
      totalFundingMin: s.totalFundingMin ?? null,
      totalFundingMax: s.totalFundingMax ?? null,
      minJobOpenings: s.minJobOpenings ?? null,
      hiringTitles: s.hiringTitles || [],
    });
  } catch (error) {
    console.error("Failed to fetch ICP settings:", error);
    return Response.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

