import { getAuthContext } from "@/lib/auth-utils";
import { readUsage } from "@/lib/pricing/quota";
import { serialiseLimit, type TierLimits } from "@/lib/pricing/tiers";

/**
 * GET /api/billing/quota
 *
 * Returns the tenant's current plan, period-scoped usage, effective limits
 * (plan defaults merged with any quota_overrides), and pre-computed
 * overLimit / nearLimit arrays so the banner component can render without
 * doing arithmetic on the client.
 *
 * Unlimited limits (Infinity) are serialised as `null` — JSON can't round-
 * trip Infinity, and `null` is the documented client-side sentinel for
 * "unlimited".
 */

type QuotaKind = "contacts" | "emails" | "ai_queries";
const KINDS: readonly QuotaKind[] = ["contacts", "emails", "ai_queries"] as const;

const LIMIT_KEY_FOR: Record<QuotaKind, keyof TierLimits> = {
  contacts: "contacts",
  emails: "emailsPerMonth",
  ai_queries: "aiQueriesPerMonth",
};

const NEAR_LIMIT_RATIO = 0.8;

export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const u = await readUsage(authCtx.tenantId);

    const overLimit: QuotaKind[] = [];
    const nearLimit: QuotaKind[] = [];
    for (const kind of KINDS) {
      const limit = u.limits[LIMIT_KEY_FOR[kind]];
      if (!Number.isFinite(limit)) continue;
      const current = u.usage[kind];
      if (current >= limit) overLimit.push(kind);
      else if (limit > 0 && current / limit >= NEAR_LIMIT_RATIO) nearLimit.push(kind);
    }

    return Response.json({
      plan: u.plan,
      periodStart: u.periodStart.toISOString(),
      periodEnd: u.periodEnd?.toISOString() ?? null,
      usage: u.usage,
      limits: {
        contacts: serialiseLimit(u.limits.contacts),
        emailsPerMonth: serialiseLimit(u.limits.emailsPerMonth),
        aiQueriesPerMonth: serialiseLimit(u.limits.aiQueriesPerMonth),
      },
      overLimit,
      nearLimit,
    });
  } catch (err) {
    // Missing billing tables (fresh dev tenant, failed migration) shouldn't
    // break the dashboard layout — return a permissive empty state instead.
    const msg = err instanceof Error ? err.message : String(err);
    if (/does not exist|relation|undefined table|no such table/i.test(msg)) {
      const now = new Date();
      return Response.json({
        plan: "trial",
        periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(),
        periodEnd: null,
        usage: { contacts: 0, emails: 0, ai_queries: 0 },
        limits: { contacts: 100, emailsPerMonth: 50, aiQueriesPerMonth: 100 },
        overLimit: [],
        nearLimit: [],
      });
    }
    console.error("/api/billing/quota failed:", err);
    return Response.json({ error: "Failed to read quota" }, { status: 500 });
  }
}
