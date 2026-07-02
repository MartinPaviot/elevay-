import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * T10 (M8-R2/M11-R3) — the review-queue resolution API. Pins: correct
 * updates the queue row AND the reply_classification column AND re-emits
 * reply/classified (the re-route) AND records the user_edited label;
 * confirm records user_approved; both are idempotent on double-click;
 * unknown labels 400; cross-tenant rows 404.
 */

let queueRows: Array<Record<string, unknown>> = [];
let emailRows: Array<Record<string, unknown>> = [];
let casLoses = false;
const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
const sent: Array<Record<string, unknown>> = [];
const flywheel: Array<{ agentId: string; input: string; output: string; source: string }> = [];

vi.mock("@/lib/auth/auth-utils", () => ({
  getAuthContext: vi.fn(async () => ({ tenantId: "t1", userId: "auth-u1", appUserId: "app-u1" })),
}));
vi.mock("@/db", () => ({
  db: {
    select: (proj?: Record<string, unknown>) => ({
      from: () => ({
        where: () => {
          const rows = proj && Object.keys(proj).includes("replySnippet") ? emailRows : queueRows;
          const p = Promise.resolve(rows) as Promise<unknown[]> & {
            limit: () => Promise<unknown[]>;
            orderBy: () => { limit: () => Promise<unknown[]> };
          };
          p.limit = () => Promise.resolve(rows);
          p.orderBy = () => ({ limit: () => Promise.resolve(rows) });
          return p;
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          updates.push({ table, values });
          // The CAS rail chains .returning(); a lost race returns []. Plain
          // awaits (the outbound overwrite) resolve directly.
          const p = Promise.resolve(undefined) as Promise<unknown> & {
            returning: () => Promise<Array<{ id: string }>>;
          };
          p.returning = () => Promise.resolve(casLoses ? [] : [{ id: "rq1" }]);
          return p;
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (v: Record<string, unknown>) => ({
        onConflictDoNothing: () => {
          inserts.push({ table, values: v });
          return Promise.resolve(undefined);
        },
      }),
    }),
  },
}));
vi.mock("@/db/schema", () => ({
  replyReviewQueue: { __t: "queue", id: "q.id", tenantId: "q.tenant", state: "q.state", createdAt: "q.created", outboundEmailId: "q.oe", contactId: "q.contact", classification: "q.class" },
  outboundEmails: { __t: "emails", id: "oe.id", tenantId: "oe.tenant", subject: "oe.subject", replySnippet: "oe.snippet", toAddress: "oe.to" },
  contacts: { id: "c.id", tenantId: "c.tenant", firstName: "c.fn", lastName: "c.ln" },
  sequenceEnrollments: { __t: "enrollments", id: "se.id", status: "se.status" },
  emailOptouts: { __t: "optouts" },
}));
vi.mock("@/lib/anti-collision/enroll-guard", () => ({
  releaseEnrollmentById: vi.fn(async () => undefined),
}));
vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn(async (ev: Record<string, unknown>) => { sent.push(ev); }) },
}));
vi.mock("@/lib/evals/flywheel", () => ({
  recordFlywheelCandidate: vi.fn(async (agentId: string, input: string, output: string, _tenant: string, source: string) => {
    flywheel.push({ agentId, input, output, source });
    return { id: "fs1" };
  }),
}));

import { POST } from "@/app/api/inbox/review/[id]/route";
import { replyReviewQueue, outboundEmails } from "@/db/schema";

const queueUpdates = () => updates.filter((u) => u.table === replyReviewQueue);
const emailUpdates = () => updates.filter((u) => u.table === outboundEmails);

const pendingItem = (over: Record<string, unknown> = {}) => ({
  id: "rq1",
  tenantId: "t1",
  outboundEmailId: "oe1",
  enrollmentId: "enr1",
  contactId: "c1",
  classification: { classification: "objection", confidence: 0.3, reason: "ambiguous" },
  corrected: null,
  state: "pending",
  ...over,
});

const post = (id: string, body: unknown) =>
  POST(new Request("http://x/api/inbox/review/" + id, { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  queueRows = [pendingItem()];
  emailRows = [{ replySnippet: "we already use a competitor", toAddress: "Prospect@Acme.com" }];
  casLoses = false;
  updates.length = 0;
  inserts.length = 0;
  sent.length = 0;
  flywheel.length = 0;
});

describe("POST /api/inbox/review/[id] — correct", () => {
  it("audits the queue row, overwrites the lane column, RE-ROUTES, and records the label", async () => {
    const res = await post("rq1", { action: "correct", classification: "interested" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, state: "corrected", reRouted: true });

    expect(queueUpdates()[0].values).toMatchObject({
      state: "corrected",
      corrected: { classification: "interested" },
      reviewedBy: "app-u1",
    });
    expect(emailUpdates()[0].values).toMatchObject({ replyClassification: "interested" });

    const ev = sent[0] as { name: string; data: Record<string, unknown> };
    expect(ev.name).toBe("reply/classified");
    expect(ev.data).toMatchObject({
      enrollmentId: "enr1",
      classification: "interested",
      replyContent: "we already use a competitor",
    });

    expect(flywheel[0]).toMatchObject({
      agentId: "process-reply",
      output: "interested",
      source: "user_edited",
    });
  });

  it("an unknown classification is a 400 — the shared vocabulary is the contract", async () => {
    const res = await post("rq1", { action: "correct", classification: "totally_new_label" });
    expect(res.status).toBe(400);
    expect(updates).toHaveLength(0);
  });

  it("not_now is NOT in the live vocabulary -> 400 guard", async () => {
    const res = await post("rq1", { action: "correct", classification: "not_now" });
    expect(res.status).toBe(400);
  });

  it("correcting to UNSUBSCRIBE opts the address out directly — never via the re-emit", async () => {
    const res = await post("rq1", { action: "correct", classification: "unsubscribe" });
    expect(await res.json()).toMatchObject({ ok: true, state: "corrected", reRouted: false });

    // The real semantics, mirrored from processReply's terminal branch:
    // global opt-out (lowercased) + enrollment unsubscribed. NO reply/classified
    // (the reply-agent would draft an acknowledgment instead of opting out).
    expect(sent).toHaveLength(0);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].values).toMatchObject({
      tenantId: "t1",
      emailAddress: "prospect@acme.com",
      reason: "unsubscribe",
    });
    const enrollmentUpdate = updates.find(
      (u) => (u.values as { status?: string }).status === "unsubscribed",
    );
    expect(enrollmentUpdate).toBeTruthy();
    // The founder label still feeds learning.
    expect(flywheel[0]).toMatchObject({ output: "unsubscribe", source: "user_edited" });
  });

  it("correcting to OOO persists the label but re-routes NOTHING (no dispatch branch exists)", async () => {
    const res = await post("rq1", { action: "correct", classification: "ooo" });
    expect(await res.json()).toMatchObject({ ok: true, state: "corrected", reRouted: false });
    expect(sent).toHaveLength(0);
    expect(inserts).toHaveLength(0);
    expect(emailUpdates()).toHaveLength(1); // the lane column still updates
  });

  it("a lost CAS race returns alreadyResolved — no double emit, no double label", async () => {
    casLoses = true;
    const res = await post("rq1", { action: "correct", classification: "interested" });
    expect(await res.json()).toMatchObject({ ok: true, alreadyResolved: true });
    expect(sent).toHaveLength(0);
    expect(emailUpdates()).toHaveLength(0);
    expect(flywheel).toHaveLength(0);
  });

  it("a cross-tenant or unknown id is a 404 (no leak)", async () => {
    queueRows = [];
    const res = await post("ghost", { action: "correct", classification: "interested" });
    expect(res.status).toBe(404);
  });

  it("double-click is idempotent — the first resolution stands", async () => {
    queueRows = [pendingItem({ state: "corrected" })];
    const res = await post("rq1", { action: "correct", classification: "interested" });
    expect(await res.json()).toMatchObject({ ok: true, alreadyResolved: true });
    expect(updates).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });
});

describe("POST /api/inbox/review/[id] — confirm", () => {
  it("marks confirmed and records the user_approved label, no re-route", async () => {
    const res = await post("rq1", { action: "confirm" });
    expect(await res.json()).toMatchObject({ ok: true, state: "confirmed" });
    expect(queueUpdates()[0].values).toMatchObject({ state: "confirmed", reviewedBy: "app-u1" });
    expect(emailUpdates()).toHaveLength(0);
    expect(sent).toHaveLength(0);
    expect(flywheel[0]).toMatchObject({ output: "objection", source: "user_approved" });
  });

  it("a bad action is a 400", async () => {
    const res = await post("rq1", { action: "reclassify" });
    expect(res.status).toBe(400);
  });
});
