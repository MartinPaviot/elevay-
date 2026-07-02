import { describe, it, expect, vi, beforeEach } from "vitest";
import { runDraftG4Gate, type GateRunnerDeps } from "@/lib/sequence-drafts/gate-runner";

/**
 * M13 T6 — the G4 draft gate. Pins the tasks.md Done criterion: a generation
 * blocked twice lands in set_aside and is NEVER sent (no path to approved),
 * plus the pass / rework-pass / fail-open dispositions and the gate_decisions
 * rows each one writes.
 */

const updates: Array<Record<string, unknown>> = [];
const recorded: Array<{ verdict: string; score: number | null; reasons: Record<string, unknown> }> = [];

const baseInput = {
  tenantId: "t1",
  draftId: "d1",
  contactId: "c1",
  enrollmentId: "e1",
  stepNumber: 1,
  content: { subject: "s", body: "hello world" },
};

function deps(overrides: Partial<GateRunnerDeps>): GateRunnerDeps {
  return {
    updateDraft: async (fields) => {
      updates.push(fields);
    },
    grade: async () => ({ score: 0.9, issues: [] }),
    threshold: 0.7,
    regenerate: async () => ({ subject: "s2", body: "better body" }),
    record: (async (rows: Array<{ verdict: string; score?: number | null; reasons?: Record<string, unknown> }>) => {
      for (const r of rows) recorded.push({ verdict: r.verdict, score: r.score ?? null, reasons: r.reasons ?? {} });
      return rows.length;
    }) as unknown as GateRunnerDeps["record"],
    ...overrides,
  };
}

const statusWalk = () => updates.filter((u) => "status" in u).map((u) => u.status);

beforeEach(() => {
  updates.length = 0;
  recorded.length = 0;
});

describe("runDraftG4Gate", () => {
  it("above the bar -> pending_approval with a pass verdict + persisted score", async () => {
    const res = await runDraftG4Gate(baseInput, deps({}));
    expect(res).toMatchObject({ finalStatus: "pending_approval", score: 0.9, attempts: 1 });
    expect(statusWalk()).toEqual(["pending_approval"]);
    expect(recorded).toEqual([
      expect.objectContaining({ verdict: "pass", score: 0.9 }),
    ]);
  });

  it("blocked TWICE -> set_aside, never approved, never sent (Done criterion)", async () => {
    const grade = vi.fn(async () => ({ score: 0.4, issues: ["too generic", "no CTA"] }));
    const res = await runDraftG4Gate(baseInput, deps({ grade }));
    expect(res.finalStatus).toBe("set_aside");
    expect(res.attempts).toBe(2);
    // The walk: block, rework roll, re-gate, block again, set aside.
    expect(statusWalk()).toEqual([
      "blocked",
      "reworking",
      "gates_running",
      "blocked",
      "set_aside",
    ]);
    // NEVER a sendable status.
    expect(statusWalk()).not.toContain("pending_approval");
    expect(statusWalk()).not.toContain("approved");
    expect(statusWalk()).not.toContain("sent");
    // Two blocked verdicts on record; the set_aside carries the explanation.
    expect(recorded.map((r) => r.verdict)).toEqual(["blocked", "blocked"]);
    const setAside = updates.find((u) => u.status === "set_aside");
    expect(String(setAside?.reviewReason)).toMatch(/copy-quality gate \(G4\)/);
    expect(String(setAside?.reviewReason)).toMatch(/too generic/);
  });

  it("blocked once then the rework passes -> pending_approval with a 'reworked' verdict", async () => {
    const grade = vi
      .fn()
      .mockResolvedValueOnce({ score: 0.5, issues: ["weak opener"] })
      .mockResolvedValueOnce({ score: 0.85, issues: [] });
    const res = await runDraftG4Gate(baseInput, deps({ grade }));
    expect(res).toMatchObject({ finalStatus: "pending_approval", score: 0.85, attempts: 2 });
    expect(statusWalk()).toEqual(["blocked", "reworking", "gates_running", "pending_approval"]);
    expect(recorded.map((r) => r.verdict)).toEqual(["blocked", "reworked"]);
    // The rework rewrote the draft content (fresh roll persisted).
    const contentUpdate = updates.find((u) => "bodyText" in u);
    expect(contentUpdate).toMatchObject({ subject: "s2", bodyText: "better body" });
  });

  it("grader crash -> FAIL-OPEN to pending_approval with the failOpen reason logged", async () => {
    const grade = vi.fn(async () => {
      throw new Error("context exploded");
    });
    const res = await runDraftG4Gate(baseInput, deps({ grade }));
    expect(res).toMatchObject({ finalStatus: "pending_approval", score: null });
    expect(recorded).toEqual([
      expect.objectContaining({
        verdict: "pass",
        score: null,
        reasons: expect.objectContaining({ failOpen: "grader_error" }),
      }),
    ]);
  });

  it("regeneration crash -> attempt 2 re-judges the SAME content and sets aside", async () => {
    const grade = vi.fn(async () => ({ score: 0.3, issues: ["empty"] }));
    const regenerate = vi.fn(async () => {
      throw new Error("LLM down");
    });
    const res = await runDraftG4Gate(baseInput, deps({ grade, regenerate }));
    expect(res.finalStatus).toBe("set_aside");
    // No content update happened (the roll failed) — attempt-1 content stands.
    expect(updates.find((u) => "bodyText" in u)).toBeUndefined();
  });

  it("verdict rows carry the draft as subject + enrollment context", async () => {
    await runDraftG4Gate(baseInput, deps({}));
    expect(recorded[0]?.reasons).toMatchObject({ enrollmentId: "e1", stepNumber: 1 });
  });
});
