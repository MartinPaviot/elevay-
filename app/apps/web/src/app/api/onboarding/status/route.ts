import { getAuthContext } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { companies, contacts, authAccounts, tenants, authUsers, pendingInvites } from "@/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { hasUsableIcp, type TenantSettings } from "@/lib/config/tenant-settings";

export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [accountCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(companies)
    .where(and(eq(companies.tenantId, authCtx.tenantId), isNull(companies.deletedAt)));

  const [contactCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .where(and(eq(contacts.tenantId, authCtx.tenantId), isNull(contacts.deletedAt)));

  // Check if Google OAuth is connected
  const [googleAccount] = await db
    .select({ userId: authAccounts.userId })
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.userId, authCtx.userId),
        eq(authAccounts.provider, "google")
      )
    )
    .limit(1);

  // Check if Microsoft OAuth is connected
  const [msAccount] = await db
    .select({ userId: authAccounts.userId })
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.userId, authCtx.userId),
        eq(authAccounts.provider, "microsoft-entra-id")
      )
    )
    .limit(1);

  // Check onboarding completion in tenant settings
  const [tenant] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, authCtx.tenantId));

  const settings = (tenant?.settings || {}) as Record<string, unknown>;
  const onboardingCompleted = !!settings.onboardingCompleted;
  const rawCurrentStep =
    typeof settings.onboardingCurrentStep === "string"
      ? settings.onboardingCurrentStep
      : null;
  // "building" is transient — the async TAM build runs via Inngest and isn't
  // something the user can usefully resume mid-flight. Snap them back to
  // "icp" so they can re-submit and re-trigger.
  const onboardingCurrentStep =
    rawCurrentStep === "building" ? "icp" : rawCurrentStep;

  const accounts = Number(accountCount?.count || 0);
  const contactTotal = Number(contactCount?.count || 0);
  const isNew = accounts === 0 && contactTotal === 0;
  const hasGoogle = !!googleAccount;
  const hasMicrosoft = !!msAccount;

  // Get user email and name for domain extraction + pre-fill
  const [authUser] = await db
    .select({ email: authUsers.email, name: authUsers.name })
    .from(authUsers)
    .where(eq(authUsers.id, authCtx.userId))
    .limit(1);

  // Invite-aware suppression: a user who JOINED VIA INVITE into a workspace
  // that is already established (has accounts or a usable ICP) lands on the
  // briefing, not the setup modal — someone else already set the workspace
  // up, and `onboardingCompleted` being false only means nobody finished
  // the modal (setup often happens through /settings/icp or sourcing).
  //
  // Deliberately scoped to invited users (T0.1): the founder mid-wizard
  // keeps resume behavior even after the async TAM build starts inserting
  // accounts, because no accepted invite points at them. An invitee landing
  // in an EMPTY workspace still gets the modal — someone has to set it up.
  const established = accounts > 0 || hasUsableIcp(settings as TenantSettings);
  let joinedViaInvite = false;
  if (!onboardingCompleted && established) {
    const [acceptedInvite] = await db
      .select({ id: pendingInvites.id })
      .from(pendingInvites)
      .where(
        and(
          eq(pendingInvites.tenantId, authCtx.tenantId),
          eq(pendingInvites.status, "accepted"),
          eq(pendingInvites.acceptedByUserId, authCtx.appUserId),
        ),
      )
      .limit(1);
    joinedViaInvite = !!acceptedInvite;
  }

  return Response.json({
    isNew,
    accounts,
    contacts: contactTotal,
    hasGoogle,
    hasMicrosoft,
    hasEmail: hasGoogle || hasMicrosoft,
    needsOnboarding: !onboardingCompleted && !(established && joinedViaInvite),
    onboardingCurrentStep,
    email: authUser?.email,
    name: authUser?.name || null,
    // WS-0: exposed for client-side PostHog `distinct_id`. Every analytics
    // call from the wizard uses this stable internal user ID so events
    // correlate with the server-side ttfaa_started emission.
    userId: authCtx.userId,
  });
}
