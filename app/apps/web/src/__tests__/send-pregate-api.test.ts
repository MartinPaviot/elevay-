import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * M13-R8 (T4) — `POST /api/send/pregate`. The G2/G5 engines run REAL (both
 * pure): what this pins is the routing — reply exemption, gate composition,
 * failure shape, fail-soft context lookup. LLM-free by design.
 */

const state = vi.hoisted(() => ({
  authCtx: { tenantId: "t1", userId: "u1" } as Record<string, unknown> | null,
  isReply: false,
  throwOnInbound: false,
  contactRow: null as Record<string, unknown> | null,
  throwOnDb: false,
  cachedBrief: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/auth/auth-utils", () => ({
  withAuthRLS: vi.fn(async (handler: (ctx: unknown) => Promise<Response>) => {
    if (!state.authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });
    return handler(state.authCtx);
  }),
}));
vi.mock("@/lib/guardrails/sending-gate", () => ({
  hasInboundEmailFrom: vi.fn(async () => {
    if (state.throwOnInbound) throw new Error("lookup boom");
    return state.isReply;
  }),
}));
vi.mock("@/lib/campaign-engine/build-intelligence-brief", () => ({
  readCachedBrief: vi.fn(async () => state.cachedBrief),
  toResearchBriefContext: vi.fn((b: unknown) => b),
}));
vi.mock("@/db/schema", () => ({
  contacts: { id: "id", tenantId: "tenant_id", firstName: "first_name", lastName: "last_name", title: "title", companyId: "company_id" },
  companies: { id: "id", name: "name", domain: "domain" },
}));
vi.mock("drizzle-orm", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  and: (...args: any[]) => ({ op: "and", args }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eq: (col: any, val: any) => ({ op: "eq", col, val }),
}));
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: async () => {
              if (state.throwOnDb) throw new Error("db boom");
              return state.contactRow ? [state.contactRow] : [];
            },
          }),
        }),
      }),
    })),
  },
}));

import { POST } from "@/app/api/send/pregate/route";

function req(body: unknown): Request {
  return new Request("http://x/api/send/pregate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const CLEAN_BODY =
  "Bonjour, votre approche produit m'a interpelle. Seriez-vous ouvert a un echange rapide la semaine prochaine ?";

beforeEach(() => {
  state.authCtx = { tenantId: "t1", userId: "u1" };
  state.isReply = false;
  state.throwOnInbound = false;
  state.contactRow = null;
  state.throwOnDb = false;
  state.cachedBrief = null;
});

describe("POST /api/send/pregate", () => {
  it("400 without `to` or `body`", async () => {
    expect((await POST(req({ to: "a@b.c" }))).status).toBe(400);
    expect((await POST(req({ body: "x" }))).status).toBe(400);
  });

  it("a verified reply is not content-gated (allowed, sendClass reply)", async () => {
    state.isReply = true;
    const body = await (await POST(req({ to: "a@b.c", body: "u{rgent}!!! gratuit" }))).json();
    expect(body).toEqual({ allowed: true, sendClass: "reply", failures: [] });
  });

  it("clean outreach body passes both gates", async () => {
    const body = await (await POST(req({ to: "a@b.c", subject: "Question produit", body: CLEAN_BODY }))).json();
    expect(body.allowed).toBe(true);
    expect(body.sendClass).toBe("outreach");
  });

  it("G2: a named tech asserted with NO brief is blocked with the offending token", async () => {
    const body = await (
      await POST(req({ to: "a@b.c", subject: "s", body: `${CLEAN_BODY} J'ai vu que vous utilisez keycloak en interne.` }))
    ).json();
    expect(body.allowed).toBe(false);
    const g2 = body.failures.find((f: { gate: number }) => f.gate === 2);
    expect(g2.detail).toContain("keycloak");
  });

  it("G5: skipUnsubscribe with no opt-out mention blocks with the unsubscribe failure", async () => {
    const body = await (
      await POST(req({ to: "a@b.c", subject: "s", body: CLEAN_BODY, skipUnsubscribe: true }))
    ).json();
    expect(body.allowed).toBe(false);
    const g5 = body.failures.find((f: { gate: number }) => f.gate === 5);
    expect(g5.code).toBe("unsubscribe:missing");
  });

  it("fail-soft context: a db error still evaluates (strict G2 posture), clean body passes", async () => {
    state.throwOnDb = true;
    const body = await (
      await POST(req({ to: "a@b.c", subject: "s", body: CLEAN_BODY, contactId: "c1" }))
    ).json();
    expect(body.allowed).toBe(true);
  });

  it("an unverifiable inbound lookup treats the send as outreach (stricter), never as reply", async () => {
    state.throwOnInbound = true;
    const body = await (
      await POST(req({ to: "a@b.c", subject: "s", body: `${CLEAN_BODY} Vous utilisez keycloak.` }))
    ).json();
    expect(body.allowed).toBe(false);
    expect(body.sendClass).toBe("outreach");
  });

  it("unauthenticated -> 401", async () => {
    state.authCtx = null;
    expect((await POST(req({ to: "a@b.c", body: "x" }))).status).toBe(401);
  });
});
