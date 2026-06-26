import { describe, expect, it } from "vitest";
import { upsertSignalEntry, type SignalEntry } from "../record-signal";

const sig = (type: string, detectedAt: string, strength?: SignalEntry["strength"]): SignalEntry => ({
  type,
  detectedAt,
  ...(strength ? { strength } : {}),
});

describe("upsertSignalEntry", () => {
  it("appends a new signal type", () => {
    const out = upsertSignalEntry([], sig("funding", "2026-06-26T00:00:00Z", "high"));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "funding", strength: "high" });
  });

  it("keeps other types untouched when adding a new one", () => {
    const start = [sig("hiring", "2026-06-01T00:00:00Z")];
    const out = upsertSignalEntry(start, sig("funding", "2026-06-26T00:00:00Z"));
    expect(out.map((s) => s.type).sort()).toEqual(["funding", "hiring"]);
  });

  it("replaces an existing signal of the same type with the newer entry", () => {
    const start = [sig("funding", "2026-01-01T00:00:00Z", "low")];
    const out = upsertSignalEntry(start, sig("funding", "2026-06-26T00:00:00Z", "high"));
    expect(out).toHaveLength(1);
    expect(out[0].detectedAt).toBe("2026-06-26T00:00:00Z");
    expect(out[0].strength).toBe("high");
  });

  it("does not mutate the input array", () => {
    const start = [sig("funding", "2026-01-01T00:00:00Z")];
    const out = upsertSignalEntry(start, sig("hiring", "2026-06-26T00:00:00Z"));
    expect(start).toHaveLength(1);
    expect(out).toHaveLength(2);
  });

  it("dedups to one entry per type across repeated upserts", () => {
    let acc: SignalEntry[] = [];
    acc = upsertSignalEntry(acc, sig("funding", "2026-06-01T00:00:00Z"));
    acc = upsertSignalEntry(acc, sig("funding", "2026-06-15T00:00:00Z"));
    acc = upsertSignalEntry(acc, sig("funding", "2026-06-26T00:00:00Z"));
    expect(acc).toHaveLength(1);
    expect(acc[0].detectedAt).toBe("2026-06-26T00:00:00Z");
  });
});
