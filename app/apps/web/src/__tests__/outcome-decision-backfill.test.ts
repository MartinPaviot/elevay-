import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * T8 (outreach-autopilot) — resolveOutcome backfills
 * outreach_decisions.outcome_id at the ONE resolution seam:
 *   - a resolution whose watcher snapshot carries decisionId fills outcome_id
 *     (and the positivity written on the outcome is joinable through it);
 *   - the expiry path (no_response, positivity 0.0) IS a learning outcome and
 *     backfills too;
 *   - T7 amendment as a POSITIVE list: the outbound row must prove the send
 *     LEFT (sent/delivered/bounced or sentAt) — failed AND stuck rows NEVER
 *     backfilled — a phantom send must not read as "sent, no response";
 *   - a missing decisionId is a silent no-op; a re-resolve is a no-op (the
 *     watcher is no longer 'watching'); a backfill failure never breaks
 *     resolution.
 *
 * The db is mocked; the REAL @/db/schema and drizzle-orm run so the query
 * construction is exercised. Selects are routed on projection keys (the
 * outcome fetch has none, the decision fetch projects `outboundEmailId`, the
 * outbound fetch projects `status`); updates are routed on the table object.
 */

let outcomeRows: unknown[] = [];
let decisionRows: unknown[] = [];
let outboundRows: unknown[] = [];
let decisionSelectRejects = false;
const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];

vi.mock("@/db", () => ({
  db: {
    select: (proj?: Record<string, unknown>) => {
      const keys = proj ? Object.keys(proj) : [];
      const rows = !proj
        ? outcomeRows
        : keys.includes("outboundEmailId")
          ? decisionRows
          : keys.includes("status")
            ? outboundRows
            : [];
      const rejects = !!proj && keys.includes("outboundEmailId") && decisionSelectRejects;
      return {
        from: () => ({
          where: () => ({
            limit: () =>
              rejects
                ? Promise.reject(new Error("decision lookup down"))
                : Promise.resolve(rows),
          }),
        }),
      };
    },
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          updates.push({ table, values });
          return Promise.resolve(undefined);
        },
      }),
    }),
  },
}));

const { sendSpy } = vi.hoisted(() => ({ sendSpy: vi.fn(async () => undefined) }));
vi.mock("@/inngest/client", () => ({ inngest: { send: sendSpy } }));

import { resolveOutcome } from "@/lib/outcomes/resolve";
import { actionOutcomes, outreachDecisions } from "@/db/schema";

const watchingOutcome = (over: Record<string, unknown> = {}) => ({
  id: "o1",
  tenantId: "t1",
  actionId: "dec-1",
  actionType: "outreach-send",
  status: "watching",
  triggerType: null,
  watchingSince: new Date(Date.now() - 60 * 60 * 1000),
  entitySnapshot: { decisionId: "dec-1", outboundEmailId: "ob1" },
  ...over,
});

const outcomeUpdates = () => updates.filter((u) => u.table === actionOutcomes);
const decisionUpdates = () => updates.filter((u) => u.table === outreachDecisions);

beforeEach(() => {
  outcomeRows = [watchingOutcome()];
  decisionRows = [{ outboundEmailId: "ob1" }];
  outboundRows = [{ status: "sent", sentAt: null }];
  decisionSelectRejects = false;
  updates.length = 0;
  sendSpy.mockClear();
});

describe("resolveOutcome — the T8 decision↔outcome backfill", () => {
  it("a resolution fills outcome_id, and the positivity is joinable through it", async () => {
    await resolveOutcome("o1", "replied_positive");
    // The outcome resolves with its positivity...
    expect(outcomeUpdates()).toHaveLength(1);
    expect(outcomeUpdates()[0].values).toMatchObject({
      status: "resolved",
      outcomeType: "replied_positive",
      positivity: 0.9,
    });
    // ...and the decision row joins it: outcome_id = the resolved outcome, so
    // T9 aggregation reads the positivity via the outcome_id join.
    expect(decisionUpdates()).toHaveLength(1);
    expect(decisionUpdates()[0].values).toEqual({ outcomeId: "o1" });
  });

  it("the expiry path (no_response) IS a learning outcome and backfills too", async () => {
    await resolveOutcome("o1", "no_response");
    expect(outcomeUpdates()[0].values).toMatchObject({ positivity: 0.0 });
    expect(decisionUpdates()).toHaveLength(1);
    expect(decisionUpdates()[0].values).toEqual({ outcomeId: "o1" });
  });

  it("a re-resolve is a no-op (the watcher is no longer 'watching') — exactly once", async () => {
    await resolveOutcome("o1", "replied_positive");
    // After the first resolution the row is 'resolved'; a duplicate detector
    // pass reads that status and must touch NOTHING.
    outcomeRows = [watchingOutcome({ status: "resolved" })];
    await resolveOutcome("o1", "replied_positive");
    expect(outcomeUpdates()).toHaveLength(1);
    expect(decisionUpdates()).toHaveLength(1);
  });

  it.each([
    ["status 'failed'", { status: "failed", sentAt: null }],
    ["stuck queued (send path returned before transport)", { status: "queued", sentAt: null }],
    ["stuck held", { status: "held", sentAt: null }],
  ])("phantom send (%s) -> NO backfill, resolution untouched (positive-list predicate)", async (_label, outbound) => {
    outboundRows = [outbound];
    await resolveOutcome("o1", "no_response");
    expect(outcomeUpdates()).toHaveLength(1); // the outcome itself still resolves
    expect(decisionUpdates()).toHaveLength(0); // outcome_id stays NULL (phantom send)
  });

  it.each([
    ["delivered", { status: "delivered", sentAt: null }],
    ["ANY bounce — a real send whose -0.8 outcome is honest learning", { status: "bounced", sentAt: null }],
    ["sentAt stamp with an unexpected status", { status: "queued", sentAt: new Date() }],
  ])("a send that LEFT (%s) backfills", async (_label, outbound) => {
    outboundRows = [outbound];
    await resolveOutcome("o1", "no_response");
    expect(decisionUpdates()).toHaveLength(1);
  });

  it("missing decisionId in the snapshot -> silent no-op, no throw", async () => {
    outcomeRows = [watchingOutcome({ entitySnapshot: {} })];
    await expect(resolveOutcome("o1", "replied_neutral")).resolves.toBeUndefined();
    expect(outcomeUpdates()).toHaveLength(1);
    expect(decisionUpdates()).toHaveLength(0);
  });

  it("a null snapshot -> silent no-op, no throw", async () => {
    outcomeRows = [watchingOutcome({ entitySnapshot: null })];
    await expect(resolveOutcome("o1", "replied_neutral")).resolves.toBeUndefined();
    expect(decisionUpdates()).toHaveLength(0);
  });

  it("a deleted decision row -> no-op (nothing to join)", async () => {
    decisionRows = [];
    await expect(resolveOutcome("o1", "replied_positive")).resolves.toBeUndefined();
    expect(decisionUpdates()).toHaveLength(0);
  });

  it("a decision with NO outbound row (C5 shape) backfills without the outbound lookup", async () => {
    decisionRows = [{ outboundEmailId: null }];
    outboundRows = []; // must not matter
    await resolveOutcome("o1", "replied_positive");
    expect(decisionUpdates()).toHaveLength(1);
  });

  it("a backfill failure NEVER breaks resolution (best-effort contract)", async () => {
    decisionSelectRejects = true;
    await expect(resolveOutcome("o1", "replied_positive")).resolves.toBeUndefined();
    // The outcome still resolved and the event still fired.
    expect(outcomeUpdates()).toHaveLength(1);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(decisionUpdates()).toHaveLength(0);
  });
});
