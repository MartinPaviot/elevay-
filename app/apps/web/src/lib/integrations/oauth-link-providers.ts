/**
 * OAuth-LINK provider descriptors (A1 B2/B4). Google + Microsoft Entra authorize/
 * token/userinfo endpoints, link scopes (mail read+send + calendar), and the
 * verified-email extraction. Client id/secret reuse the existing next-auth env
 * (GOOGLE_CLIENT_ID/SECRET, MICROSOFT_CLIENT_ID/SECRET, auth.ts:230-276) — no new
 * provider, no new env beyond the fixed callback path.
 *
 * buildAuthorizeUrl is pure + unit-testable; exchangeCodeForTokens /
 * fetchVerifiedEmail are the live IO the callback drives server-side.
 */

import type { LinkProvider } from "@/lib/integrations/link-mailbox";

export const OAUTH_LINK_CALLBACK_PATH = "/api/settings/mailboxes/oauth-link/callback";

interface ProviderDescriptor {
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string[];
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
  /** Extract the verified email from the provider userinfo JSON (R2.4). */
  emailFromUserinfo: (json: Record<string, unknown>) => string | null;
}

const DESCRIPTORS: Record<LinkProvider, ProviderDescriptor> = {
  gmail: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userinfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    scopes: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar",
    ],
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    emailFromUserinfo: (j) => (typeof j.email === "string" ? j.email : null),
  },
  outlook: {
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userinfoUrl: "https://graph.microsoft.com/v1.0/me",
    scopes: [
      "openid",
      "email",
      "profile",
      "offline_access",
      "https://graph.microsoft.com/Mail.ReadWrite",
      "https://graph.microsoft.com/Mail.Send",
      "https://graph.microsoft.com/Calendars.ReadWrite",
    ],
    clientId: () => process.env.MICROSOFT_CLIENT_ID,
    clientSecret: () => process.env.MICROSOFT_CLIENT_SECRET,
    emailFromUserinfo: (j) =>
      typeof j.mail === "string" ? j.mail : typeof j.userPrincipalName === "string" ? j.userPrincipalName : null,
  },
};

export function getProviderDescriptor(provider: LinkProvider): ProviderDescriptor {
  return DESCRIPTORS[provider];
}

/** Map an inbound ?provider= value to a LinkProvider, or null. */
export function normalizeLinkProvider(raw: string | null | undefined): LinkProvider | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "gmail" || v === "google") return "gmail";
  if (v === "outlook" || v === "microsoft" || v === "microsoft-entra-id" || v === "azure-ad") return "outlook";
  return null;
}

/**
 * Build the provider authorize URL (R1.4). Pure. Requests offline access +
 * consent so a refresh token is always returned.
 */
export function buildAuthorizeUrl(input: {
  provider: LinkProvider;
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const d = DESCRIPTORS[input.provider];
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: d.scopes.join(" "),
    state: input.state,
    access_type: "offline",
    prompt: "consent",
  });
  if (input.provider === "outlook") {
    // Entra returns a refresh token via offline_access (in scope) + this hint.
    params.set("response_mode", "query");
  }
  return `${d.authorizeUrl}?${params.toString()}`;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
}

/** Exchange an authorization code for tokens server-side (R2.1). Live IO. */
export async function exchangeCodeForTokens(input: {
  provider: LinkProvider;
  code: string;
  redirectUri: string;
}): Promise<OAuthTokens> {
  const d = DESCRIPTORS[input.provider];
  const clientId = d.clientId();
  const clientSecret = d.clientSecret();
  if (!clientId || !clientSecret) throw new Error(`${input.provider} OAuth client is not configured.`);
  const res = await fetch(d.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!json.access_token) throw new Error("Token exchange returned no access_token.");
  return { accessToken: json.access_token, refreshToken: json.refresh_token };
}

/** Fetch the verified mailbox email from the provider userinfo (R2.4). Live IO. */
export async function fetchVerifiedEmail(input: { provider: LinkProvider; accessToken: string }): Promise<string | null> {
  const d = DESCRIPTORS[input.provider];
  const res = await fetch(d.userinfoUrl, { headers: { Authorization: `Bearer ${input.accessToken}` } });
  if (!res.ok) return null;
  const json = (await res.json()) as Record<string, unknown>;
  return d.emailFromUserinfo(json);
}
