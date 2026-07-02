import { describe, it, expect, vi } from "vitest";

/**
 * M13 T6 — the single gate_decisions writer. Pins: exploitable rows (gate,
 * score, verdict, reasons), chunked bulk inserts, the BEST-EFFORT contract
 * (a failing insert never throws), and the shared G1 row mapping.
 */

vi.mock("@/db/schema", () => ({
  gateDecisions: { __table: "gate_decisions" },
}));
vi.mock("@/db", () => ({ db: { insert: vi.fn() } }));

import {
  recordGateDecision,
  recordGateDecisions,
  g1DecisionRow,
  GATE_RUBRICS,
  type GateDecisionInput,
} from "@/lib/gates/gate-decisions";

function dbSpy() {
  const inserted: Array<Record<string, unknown>[]> = [];
  return {
    inserted,
    database: {
      insert: () => ({
        values: async (rows: Record<string, unknown>[]) => {
          inserted.push(rows);
        },
      }),
    } as never,
  };
}

describe("recordGateDecisions", () => {
  it("writes an exploitable row: gate, rubric, score, verdict, reasons", async () => {
    const { inserted, database } = dbSpy();
    const n = await recordGateDecision(
      {
        tenantId: "t1",
        subjectType: "draft",
        subjectId: "d1",
        gate: 4,
        rubricVersion: GATE_RUBRICS.g4Step,
        score: 0.62,
        verdict: "blocked",
        reasons: { threshold: 0.7 },
      },
      database,
    );
    expect(n).toBe(1);
    expect(inserted[0][0]).toMatchObject({
      tenantId: "t1",
      subjectType: "draft",
      subjectId: "d1",
      gate: 4,
      rubricVersion: "g4.step.v1",
      score: 0.62,
      verdict: "blocked",
      reasons: { threshold: 0.7 },
    });
  });

  it("chunks bulk writes (a 450-row enrollment sweep -> 3 inserts)", async () => {
    const { inserted, database } = dbSpy();
    const rows: GateDecisionInput[] = Array.from({ length: 450 }, (_, i) => ({
      tenantId: "t1",
      subjectType: "enrollment",
      subjectId: `c${i}`,
      gate: 1,
      rubricVersion: GATE_RUBRICS.g1,
      verdict: "pass",
    }));
    const n = await recordGateDecisions(rows, database);
    expect(n).toBe(450);
    expect(inserted.map((c) => c.length)).toEqual([200, 200, 50]);
  });

  it("BEST-EFFORT: a throwing insert is swallowed, returns 0, never rejects", async () => {
    const database = {
      insert: () => ({
        values: async () => {
          throw new Error("connection refused");
        },
      }),
    } as never;
    await expect(
      recordGateDecision(
        {
          tenantId: "t1",
          subjectType: "send",
          subjectId: "a@b.c",
          gate: 5,
          rubricVersion: GATE_RUBRICS.g5Transport,
          verdict: "pass",
        },
        database,
      ),
    ).resolves.toBe(0);
  });

  it("empty input is a no-op", async () => {
    const { inserted, database } = dbSpy();
    expect(await recordGateDecisions([], database)).toBe(0);
    expect(inserted).toEqual([]);
  });
});

describe("g1DecisionRow", () => {
  it("eligible -> pass row on gate 1", () => {
    const row = g1DecisionRow({
      tenantId: "t1",
      contactId: "c1",
      result: { eligible: true },
      reasons: { sequenceId: "s1", source: "manual_enroll" },
    });
    expect(row).toMatchObject({
      subjectType: "enrollment",
      subjectId: "c1",
      gate: 1,
      verdict: "pass",
      reasons: { sequenceId: "s1", source: "manual_enroll" },
    });
  });

  it.each(["no_fresh_signal", "below_icp_threshold"])(
    "G1 rejection %s -> blocked row carrying the reason",
    (reason) => {
      const row = g1DecisionRow({
        tenantId: "t1",
        contactId: "c1",
        result: { eligible: false, reason },
      });
      expect(row).toMatchObject({ verdict: "blocked", reasons: { reason } });
    },
  );

  it.each(["deleted", "no_email", "suppressed", "excluded_company"])(
    "non-G1 rejection %s -> NO row (the gate never evaluated)",
    (reason) => {
      expect(
        g1DecisionRow({ tenantId: "t1", contactId: "c1", result: { eligible: false, reason } }),
      ).toBeNull();
    },
  );
});
