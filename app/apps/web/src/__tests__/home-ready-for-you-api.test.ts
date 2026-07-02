import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * outreach-autopilot T11b — the cockpit aggregate reads.
 *
 * /api/home/ready-for-you: one tenant-scoped fetch → three counts from the
 * three real tables (sequence_drafts pending_approval, reply_review_queue
 * pending, agent_actions awaiting approval = scheduled + null exec time).
 * /api/deliverability/status: exposes the server-only guard verdict.
 */

let authCtx: { tenantId: string; userId: string } | null = { tenantId: "t1", userId: "u1" };
let counts = { drafts: 0, replies: 0, actions: 0 };
const froms: string[] = [];

vi.mock("@/lib/auth/auth-utils", () => ({
  getAuthContext: vi.fn(async () => authCtx),
}));

vi.mock("@/db/schema", () => ({
  sequenceDrafts: { __t: "drafts", tenantId: "d.tenant", status: "d.status" },
  replyReviewQueue: { __t: "replies", tenantId: "r.tenant", state: "r.state" },
  agentActions: {
    __t: "actions",
    tenantId: "a.tenant",
    status: "a.status",
    scheduledExecutionAt: "a.sched",
    reversedAt: "a.rev",
  },
}));

vi.mock("@/db", () => ({
  db: {
    // count() aggregate: db.select({n}).from(table).where(...) → [{ n }].
    select: () => ({
      from: (table: { __t: string }) => {
        froms.push(table.__t);
        return {
          where: () => {
            const n =
              table.__t === "drafts"
                ? counts.drafts
                : table.__t === "replies"
                  ? counts.replies
                  : counts.actions;
            return Promise.resolve([{ n }]);
          },
        };
      },
    }),
  },
}));

let guardState: { status: string; pauseReason?: string } = { status: "active" };
vi.mock("@/lib/deliverability/db-guard", () => ({
  evaluateGuard: vi.fn(async (tenantId: string) => {
    // Prove tenant-scoping: the route must pass the auth tenant through.
    expect(tenantId).toBe("t1");
    return guardState;
  }),
}));

import { GET as readyGET } from "@/app/api/home/ready-for-you/route";
import { GET as delivGET } from "@/app/api/deliverability/status/route";

beforeEach(() => {
  authCtx = { tenantId: "t1", userId: "u1" };
  counts = { drafts: 0, replies: 0, actions: 0 };
  guardState = { status: "active" };
  froms.length = 0;
});

describe("GET /api/home/ready-for-you", () => {
  it("returns the three counts from the three real tables", async () => {
    counts = { drafts: 5, replies: 2, actions: 3 };
    const res = await readyGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ drafts: 5, replies: 2, actions: 3 });
    // The three sources are queried (drift guard also pins the table identities).
    expect(new Set(froms)).toEqual(new Set(["drafts", "replies", "actions"]));
  });

  it("returns all-zero for a caught-up tenant", async () => {
    const res = await readyGET();
    expect(await res.json()).toEqual({ drafts: 0, replies: 0, actions: 0 });
  });

  it("401s when unauthenticated (never queries the db)", async () => {
    authCtx = null;
    const res = await readyGET();
    expect(res.status).toBe(401);
    expect(froms).toHaveLength(0);
  });
});

describe("GET /api/deliverability/status", () => {
  it("reports healthy for an active guard", async () => {
    const res = await delivGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tripped: false, pauseReason: null });
  });

  it("reports the pause + reason for a tripped guard", async () => {
    guardState = { status: "paused", pauseReason: "bounce_rate" };
    const res = await delivGET();
    expect(await res.json()).toEqual({ tripped: true, pauseReason: "bounce_rate" });
  });

  it("401s when unauthenticated", async () => {
    authCtx = null;
    const res = await delivGET();
    expect(res.status).toBe(401);
  });
});
