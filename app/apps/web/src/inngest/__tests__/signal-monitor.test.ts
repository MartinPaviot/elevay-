import { describe, expect, it } from "vitest";
import { upsertMonitorSignal, detectJobSignals, type JobPosting } from "../signal-monitor";

describe("detectJobSignals — the ONLY signal family the monitor emits (news funding/acquisition removed)", () => {
  const ctx = { companyId: "c1", tenantId: "t1", now: "2026-07-02T00:00:00Z" };
  const roles = (n: number, senior = 0): JobPosting[] => [
    ...Array.from({ length: n }, (_, i) => ({ title: `Role ${i}` })),
    ...Array.from({ length: senior }, () => ({ title: "VP Sales", senioritySignal: "vp_hire" })),
  ];

  it("fires hiring_surge at >= 5 open roles", () => {
    const out = detectJobSignals(roles(5), new Set(), ctx);
    expect(out.map((s) => s.signalType)).toContain("hiring_surge");
    expect(out.find((s) => s.signalType === "hiring_surge")!.detail).toMatch(/5 open roles/);
  });

  it("does NOT fire hiring_surge below 5 roles", () => {
    expect(detectJobSignals(roles(4), new Set(), ctx)).toHaveLength(0);
  });

  it("fires executive_hire on a VP/C-level posting", () => {
    const out = detectJobSignals(roles(0, 1), new Set(), ctx);
    expect(out.map((s) => s.signalType)).toEqual(["executive_hire"]);
  });

  it("never emits funding_recent or acquisition — those were removed (name-guessed news)", () => {
    const out = detectJobSignals(roles(10, 2), new Set(), ctx);
    const types = out.map((s) => s.signalType);
    expect(types).not.toContain("funding_recent");
    expect(types).not.toContain("acquisition");
    expect(new Set(types)).toEqual(new Set(["hiring_surge", "executive_hire"]));
  });

  it("respects the existing-type guard (no re-fire of a type already present)", () => {
    const out = detectJobSignals(roles(6, 1), new Set(["hiring_surge"]), ctx);
    expect(out.map((s) => s.signalType)).toEqual(["executive_hire"]);
  });
});

describe("upsertMonitorSignal — dedup-by-type on persist", () => {
  const funding = { type: "funding_recent", confidence: "high", detail: "Series A", detectedAt: "2026-06-01T00:00:00Z", isNew: true };

  it("appends a brand-new type", () => {
    const out = upsertMonitorSignal([], funding);
    expect(out).toEqual([funding]);
  });

  it("REPLACES a prior entry of the same type instead of appending a duplicate", () => {
    const stale = { type: "funding_recent", confidence: "high", detail: "old raise", detectedAt: "2026-01-01T00:00:00Z", isNew: true };
    const fresher = { ...funding, detail: "Series B", detectedAt: "2026-06-27T00:00:00Z" };
    const out = upsertMonitorSignal([stale], fresher);
    // Exactly one funding_recent — the fresh one — never two.
    expect(out.filter((s) => s.type === "funding_recent")).toHaveLength(1);
    expect(out[0]).toEqual(fresher);
  });

  it("preserves other-type entries and appends the new one last (order-stable)", () => {
    const hiring = { type: "hiring_surge", confidence: "high", detail: "5 roles", detectedAt: "2026-06-10T00:00:00Z", isNew: true };
    const out = upsertMonitorSignal([hiring], funding);
    expect(out).toEqual([hiring, funding]);
  });

  it("keeps the richer monitor fields (detail/confidence/isNew) downstream consumers read", () => {
    const out = upsertMonitorSignal([], funding);
    expect(out[0]).toMatchObject({ detail: "Series A", confidence: "high", isNew: true });
  });
});
