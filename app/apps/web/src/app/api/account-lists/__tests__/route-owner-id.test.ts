import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression for the "create a list" 500: account_lists.owner_id is an FK to
// users(id) — the APP user-id space (authCtx.appUserId). The route used to write
// authCtx.userId (the AUTH user-id space), which is a different id and fails the
// FK with 23503 → generic 500 → "Failed to create list" for every real session.
// This test pins ownerId to appUserId so the regression can't silently return.

const h = vi.hoisted(() => ({ captured: null as Record<string, unknown> | null }));

vi.mock("@/db", () => {
  const selectChain = () => {
    const c: Record<string, unknown> = {};
    for (const m of ["from", "where", "limit"]) c[m] = () => c;
    // thenable → resolves to [] so the in-tx dup-name check finds nothing
    (c as { then: unknown }).then = (res: (v: unknown) => unknown) => res([]);
    return c;
  };
  const tx = {
    select: () => selectChain(),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        h.captured = v; // capture what the route inserts
        return { returning: () => Promise.resolve([{ id: "list-1", name: v.name }]) };
      },
    }),
  };
  return { db: { transaction: (cb: (t: typeof tx) => unknown) => cb(tx) } };
});

vi.mock("@/db/schema", () => ({
  accountLists: { id: "account_lists.id", name: "account_lists.name", tenantId: "account_lists.tenantId" },
}));

vi.mock("@/lib/auth/auth-utils", () => ({ getAuthContext: vi.fn() }));

vi.mock("@/lib/accounts/account-lists-db", () => ({
  listsWithCounts: vi.fn(async () => []),
  insertMembers: vi.fn(async () => {}),
  listLiveCount: vi.fn(async () => 0),
  isUniqueViolation: vi.fn(() => false),
}));

vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ _and: a }),
  eq: (...a: unknown[]) => ({ _eq: a }),
}));

vi.mock("@/lib/infra/api-errors", () => ({
  apiError: (_code: string, message: string) => Response.json({ error: message }, { status: 400 }),
}));

import { getAuthContext } from "@/lib/auth/auth-utils";

const route = await import("@/app/api/account-lists/route");

describe("POST /api/account-lists — owner_id is the APP user id (regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.captured = null;
  });

  it("writes ownerId = appUserId, never the auth userId (FK → users.id)", async () => {
    vi.mocked(getAuthContext).mockResolvedValue({
      userId: "auth-clerk-xyz", // auth-user id space
      appUserId: "app-user-123", // app users.id space — the FK target
      tenantId: "t1",
      role: "member",
    } as never);

    const res = await route.POST(
      new Request("http://localhost/api/account-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hot leads", companyIds: [] }),
      }),
    );

    expect(res.status).toBe(201);
    expect(h.captured).not.toBeNull();
    expect(h.captured?.ownerId).toBe("app-user-123");
    expect(h.captured?.ownerId).not.toBe("auth-clerk-xyz");
  });
});
