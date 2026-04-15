import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { subscriptions, usageEvents } from "@/db/billing-schema";

// Plan / quota logic lives in lib/pricing/{tiers,quota,enforce}.ts. This file
// exists only for subscription lookups + usage event writes, which are
// cross-cutting primitives used by multiple subsystems.

/** Return the most recent subscription row for the tenant, or null. */
export async function getSubscription(tenantId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(sql`${subscriptions.createdAt} desc`)
    .limit(1);
  return sub ?? null;
}

/** True if the tenant is currently in an unexpired Stripe trial. */
export async function isTrialActive(tenantId: string): Promise<boolean> {
  const sub = await getSubscription(tenantId);
  if (!sub) return false;
  if (sub.status !== "trialing") return false;
  if (!sub.trialEnd) return false;
  return new Date(sub.trialEnd) > new Date();
}

/**
 * Write one usage event for a tenant. Called after a metered action succeeds
 * (email send, AI query, …). Enforcement lives in lib/pricing/enforce.ts —
 * this helper just appends to the ledger.
 */
export async function trackUsage(
  tenantId: string,
  eventType: "api_call" | "email_sent" | "contact_enriched" | "ai_query",
  count: number = 1
) {
  await db.insert(usageEvents).values({
    tenantId,
    eventType,
    count,
  });
}
