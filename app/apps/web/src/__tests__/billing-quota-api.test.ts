import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-utils", () => ({
  getAuthContext: vi.fn(),
}));

const readUsageMock = vi.fn();
vi.mock("@/lib/pricing/quota", () => ({
  readUsage: (...args: unknown[]) => readUsageMock(...args),
}));

import { getAuthContext } from "@/lib/auth-utils";

const mod = await import("@/app/api/billing/quota/route");

const authCtx = {
  userId: "auth-1",
  tenantId: "t1",
  appUserId: "u1",
  role: "member" as const,
};

beforeEach(() => vi.clearAllMocks());

describe("GET /api/billing/quota", () => {
  it("401 when unauthenticated", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null);
    const res = await mod.GET();
    expect(res.status).toBe(401);
  });

  it("returns usage + limits + computed over/near arrays for trial", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(authCtx);
    readUsageMock.mockResolvedValue({
      plan: "trial",
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: null,
      limits: { contacts: 100, emailsPerMonth: 50, aiQueriesPerMonth: 100 },
      usage: { contacts: 5, emails: 45, ai_queries: 20 },
    });
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBe("trial");
    expect(body.periodStart).toBe("2026-04-01T00:00:00.000Z");
    expect(body.periodEnd).toBeNull();
    expect(body.usage).toEqual({ contacts: 5, emails: 45, ai_queries: 20 });
    expect(body.limits).toEqual({ contacts: 100, emailsPerMonth: 50, aiQueriesPerMonth: 100 });
    // 45/50 = 0.9 → near; 5/100 = 0.05 → neither; 20/100 = 0.2 → neither
    expect(body.nearLimit).toEqual(["emails"]);
    expect(body.overLimit).toEqual([]);
  });

  it("moves a kind from near to over once current >= limit", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(authCtx);
    readUsageMock.mockResolvedValue({
      plan: "trial",
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: null,
      limits: { contacts: 100, emailsPerMonth: 50, aiQueriesPerMonth: 100 },
      usage: { contacts: 5, emails: 50, ai_queries: 20 },
    });
    const res = await mod.GET();
    const body = await res.json();
    expect(body.overLimit).toEqual(["emails"]);
    expect(body.nearLimit).toEqual([]);
  });

  it("serialises Infinity limits as null (not the string 'Infinity')", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(authCtx);
    readUsageMock.mockResolvedValue({
      plan: "pro",
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: new Date("2026-05-01T00:00:00.000Z"),
      limits: { contacts: 10_000, emailsPerMonth: 5_000, aiQueriesPerMonth: Number.POSITIVE_INFINITY },
      usage: { contacts: 200, emails: 100, ai_queries: 9_999 },
    });
    const res = await mod.GET();
    const body = await res.json();
    expect(body.limits.aiQueriesPerMonth).toBeNull();
    // Infinity-limited kinds never appear in over/near — a pro tenant shouldn't
    // see a red banner for AI queries just because the number is large.
    expect(body.overLimit).not.toContain("ai_queries");
    expect(body.nearLimit).not.toContain("ai_queries");
  });

  it("override of 0 immediately reports overLimit", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(authCtx);
    readUsageMock.mockResolvedValue({
      plan: "trial",
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: null,
      limits: { contacts: 0, emailsPerMonth: 50, aiQueriesPerMonth: 100 },
      usage: { contacts: 0, emails: 0, ai_queries: 0 },
    });
    const res = await mod.GET();
    const body = await res.json();
    expect(body.overLimit).toContain("contacts");
  });

  it("missing billing tables returns a permissive empty trial state (not 500)", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(authCtx);
    readUsageMock.mockRejectedValue(new Error('relation "subscriptions" does not exist'));
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBe("trial");
    expect(body.usage).toEqual({ contacts: 0, emails: 0, ai_queries: 0 });
    expect(body.overLimit).toEqual([]);
  });

  it("unexpected errors bubble as 500", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(authCtx);
    readUsageMock.mockRejectedValue(new Error("db connection refused"));
    const res = await mod.GET();
    expect(res.status).toBe(500);
  });
});
