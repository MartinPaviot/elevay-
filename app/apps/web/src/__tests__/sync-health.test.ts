import { describe, it, expect, vi, beforeEach } from "vitest";

// Pure helpers need no DB. markNeedsReauth/clearSyncHealth read+write
// tenants.settings, so we mock @/db: select returns CURRENT_SETTINGS, and
// update captures the SET payload into LAST_UPDATE so we can assert the key +
// the persisted entry without a real Postgres.

let CURRENT_SETTINGS: unknown = {};
let LAST_UPDATE: { set?: { settings?: { values: unknown[] } } } = {};

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ settings: CURRENT_SETTINGS }],
        }),
      }),
    }),
    update: () => ({
      set: (v: { settings?: { values: unknown[] } }) => {
        LAST_UPDATE.set = v;
        return { where: async () => undefined };
      },
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  tenants: { id: "id", settings: "settings" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...a: unknown[]) => a,
  // Tagged-template stand-in: capture interpolated values so tests can read
  // back the dynamic key + JSON entry the helper built.
  sql: (_strings: TemplateStringsArray, ...values: unknown[]) => ({ _sql: true, values }),
}));

import {
  normSyncProvider,
  connKey,
  isOAuthAuthError,
  isNeedsReauth,
  getSyncHealthEntry,
  markNeedsReauth,
  clearSyncHealth,
} from "@/lib/integrations/sync-health";

beforeEach(() => {
  CURRENT_SETTINGS = {};
  LAST_UPDATE = {};
});

describe("normSyncProvider / connKey", () => {
  it("normalizes every provider spelling to google|microsoft", () => {
    expect(normSyncProvider("google")).toBe("google");
    expect(normSyncProvider("microsoft")).toBe("microsoft");
    expect(normSyncProvider("microsoft-entra-id")).toBe("microsoft");
    expect(normSyncProvider("Microsoft")).toBe("microsoft");
    expect(normSyncProvider(undefined)).toBe("google");
    expect(normSyncProvider(null)).toBe("google");
  });
  it("builds a stable key independent of provider spelling", () => {
    expect(connKey("u1", "google")).toBe("u1:google");
    expect(connKey("u1", "microsoft-entra-id")).toBe("u1:microsoft");
    expect(connKey("u1")).toBe("u1:google");
  });
});

describe("isOAuthAuthError", () => {
  it("flags dead-grant signatures", () => {
    expect(isOAuthAuthError("invalid_grant")).toBe(true);
    expect(isOAuthAuthError("Request failed with status code 401")).toBe(true);
    expect(isOAuthAuthError("403 Forbidden")).toBe(true);
    expect(isOAuthAuthError("Gmail not connected")).toBe(true);
    expect(isOAuthAuthError("The access token is invalid")).toBe(true);
  });
  it("does not flag transient/non-auth failures", () => {
    expect(isOAuthAuthError("network timeout")).toBe(false);
    expect(isOAuthAuthError("ECONNRESET")).toBe(false);
    expect(isOAuthAuthError("500 internal server error")).toBe(false);
  });
});

describe("isNeedsReauth / getSyncHealthEntry (pure)", () => {
  const settings = {
    contactCreationMode: "selective",
    syncHealth: {
      "u1:google": { status: "needs_reauth", failingSince: "2026-04-04T00:00:00.000Z" },
    },
  };
  it("reads the flag for the matching connection only", () => {
    expect(isNeedsReauth(settings, "u1", "google")).toBe(true);
    expect(isNeedsReauth(settings, "u1", "microsoft")).toBe(false);
    expect(isNeedsReauth(settings, "u2", "google")).toBe(false);
    expect(isNeedsReauth(null, "u1", "google")).toBe(false);
    expect(isNeedsReauth({}, "u1", "google")).toBe(false);
  });
  it("returns the entry or null", () => {
    expect(getSyncHealthEntry(settings, "u1", "google")?.failingSince).toBe("2026-04-04T00:00:00.000Z");
    expect(getSyncHealthEntry(settings, "u1", "microsoft")).toBeNull();
  });
});

function persistedEntry() {
  // markNeedsReauth/clearSyncHealth interpolate [key, jsonEntry] into sql``.
  const values = LAST_UPDATE.set?.settings?.values ?? [];
  return { key: values[0] as string, entry: values[1] ? JSON.parse(values[1] as string) : null };
}

describe("markNeedsReauth (dedupe-critical)", () => {
  it("marks a healthy connection and reports newlyMarked=true", async () => {
    CURRENT_SETTINGS = {};
    const res = await markNeedsReauth("t1", "u1", "google", "invalid_grant");
    expect(res.newlyMarked).toBe(true);
    const { key, entry } = persistedEntry();
    expect(key).toBe("u1:google");
    expect(entry.status).toBe("needs_reauth");
    expect(entry.reason).toBe("invalid_grant");
    expect(typeof entry.failingSince).toBe("string");
  });

  it("is idempotent: an already-flagged connection reports newlyMarked=false and preserves failingSince", async () => {
    CURRENT_SETTINGS = {
      syncHealth: {
        "u1:google": {
          status: "needs_reauth",
          failingSince: "2026-04-04T00:00:00.000Z",
          lastNotifiedAt: "2026-04-04T00:00:00.000Z",
        },
      },
    };
    const res = await markNeedsReauth("t1", "u1", "google", "invalid_grant again");
    expect(res.newlyMarked).toBe(false);
    const { entry } = persistedEntry();
    expect(entry.failingSince).toBe("2026-04-04T00:00:00.000Z");
  });

  it("keys microsoft-entra-id under the normalized provider", async () => {
    CURRENT_SETTINGS = {};
    const res = await markNeedsReauth("t1", "u9", "microsoft-entra-id", "401");
    expect(res.newlyMarked).toBe(true);
    expect(persistedEntry().key).toBe("u9:microsoft");
  });
});

describe("clearSyncHealth", () => {
  it("issues an update removing the connection's path", async () => {
    await clearSyncHealth("t1", "u1", "google");
    expect(persistedEntry().key).toBe("u1:google");
  });
});
