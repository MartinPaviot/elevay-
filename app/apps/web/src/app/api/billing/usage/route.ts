import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { subscriptions, usageEvents } from "@/db/billing-schema";
import { eq, and, gte, sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get tenant
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, session.user.id!));
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    const tenantId = user.tenantId;

    // Get current billing period start
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .limit(1);

    const periodStart =
      sub?.currentPeriodStart ??
      new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    // Aggregate usage by event type for current period
    const usage = await db
      .select({
        eventType: usageEvents.eventType,
        total: sql<number>`coalesce(sum(${usageEvents.count}), 0)`,
      })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.tenantId, tenantId),
          gte(usageEvents.createdAt, periodStart)
        )
      )
      .groupBy(usageEvents.eventType);

    const usageMap: Record<string, number> = {};
    for (const row of usage) {
      usageMap[row.eventType] = Number(row.total);
    }

    return Response.json({
      periodStart: periodStart.toISOString(),
      periodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
      usage: {
        api_call: usageMap.api_call ?? 0,
        email_sent: usageMap.email_sent ?? 0,
        contact_enriched: usageMap.contact_enriched ?? 0,
        ai_query: usageMap.ai_query ?? 0,
      },
    });
  } catch (error) {
    console.error("Failed to fetch usage:", error);
    return Response.json(
      { error: "Failed to fetch usage" },
      { status: 500 }
    );
  }
}
