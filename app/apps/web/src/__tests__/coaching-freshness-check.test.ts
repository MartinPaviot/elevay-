import { describe, it, expect } from "vitest";
import {
  evaluateFreshness,
  freshnessNotificationCopy,
  aggregateFreshness,
} from "@/lib/coaching/freshness-check";

describe("evaluateFreshness", () => {
  const baseInput = {
    tenantId: "t-1",
    completedMeetingsLastNdays: 0,
    chunksLastNdays: 0,
    windowDays: 7,
  };

  it("returns no_meetings when 0 meetings completed (informational)", () => {
    const v = evaluateFreshness(baseInput);
    expect(v.status).toBe("no_meetings");
    expect(v.severity).toBe(0);
    expect(v.coverageRatio).toBeNull();
  });

  it("returns silent (severity 2) when ≥3 meetings + 0 chunks", () => {
    const v = evaluateFreshness({ ...baseInput, completedMeetingsLastNdays: 3 });
    expect(v.status).toBe("silent");
    expect(v.severity).toBe(2);
    expect(v.coverageRatio).toBe(0);
    expect(v.reason).toMatch(/3 meetings/);
    expect(v.reason).toMatch(/Recall/i);
  });

  it("does NOT mark silent when only 1-2 meetings + 0 chunks (could be one bad call)", () => {
    expect(
      evaluateFreshness({
        ...baseInput,
        completedMeetingsLastNdays: 1,
      }).status,
    ).not.toBe("silent");
    expect(
      evaluateFreshness({
        ...baseInput,
        completedMeetingsLastNdays: 2,
      }).status,
    ).not.toBe("silent");
  });

  it("returns healthy when coverage ratio >= 1", () => {
    const v = evaluateFreshness({
      ...baseInput,
      completedMeetingsLastNdays: 5,
      chunksLastNdays: 200,
    });
    expect(v.status).toBe("healthy");
    expect(v.severity).toBe(0);
    expect(v.coverageRatio).toBe(40);
  });

  it("healthy boundary : exactly 1 chunk per meeting passes", () => {
    expect(
      evaluateFreshness({
        ...baseInput,
        completedMeetingsLastNdays: 5,
        chunksLastNdays: 5,
      }).status,
    ).toBe("healthy");
  });

  it("returns degraded (severity 1) when coverage between 0 and 1", () => {
    const v = evaluateFreshness({
      ...baseInput,
      completedMeetingsLastNdays: 10,
      chunksLastNdays: 5,
    });
    expect(v.status).toBe("degraded");
    expect(v.severity).toBe(1);
    expect(v.coverageRatio).toBe(0.5);
  });

  it("degraded for 1-2 meetings + 0 chunks (under silent threshold)", () => {
    const v = evaluateFreshness({
      ...baseInput,
      completedMeetingsLastNdays: 2,
      chunksLastNdays: 0,
    });
    expect(v.status).toBe("degraded");
    expect(v.severity).toBe(1);
    expect(v.coverageRatio).toBe(0);
  });

  it("clamps negative inputs to 0 instead of throwing", () => {
    const v = evaluateFreshness({
      ...baseInput,
      completedMeetingsLastNdays: -5,
      chunksLastNdays: -10,
    });
    expect(v.status).toBe("no_meetings");
  });

  it("floors fractional inputs", () => {
    const v = evaluateFreshness({
      ...baseInput,
      completedMeetingsLastNdays: 2.9,
      chunksLastNdays: 0,
    });
    // 2 (floored) → not silent (under 3 threshold), so degraded.
    expect(v.status).toBe("degraded");
  });
});

describe("freshnessNotificationCopy", () => {
  it("returns null for severity 0", () => {
    expect(
      freshnessNotificationCopy({
        tenantId: "t",
        status: "healthy",
        reason: "ok",
        severity: 0,
        coverageRatio: 5,
      }),
    ).toBeNull();
  });

  it("returns silent copy with re-connect CTA", () => {
    const copy = freshnessNotificationCopy({
      tenantId: "t",
      status: "silent",
      reason: "5 meetings, 0 chunks",
      severity: 2,
      coverageRatio: 0,
    });
    expect(copy).not.toBeNull();
    expect(copy!.title).toMatch(/Transcript indexing stopped/);
    expect(copy!.cta).toMatch(/Re-connect/i);
  });

  it("returns degraded copy with check-status CTA", () => {
    const copy = freshnessNotificationCopy({
      tenantId: "t",
      status: "degraded",
      reason: "10 meetings, 5 chunks",
      severity: 1,
      coverageRatio: 0.5,
    });
    expect(copy).not.toBeNull();
    expect(copy!.title).toMatch(/coverage below normal/i);
  });
});

describe("aggregateFreshness", () => {
  const make = (status: "healthy" | "degraded" | "silent" | "no_meetings") => ({
    tenantId: "t",
    status,
    reason: "",
    severity: status === "silent" ? (2 as const) : status === "degraded" ? (1 as const) : (0 as const),
    coverageRatio: 0,
  });

  it("counts each bucket", () => {
    const agg = aggregateFreshness([
      make("healthy"),
      make("healthy"),
      make("degraded"),
      make("silent"),
      make("no_meetings"),
    ]);
    expect(agg).toEqual({
      total: 5,
      healthy: 2,
      degraded: 1,
      silent: 1,
      noMeetings: 1,
    });
  });

  it("returns zeros on empty input", () => {
    expect(aggregateFreshness([])).toEqual({
      total: 0,
      healthy: 0,
      degraded: 0,
      silent: 0,
      noMeetings: 0,
    });
  });
});
