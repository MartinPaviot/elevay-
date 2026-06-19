import { describe, it, expect } from "vitest";
import { buildAuthorizeUrl, normalizeLinkProvider, OAUTH_LINK_CALLBACK_PATH } from "@/lib/integrations/oauth-link-providers";

describe("normalizeLinkProvider", () => {
  it("maps google/gmail and microsoft variants", () => {
    expect(normalizeLinkProvider("gmail")).toBe("gmail");
    expect(normalizeLinkProvider("google")).toBe("gmail");
    expect(normalizeLinkProvider("outlook")).toBe("outlook");
    expect(normalizeLinkProvider("microsoft")).toBe("outlook");
    expect(normalizeLinkProvider("microsoft-entra-id")).toBe("outlook");
    expect(normalizeLinkProvider("yahoo")).toBeNull();
    expect(normalizeLinkProvider(null)).toBeNull();
  });
});

describe("buildAuthorizeUrl", () => {
  const redirectUri = `https://app.elevay.dev${OAUTH_LINK_CALLBACK_PATH}`;

  it("builds a Google authorize URL with offline access, consent, state, scopes", () => {
    const u = new URL(buildAuthorizeUrl({ provider: "gmail", clientId: "CID", redirectUri, state: "STATE" }));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("client_id")).toBe("CID");
    expect(u.searchParams.get("redirect_uri")).toBe(redirectUri);
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("state")).toBe("STATE");
    const scope = u.searchParams.get("scope") ?? "";
    expect(scope).toContain("https://www.googleapis.com/auth/gmail.modify");
    expect(scope).toContain("https://www.googleapis.com/auth/gmail.send");
    expect(scope).toContain("https://www.googleapis.com/auth/calendar");
  });

  it("builds a Microsoft authorize URL with offline_access + mail/calendar scopes", () => {
    const u = new URL(buildAuthorizeUrl({ provider: "outlook", clientId: "CID", redirectUri, state: "STATE" }));
    expect(u.origin + u.pathname).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    const scope = u.searchParams.get("scope") ?? "";
    expect(scope).toContain("offline_access");
    expect(scope).toContain("Mail.ReadWrite");
    expect(scope).toContain("Mail.Send");
    expect(scope).toContain("Calendars.ReadWrite");
  });
});
