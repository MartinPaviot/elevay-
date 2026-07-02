import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrollOne, type EnrollOneDeps } from "../enroll";
import type { guardEnrollment } from "@/lib/anti-collision/enroll-guard";
import type { recordAgentAction } from "@/lib/agents/agent-actions";

const guardMock = vi.fn();
const recordDraftMock = vi.fn();
const valuesSpy = vi.fn();
// M13-G1 (T5) — the primitive now resolves the contact's company then loads
// the G1 facts; both injectable.
let g1: { freshSignalCount: number; icpScore: number | null; icpScoringActive: boolean } = { freshSignalCount: 1, icpScore: 80, icpScoringActive: true };
const loadG1Mock = vi.fn(async () => ({ forCompany: () => g1 }));
// M13 T6 — the G1 verdict writer is injected: the default touches the real db.
const recordGateMock = vi.fn(async (rows: unknown[]) => rows.length);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const database = {
  insert: () => ({ values: valuesSpy }),
  select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ companyId: "co1" }] }) }) }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const deps = (): EnrollOneDeps => ({
  guard: guardMock as unknown as typeof guardEnrollment,
  recordDraft: recordDraftMock as unknown as typeof recordAgentAction,
  database,
  loadG1: loadG1Mock as unknown as EnrollOneDeps["loadG1"],
  recordGate: recordGateMock as unknown as EnrollOneDeps["recordGate"],
});

beforeEach(() => {
  guardMock.mockReset();
  recordDraftMock.mockReset().mockResolvedValue(undefined);
  // values() chains .onConflictDoNothing() (enrollment dedup index).
  valuesSpy.mockReset().mockReturnValue({ onConflictDoNothing: () => Promise.resolve(undefined) });
  g1 = { freshSignalCount: 1, icpScore: 80, icpScoringActive: true };
  loadG1Mock.mockClear();
  recordGateMock.mockClear();
});

describe("enrollOne", () => {
  it("draft → records a pending agent action (review lane), no enrollment insert", async () => {
    const res = await enrollOne({ tenantId: "t1", contactId: "c1", sequenceId: "s1", action: "draft", draftPayload: { companyId: "co1" } }, deps());
    expect(res.outcome).toBe("drafted");
    expect(recordDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        actionType: "sequence-enrollment",
        awaitingApproval: true,
        payload: expect.objectContaining({ source: "autopilot", sequenceId: "s1", contactIds: ["c1"], companyId: "co1" }),
      }),
    );
    expect(guardMock).not.toHaveBeenCalled();
    expect(valuesSpy).not.toHaveBeenCalled();
  });

  it("auto + anti-collision clear → enrolls (active, step 1, due now)", async () => {
    guardMock.mockResolvedValue({ proceed: true });
    const res = await enrollOne({ tenantId: "t1", contactId: "c1", sequenceId: "s1", action: "auto" }, deps());
    expect(res.outcome).toBe("enrolled");
    expect(guardMock).toHaveBeenCalledWith({ tenantId: "t1", contactId: "c1", enrollmentId: "s1:c1" });
    expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({ sequenceId: "s1", contactId: "c1", status: "active", currentStep: 1 }));
    expect(recordDraftMock).not.toHaveBeenCalled();
  });

  it("auto + anti-collision held → skipped, no double-enroll", async () => {
    guardMock.mockResolvedValue({ proceed: false });
    const res = await enrollOne({ tenantId: "t1", contactId: "c1", sequenceId: "s1", action: "auto" }, deps());
    expect(res.outcome).toBe("collision");
    expect(valuesSpy).not.toHaveBeenCalled();
  });
});

describe("enrollOne — M13-G1 (T5)", () => {
  it("no fresh signal -> ineligible: no draft, no enrollment, guard never claimed", async () => {
    g1 = { freshSignalCount: 0, icpScore: 80, icpScoringActive: true };
    for (const action of ["draft", "auto"] as const) {
      const res = await enrollOne({ tenantId: "t1", contactId: "c1", sequenceId: "s1", action }, deps());
      expect(res.outcome).toBe("ineligible");
    }
    expect(recordDraftMock).not.toHaveBeenCalled();
    expect(guardMock).not.toHaveBeenCalled();
    expect(valuesSpy).not.toHaveBeenCalled();
  });

  it("below ICP threshold with active scoring -> ineligible", async () => {
    g1 = { freshSignalCount: 2, icpScore: 10, icpScoringActive: true };
    const res = await enrollOne({ tenantId: "t1", contactId: "c1", sequenceId: "s1", action: "auto" }, deps());
    expect(res.outcome).toBe("ineligible");
  });

  it("unscored tenant (icpScoringActive false) -> the threshold never bites (sane default)", async () => {
    g1 = { freshSignalCount: 1, icpScore: null, icpScoringActive: false };
    guardMock.mockResolvedValue({ proceed: true });
    const res = await enrollOne({ tenantId: "t1", contactId: "c1", sequenceId: "s1", action: "auto" }, deps());
    expect(res.outcome).toBe("enrolled");
  });

  // M13 T6 — every G1 verdict becomes a gate_decisions row.
  it("ineligible -> ONE blocked verdict row with the machine reason", async () => {
    g1 = { freshSignalCount: 0, icpScore: 80, icpScoringActive: true };
    await enrollOne({ tenantId: "t1", contactId: "c1", sequenceId: "s1", action: "auto" }, deps());
    expect(recordGateMock).toHaveBeenCalledTimes(1);
    expect(recordGateMock.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        gate: 1,
        subjectType: "enrollment",
        subjectId: "c1",
        verdict: "blocked",
        reasons: expect.objectContaining({ reason: "no_fresh_signal", sequenceId: "s1" }),
      }),
    ]);
  });

  it("eligible -> ONE pass verdict row", async () => {
    guardMock.mockResolvedValue({ proceed: true });
    await enrollOne({ tenantId: "t1", contactId: "c1", sequenceId: "s1", action: "auto" }, deps());
    expect(recordGateMock.mock.calls[0][0]).toEqual([
      expect.objectContaining({ gate: 1, verdict: "pass" }),
    ]);
  });
});
