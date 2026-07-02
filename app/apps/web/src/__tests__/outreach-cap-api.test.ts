import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * INV-1 T2 — `/api/outreach/cap`: the cockpit gauge. Pins: the payload shape
 * {sent, cap, day, timezone, deferred}; the deferred query filters on the
 * SHARED reason-prefix constant (never a retyped string); the cap in the
 * payload is the compiled constant.
 */

const state = vi.hoisted(() => ({
  authCtx: { tenantId: "t1", userId: "u1", appUserId: "au1", role: "admin" } as Record<string, unknown> | null,
  settings: { timezone: "Europe/Paris" } as Record<string, unknown> | null,
  capCount: 12,
  deferredRows: [] as Array<Record<string, unknown>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  capturedWhere: null as any,
}));

vi.mock("@/lib/auth/auth-utils", () => ({
  withAuthRLS: vi.fn(async (handler: (ctx: unknown) => Promise<Response>) => {
    if (!state.authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });
    return handler(state.authCtx);
  }),
}));
vi.mock("@/db/schema", () => ({
  outboundEmails: {
    id: "id", tenantId: "tenant_id", status: "status", errorMessage: "error_message",
    toAddress: "to_address", subject: "subject", queuedAt: "queued_at",
  },
  // Imported by the REAL @/lib/guardrails/outreach-cap (spread in its mock below).
  tenantSendCounters: { tenantId: "tenant_id", day: "day", sentCount: "sent_count" },
}));
vi.mock("drizzle-orm", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  and: (...args: any[]) => ({ op: "and", args }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eq: (col: any, val: any) => ({ op: "eq", col, val }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  like: (col: any, val: any) => ({ op: "like", col, val }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  desc: (col: any) => ({ op: "desc", col }),
  // Imported by the REAL outreach-cap module (lt, sql) — must exist on the mock.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lt: (col: any, val: any) => ({ op: "lt", col, val }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql: (strings: any, ...vals: any[]) => ({ op: "sql", strings, vals }),
}));
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: (clause: any) => {
          state.capturedWhere = clause;
          return { orderBy: () => ({ limit: async () => state.deferredRows }) };
        },
      }),
    })),
  },
}));
vi.mock("@/lib/config/tenant-settings", () => ({
  getTenantSettings: vi.fn(async () => state.settings),
}));
vi.mock("@/lib/guardrails/outreach-cap", async (orig) => ({
  // Real constants (the test pins their values), mocked DB read.
  ...(await orig<typeof import("@/lib/guardrails/outreach-cap")>()),
  getOutreachCapCount: vi.fn(async () => state.capCount),
}));

import { GET } from "@/app/api/outreach/cap/route";
import { OUTREACH_CAP_REASON_PREFIX } from "@/lib/guardrails/outreach-cap";

beforeEach(() => {
  state.authCtx = { tenantId: "t1", userId: "u1", appUserId: "au1", role: "admin" };
  state.settings = { timezone: "Europe/Paris" };
  state.capCount = 12;
  state.deferredRows = [];
  state.capturedWhere = null;
});

describe("GET /api/outreach/cap", () => {
  it("returns the gauge: sent, the compiled cap (100), the tenant day + timezone", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.sent).toBe(12);
    expect(body.cap).toBe(100);
    expect(body.timezone).toBe("Europe/Paris");
    expect(body.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.deferredCount).toBe(0);
  });

  it("lists deferred sends and filters them on the SHARED reason prefix", async () => {
    state.deferredRows = [
      { id: "e1", toAddress: "a@b.c", subject: "s", queuedAt: "2026-07-02T08:00:00Z" },
    ];
    const res = await GET();
    const body = await res.json();
    expect(body.deferredCount).toBe(1);
    expect(body.deferred[0].id).toBe("e1");
    // The LIKE clause must be built from the exported constant, not a retyped string.
    const flat = JSON.stringify(state.capturedWhere);
    expect(flat).toContain(`${OUTREACH_CAP_REASON_PREFIX}%`);
    expect(flat).toContain("queued");
  });

  it("missing timezone falls back to UTC", async () => {
    state.settings = {};
    const res = await GET();
    const body = await res.json();
    expect(body.timezone).toBe("UTC");
  });

  it("unauthenticated -> 401, no data leak", async () => {
    state.authCtx = null;
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
