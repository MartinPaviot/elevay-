import { getAuthContext } from "@/lib/auth/auth-utils";
import { evaluateGuard } from "@/lib/deliverability/db-guard";

/**
 * GET /api/deliverability/status — the cockpit StatBar's deliverability light
 * (outreach-autopilot T11b). Surfaces the otherwise SERVER-ONLY guard verdict
 * (guardTrippedForTenant, lib/deliverability/db-guard.ts:138) as a tenant-scoped
 * read: `tripped` plus the pause reason for the tooltip.
 *
 * `evaluateGuard` is the same canonical fresh evaluation the send path uses; it
 * only PERSISTS on a status TRANSITION (db-guard.ts:133), so a healthy tenant
 * triggers no write and a paused one idempotently rewrites its own row. No
 * migration — `deliverability_guard_state` already exists.
 */
export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await evaluateGuard(authCtx.tenantId);
  return Response.json({
    tripped: state.status === "paused",
    pauseReason: state.pauseReason ?? null,
  });
}
