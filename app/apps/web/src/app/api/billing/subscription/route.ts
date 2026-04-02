import { auth } from "@/auth";
import { db } from "@/db";
import { users, tenants } from "@/db/schema";
import { subscriptions } from "@/db/billing-schema";
import { eq, sql } from "drizzle-orm";

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

    // Get tenant plan
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    // Get subscription
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .orderBy(sql`${subscriptions.createdAt} desc`)
      .limit(1);

    return Response.json({
      plan: tenant?.plan ?? "trial",
      status: sub?.status ?? null,
      stripePriceId: sub?.stripePriceId ?? null,
      stripeCustomerId: sub?.stripeCustomerId ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
      trialEnd: sub?.trialEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    });
  } catch (error) {
    console.error("Failed to fetch subscription:", error);
    return Response.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}
