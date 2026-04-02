import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { subscriptions } from "@/db/billing-schema";
import { stripe } from "@/lib/stripe";
import { eq } from "drizzle-orm";

export async function POST() {
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

    // Get subscription with Stripe customer ID
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, user.tenantId))
      .limit(1);

    if (!sub?.stripeCustomerId) {
      return Response.json(
        { error: "No billing account found" },
        { status: 404 }
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    });

    return Response.json({ url: portalSession.url });
  } catch (error) {
    console.error("Failed to create portal session:", error);
    return Response.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
