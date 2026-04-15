import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/db/schema", () => ({
  outboundEmails: {
    id: "id",
    threadId: "threadId",
    messageId: "messageId",
    status: "status",
    bouncedAt: "bouncedAt",
    bounceType: "bounceType",
    errorMessage: "errorMessage",
    repliedAt: "repliedAt",
    replySnippet: "replySnippet",
    tenantId: "tenantId",
    toAddress: "toAddress",
    mailboxId: "mailboxId",
    updatedAt: "updatedAt",
  },
  connectedMailboxes: {
    id: "id",
    bounceCount7d: "bounceCount7d",
    updatedAt: "updatedAt",
  },
  emailOptouts: {
    tenantId: "tenantId",
    emailAddress: "emailAddress",
    reason: "reason",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  sql: vi.fn(() => "sql-fragment"),
}));

import { db } from "@/db";

const mod = await import("@/app/api/webhooks/emailengine/route");

const origNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("EMAILENGINE_WEBHOOK_SECRET", "");
  // Block accidental fetch hits to the redis-bridge URL during tests.
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network blocked in test")));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  if (origNodeEnv !== undefined) vi.stubEnv("NODE_ENV", origNodeEnv);
});

function mockSelectOnce(rows: unknown[]) {
  const limitFn = vi.fn().mockResolvedValue(rows);
  const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
  const fromFn = vi.fn().mockReturnValue({ where: whereFn });
  vi.mocked(db.select).mockReturnValueOnce({ from: fromFn } as never);
}

function makeReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/webhooks/emailengine", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/webhooks/emailengine — signature gate", () => {
  it("dev mode + no secret → accepts (returns 200)", async () => {
    const res = await mod.POST(makeReq({ event: "unknown", data: {} }));
    expect(res.status).toBe(200);
  });

  it("prod mode + no secret → 401", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await mod.POST(makeReq({ event: "messageNew" }));
    expect(res.status).toBe(401);
  });

  it("prod mode + secret + missing signature header → 401", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAILENGINE_WEBHOOK_SECRET", "test-secret-value");
    const res = await mod.POST(makeReq({ event: "messageNew" }));
    expect(res.status).toBe(401);
  });

  it("prod mode + secret + valid HMAC → 200", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAILENGINE_WEBHOOK_SECRET", "test-secret-value");
    const body = JSON.stringify({ event: "noop" });
    const crypto = await import("crypto");
    const sig = crypto.createHmac("sha256", "test-secret-value").update(body).digest("hex");
    const res = await mod.POST(makeReq(body, { "x-ee-signature": sig }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/webhooks/emailengine — messageNew (reply) handling", () => {
  it("no-op when threadId missing", async () => {
    const res = await mod.POST(
      makeReq({
        event: "messageNew",
        data: { from: "bob@x.com", to: "us@x.com", subject: "hi", text: "..." },
      })
    );
    expect(res.status).toBe(200);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("no-op when threadId doesn't match any outbound email", async () => {
    mockSelectOnce([]);
    const res = await mod.POST(
      makeReq({
        event: "messageNew",
        data: { threadId: "thread-xyz", text: "reply text" },
      })
    );
    expect(res.status).toBe(200);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("falls back to direct DB update when redis-bridge fetch fails", async () => {
    mockSelectOnce([{ id: "outbound-1", tenantId: "t1" }]);
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: updateWhere });
    vi.mocked(db.update).mockReturnValue({ set: setFn } as never);

    const res = await mod.POST(
      makeReq({
        event: "messageNew",
        data: {
          threadId: "thread-xyz",
          text: "Sounds great, let's chat next week",
          messageId: "<reply-1@x.com>",
          from: "bob@x.com",
        },
      })
    );
    expect(res.status).toBe(200);
    expect(setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        repliedAt: expect.any(Date),
        replySnippet: expect.stringContaining("Sounds great"),
      })
    );
  });
});

describe("POST /api/webhooks/emailengine — messageBounce handling", () => {
  it("no-op without messageId", async () => {
    const res = await mod.POST(makeReq({ event: "messageBounce", data: {} }));
    expect(res.status).toBe(200);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("no-op when messageId doesn't match outbound", async () => {
    mockSelectOnce([]);
    const res = await mod.POST(
      makeReq({
        event: "messageBounce",
        data: { messageId: "msg-unknown", bounceMessage: "550 user unknown" },
      })
    );
    expect(res.status).toBe(200);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("hard bounce: status update + opt-out + mailbox bump", async () => {
    mockSelectOnce([{
      id: "outbound-1",
      tenantId: "t1",
      toAddress: "bounced@x.com",
      mailboxId: "mb-1",
    }]);
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: updateWhere });
    vi.mocked(db.update).mockReturnValue({ set: setFn } as never);

    const insertOnConflict = vi.fn().mockResolvedValue(undefined);
    const valuesFn = vi.fn().mockReturnValue({ onConflictDoNothing: insertOnConflict });
    vi.mocked(db.insert).mockReturnValue({ values: valuesFn } as never);

    const res = await mod.POST(
      makeReq({
        event: "messageBounce",
        data: { messageId: "msg-1", bounceMessage: "550 5.1.1 User unknown" },
      })
    );
    expect(res.status).toBe(200);
    // First update = outboundEmails (status=bounced, hard)
    const firstSetCall = setFn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstSetCall).toMatchObject({
      status: "bounced",
      bounceType: "hard",
    });
    // Insert opt-out row
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "bounce_hard" })
    );
  });

  it("soft bounce: status update only (no opt-out)", async () => {
    mockSelectOnce([{
      id: "outbound-1",
      tenantId: "t1",
      toAddress: "bounced@x.com",
      mailboxId: null,
    }]);
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: updateWhere });
    vi.mocked(db.update).mockReturnValue({ set: setFn } as never);

    const res = await mod.POST(
      makeReq({
        event: "messageBounce",
        data: { messageId: "msg-1", bounceMessage: "421 try again later" },
      })
    );
    expect(res.status).toBe(200);
    const firstSetCall = setFn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstSetCall).toMatchObject({ bounceType: "soft" });
    expect(db.insert).not.toHaveBeenCalled();
  });
});
