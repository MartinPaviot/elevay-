/**
 * POST /api/icp/apply
 *
 * Persist a parsed persona/ICP (from /api/icp/parse-nl, after the user
 * confirms/edits it). Phase 1 (_specs/icp-unification R5.3): instead of
 * writing the flat tenants.settings keys directly, this builds a
 * uiState and upserts the RANK-1 ACTIVE profile through the same path
 * the editor uses — criteria regenerated, flats mirrored, recompute
 * fired. Applying a persona means "this is my targeting now": guided
 * criteria are replaced, advanced criteria (custom props, signals…)
 * are preserved.
 */

import { getAuthContext } from "@/lib/auth/auth-utils";
import { upsertRankOneProfileFromUiState } from "@/lib/icp/profile-upsert";
import { EMPTY_UI_STATE, type IcpUiState } from "@/lib/icp/ui-state";

export async function POST(req: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    industries?: string[];
    keywords?: string[];
    companySizes?: string[];
    geographies?: string[];
    excludeGeographies?: string[];
    technologies?: string[];
    revenueMin?: number | null;
    revenueMax?: number | null;
    fundingRecencyDays?: number | null;
    titles?: string[];
    seniorities?: string[];
  };

  const arr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  const uiState: IcpUiState = {
    ...EMPTY_UI_STATE,
    importance: {},
    industries: arr(body.industries),
    keywords: arr(body.keywords),
    companySizes: arr(body.companySizes),
    geographies: arr(body.geographies),
    technologies: arr(body.technologies),
    revenueMin: num(body.revenueMin),
    revenueMax: num(body.revenueMax),
    personTitles: arr(body.titles),
    seniorities: arr(body.seniorities),
  };

  const { icpId, created } = await upsertRankOneProfileFromUiState({
    tenantId: authCtx.tenantId,
    appUserId: authCtx.appUserId,
    name: "Default",
    uiState,
    sourcingFilters: {
      excludeGeographies: arr(body.excludeGeographies),
      fundingRecencyDays: num(body.fundingRecencyDays),
    },
  });

  return Response.json({ ok: true, icpId, created });
}
