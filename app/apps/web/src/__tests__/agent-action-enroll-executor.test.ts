/**
 * CLE-13 — the deferred sequence-enrollment executor's DB behavior (the trust
 * boundary): it enrolls ONLY contacts that belong to the tenant + aren't
 * soft-deleted (re-validated here, since sequenceEnrollments has no tenantId
 * column and the payload is replayed from approval), skips already-enrolled
 * contacts, and is tenant-scoped on the sequence. Review-found H1.
 *
 * The drizzle predicates are NOT stubbed to identity — eq/inArray/isNull return
 * structured ops and every WHERE is captured, so the test PROVES the contacts
 * re-validation query actually carries eq(contacts.tenantId), isNull(deletedAt),
 * and inArray(contacts.id) — a future edit dropping the tenant scope fails here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Ordered result queue the mocked db.select chain shifts from, in call order.
const selectQueue: unknown[][] = [];
const insertedValues: Array<Record<string, unknown>> = [];
// Every WHERE predicate the executor builds, in call order, for assertion.
const wherePredicates: unknown[] = [];

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        // generic select: .from().where()  (resolves as awaited or via .limit)
        where: (cond: unknown) => {
          wherePredicates.push(cond);
          const result = selectQueue.shift() ?? [];
          return {
            limit: () => Promise.resolve(result),
            then: (res: (v: unknown) => void) => res(result),
          };
        },
      }),
    })),
    insert: vi.fn(() => ({
      values: (v: Record<string, unknown>) => {
        insertedValues.push(v);
        // Awaitable (tasks/deals `await ...values()`) AND chainable (the
        // enrollment insert calls `.onConflictDoNothing()`).
        return {
          onConflictDoNothing: () => Promise.resolve(undefined),
          then: (resolve: (v: unknown) => void) => resolve(undefined),
        };
      },
    })),
  },
}));

vi.mock("@/db/schema", () => ({
  tasks: {}, deals: {}, companies: {},
  contacts: { id: "contacts.id", tenantId: "contacts.tenantId", deletedAt: "contacts.deletedAt" },
  sequences: { id: "sequences.id", tenantId: "sequences.tenantId" },
  sequenceEnrollments: { id: "se.id", sequenceId: "se.sequenceId", contactId: "se.contactId" },
}));

// Structured ops (NOT identity) so the captured predicate is introspectable.
vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ op: "and", args }),
  eq: (col: unknown, val: unknown) => ({ op: "eq", col, val }),
  inArray: (col: unknown, vals: unknown) => ({ op: "inArray", col, vals }),
  isNull: (col: unknown) => ({ op: "isNull", col }),
  ne: (col: unknown, val: unknown) => ({ op: "ne", col, val }),
}));

vi.mock("@/lib/emails/deliver-interactive", () => ({ deliverInteractiveEmail: vi.fn() }));

// M13 T6 — the executor now re-verifies G1 at approval time (M2-R4). Mock the
// LOADER (permissive by default, mutable for the staleness test) so the
// sequenced db.select queue above stays aligned; suppression likewise (the
// fixtures now carry emails, which would otherwise trigger a real query).
let g1Facts = { freshSignalCount: 1, icpScore: null as number | null, icpScoringActive: false };
vi.mock("@/lib/sequences/eligibility-context", () => ({
  loadG1Context: vi.fn(async () => ({ forCompany: () => g1Facts })),
}));
vi.mock("@/lib/sequences/suppression", () => ({
  loadSuppressedEmails: vi.fn(async () => new Set<string>()),
}));
const recordedGateRows: Array<Record<string, unknown>> = [];
vi.mock("@/lib/gates/gate-decisions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gates/gate-decisions")>();
  return {
    ...actual,
    recordGateDecisions: vi.fn(async (rows: Array<Record<string, unknown>>) => {
      recordedGateRows.push(...rows);
      return rows.length;
    }),
  };
});

import { executeAgentAction } from "@/lib/agents/action-executors";

const action = (payload: Record<string, unknown>) => ({
  id: "a1", userId: null, actionType: "sequence-enrollment", payload,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flatten = (p: any): any[] => (p && p.op === "and" ? p.args.flatMap(flatten) : [p]);

beforeEach(() => {
  selectQueue.length = 0;
  insertedValues.length = 0;
  wherePredicates.length = 0;
  recordedGateRows.length = 0;
  g1Facts = { freshSignalCount: 1, icpScore: null, icpScoringActive: false };
});

describe("sequence-enrollment executor — tenant/deletedAt trust boundary (H1)", () => {
  it("enrolls only tenant-valid, non-deleted, not-already-enrolled contacts", async () => {
    // 1) sequence belongs to tenant
    selectQueue.push([{ id: "seq1" }]);
    // 2) valid contacts: c2 is excluded (cross-tenant / soft-deleted)
    selectQueue.push([
      { id: "c1", email: "c1@x.co", companyId: "co1" },
      { id: "c3", email: "c3@x.co", companyId: "co3" },
    ]);
    // 3) existing-enrollment check for c1 -> none; 4) for c3 -> already enrolled
    selectQueue.push([]); // c1
    selectQueue.push([{ id: "e1" }]); // c3 already enrolled

    const r = await executeAgentAction(
      "t1",
      action({ sequenceId: "seq1", sequenceName: "Hot leads", contactIds: ["c1", "c2", "c3"] }),
    );

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.detail).toBe("Enrolled 1 contact in Hot leads (2 skipped).");
    // Only c1 inserted (c2 invalid, c3 already enrolled).
    expect(insertedValues).toHaveLength(1);
    expect(insertedValues[0]).toMatchObject({ sequenceId: "seq1", contactId: "c1", status: "active", currentStep: 1 });

    // PROVE the contacts re-validation query is genuinely tenant+deletedAt scoped.
    const contactsPred = wherePredicates
      .map(flatten)
      .find((terms) => terms.some((t: { op?: string; col?: unknown }) => t?.op === "inArray" && t.col === "contacts.id"));
    expect(contactsPred, "contacts re-validation predicate must exist").toBeDefined();
    expect(contactsPred).toEqual(
      expect.arrayContaining([
        { op: "inArray", col: "contacts.id", vals: ["c1", "c2", "c3"] },
        { op: "eq", col: "contacts.tenantId", val: "t1" },
        { op: "isNull", col: "contacts.deletedAt" },
      ]),
    );
  });

  it("fails closed when the sequence is not the tenant's (no inserts)", async () => {
    selectQueue.push([]); // sequence lookup -> none for this tenant
    const r = await executeAgentAction("t1", action({ sequenceId: "seqX", contactIds: ["c1"] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/sequence not found/);
    expect(insertedValues).toHaveLength(0);
    // The sequence lookup itself is tenant-scoped.
    const seqPred = wherePredicates
      .map(flatten)
      .find((terms) => terms.some((t: { op?: string; col?: unknown }) => t?.col === "sequences.id"));
    expect(seqPred).toEqual(
      expect.arrayContaining([
        { op: "eq", col: "sequences.id", val: "seqX" },
        { op: "eq", col: "sequences.tenantId", val: "t1" },
      ]),
    );
  });

  it("enrolls nobody (ok, all skipped) when no contact survives re-validation", async () => {
    selectQueue.push([{ id: "seq1" }]); // sequence ok
    selectQueue.push([]); // no valid contacts (all cross-tenant / deleted)
    const r = await executeAgentAction("t1", action({ sequenceId: "seq1", contactIds: ["c1", "c2"] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.detail).toBe("Enrolled 0 contacts in the sequence (2 skipped).");
    expect(insertedValues).toHaveLength(0);
  });

  // M13 T6 — the payload was G1-checked when RECORDED; the executor re-checks
  // at APPROVAL time because the founder may approve days later (M2-R4).
  it("re-verifies G1 at approval: a signal that expired since recording skips the contact", async () => {
    g1Facts = { freshSignalCount: 0, icpScore: null, icpScoringActive: false };
    selectQueue.push([{ id: "seq1" }]); // sequence ok
    selectQueue.push([{ id: "c1", email: "c1@x.co", companyId: "co1" }]); // contact still valid
    const r = await executeAgentAction(
      "t1",
      action({ sequenceId: "seq1", sequenceName: "Hot leads", contactIds: ["c1"] }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.detail).toBe("Enrolled 0 contacts in Hot leads (1 skipped).");
    expect(insertedValues).toHaveLength(0);
    // The verdict is on record: blocked, gate 1, with the machine reason.
    expect(recordedGateRows).toEqual([
      expect.objectContaining({
        gate: 1,
        subjectId: "c1",
        verdict: "blocked",
        reasons: expect.objectContaining({ reason: "no_fresh_signal", source: "approval_executor" }),
      }),
    ]);
  });

  it("G1 pass at approval -> pass verdict row alongside the enrollment", async () => {
    selectQueue.push([{ id: "seq1" }]);
    selectQueue.push([{ id: "c1", email: "c1@x.co", companyId: "co1" }]);
    selectQueue.push([]); // not already enrolled
    const r = await executeAgentAction(
      "t1",
      action({ sequenceId: "seq1", sequenceName: "Hot leads", contactIds: ["c1"] }),
    );
    expect(r.ok).toBe(true);
    expect(insertedValues).toHaveLength(1);
    expect(recordedGateRows).toEqual([
      expect.objectContaining({ gate: 1, subjectId: "c1", verdict: "pass" }),
    ]);
  });
});
