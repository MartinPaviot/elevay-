import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/auth-utils";
import { checkPlanLimit } from "@/lib/billing/plan-limits";
import { signLinkState } from "@/lib/auth/oauth-link-state";
import {
  buildAuthorizeUrl,
  getProviderDescriptor,
  normalizeLinkProvider,
  OAUTH_LINK_CALLBACK_PATH,
} from "@/lib/integrations/oauth-link-providers";

export const OAUTH_LINK_NONCE_COOKIE = "elevay_oauth_link_nonce";

/**
 * GET /api/settings/mailboxes/oauth-link?provider=gmail|outlook  (A1 B2, R1)
 *
 * Begins an "add another mailbox" OAuth authorization attributed to the CURRENT
 * signed-in user — NOT a next-auth signIn (no session mutation, R1.3). Mints a
 * signed single-use state binding authUserId/tenantId/provider (R1.2), stores its
 * nonce in an httpOnly cookie (double-submit single-use), and 302s to the provider
 * authorize URL with offline access + consent (R1.4). Plan-limit gated (R1.5).
 */
export async function GET(req: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = normalizeLinkProvider(new URL(req.url).searchParams.get("provider"));
  if (!provider) return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });

  const planCheck = await checkPlanLimit(authCtx.tenantId, "mailboxes");
  if (!planCheck.allowed) {
    return NextResponse.json(
      {
        error: `Mailbox limit reached (${planCheck.current}/${planCheck.limit}). Upgrade your plan to connect more mailboxes.`,
        code: "PLAN_LIMIT_EXCEEDED",
        current: planCheck.current,
        limit: planCheck.limit,
        plan: planCheck.plan,
      },
      { status: 403 },
    );
  }

  const clientId = getProviderDescriptor(provider).clientId();
  if (!clientId) {
    return NextResponse.json({ error: `${provider} OAuth is not configured` }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}${OAUTH_LINK_CALLBACK_PATH}`;

  let token: string;
  let nonce: string;
  try {
    ({ token, nonce } = signLinkState({ authUserId: authCtx.userId, tenantId: authCtx.tenantId, provider }));
  } catch {
    return NextResponse.json({ error: "Server is missing its signing secret" }, { status: 500 });
  }

  const authorizeUrl = buildAuthorizeUrl({ provider, clientId, redirectUri, state: token });
  const res = NextResponse.redirect(authorizeUrl, { status: 302 });
  res.cookies.set(OAUTH_LINK_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 min, matches LINK_STATE_TTL_MS
  });
  return res;
}
