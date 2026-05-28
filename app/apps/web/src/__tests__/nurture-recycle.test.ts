import { describe, expect, it } from "vitest";
import {
  DEFAULT_NURTURE_WINDOW_DAYS,
  isNurtureSequenceName,
  shouldRecycleEnrollment,
} from "@/lib/sequences/nurture-recycle";

describe("shouldRecycleEnrollment", () => {
  const now = new Date("2026-05-28T12:00:00Z");
  const oldEnough = new Date("2026-04-20T12:00:00Z"); // 38 days ago

  it("recycles a completed enrollment whose last step is 38 days old", () => {
    expect(
      shouldRecycleEnrollment({
        status: "completed",
        lastStepAt: oldEnough,
        now,
      }),
    ).toEqual({ recycle: true });
  });

  it("refuses to recycle an active enrollment (still in flight)", () => {
    expect(
      shouldRecycleEnrollment({
        status: "active",
        lastStepAt: oldEnough,
        now,
      }),
    ).toEqual({ recycle: false, reason: "status_not_completed" });
  });

  it("refuses to recycle a paused enrollment (founder decision pending)", () => {
    expect(
      shouldRecycleEnrollment({
        status: "paused",
        lastStepAt: oldEnough,
        now,
      }),
    ).toEqual({ recycle: false, reason: "status_not_completed" });
  });

  it("refuses to recycle a replied enrollment (relationship live)", () => {
    expect(
      shouldRecycleEnrollment({
        status: "replied",
        lastStepAt: oldEnough,
        now,
      }),
    ).toEqual({ recycle: false, reason: "status_not_completed" });
  });

  it("refuses to recycle a bounced enrollment (address bad)", () => {
    expect(
      shouldRecycleEnrollment({
        status: "bounced",
        lastStepAt: oldEnough,
        now,
      }),
    ).toEqual({ recycle: false, reason: "status_not_completed" });
  });

  it("refuses to recycle an unsubscribed enrollment (consent withdrawn)", () => {
    expect(
      shouldRecycleEnrollment({
        status: "unsubscribed",
        lastStepAt: oldEnough,
        now,
      }),
    ).toEqual({ recycle: false, reason: "status_not_completed" });
  });

  it("refuses to recycle when lastStepAt is null (nothing was ever sent)", () => {
    expect(
      shouldRecycleEnrollment({
        status: "completed",
        lastStepAt: null,
        now,
      }),
    ).toEqual({ recycle: false, reason: "no_last_step" });
  });

  it("refuses to recycle when still in cooldown (< 30 days)", () => {
    const tooRecent = new Date("2026-05-10T12:00:00Z"); // 18 days ago
    expect(
      shouldRecycleEnrollment({
        status: "completed",
        lastStepAt: tooRecent,
        now,
      }),
    ).toEqual({ recycle: false, reason: "still_in_cooldown" });
  });

  it("recycles at exactly 30 days + 1ms (boundary case)", () => {
    const boundary = new Date(
      now.getTime() - (DEFAULT_NURTURE_WINDOW_DAYS * 24 * 60 * 60 * 1000 + 1),
    );
    expect(
      shouldRecycleEnrollment({
        status: "completed",
        lastStepAt: boundary,
        now,
      }),
    ).toEqual({ recycle: true });
  });

  it("does NOT recycle at exactly 30 days - 1ms (under boundary)", () => {
    const justBefore = new Date(
      now.getTime() - (DEFAULT_NURTURE_WINDOW_DAYS * 24 * 60 * 60 * 1000 - 1),
    );
    expect(
      shouldRecycleEnrollment({
        status: "completed",
        lastStepAt: justBefore,
        now,
      }),
    ).toEqual({ recycle: false, reason: "still_in_cooldown" });
  });

  it("respects a custom windowDays override (tenant-specific cooldown)", () => {
    const sevenDaysOld = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000 - 1,
    );
    // Default 30-day window: should NOT recycle
    expect(
      shouldRecycleEnrollment({
        status: "completed",
        lastStepAt: sevenDaysOld,
        now,
      }).recycle,
    ).toBe(false);
    // Custom 7-day window: SHOULD recycle
    expect(
      shouldRecycleEnrollment({
        status: "completed",
        lastStepAt: sevenDaysOld,
        now,
        windowDays: 7,
      }).recycle,
    ).toBe(true);
  });
});

describe("isNurtureSequenceName", () => {
  it("matches 'Nurture' exact (canonical name)", () => {
    expect(isNurtureSequenceName("Nurture")).toBe(true);
  });

  it("matches 'nurture' lowercase", () => {
    expect(isNurtureSequenceName("nurture")).toBe(true);
  });

  it("matches 'Nurture FR' (locale-tagged)", () => {
    expect(isNurtureSequenceName("Nurture FR")).toBe(true);
  });

  it("matches 'Nurture US — Q2'", () => {
    expect(isNurtureSequenceName("Nurture US — Q2")).toBe(true);
  });

  it("strips leading whitespace before matching", () => {
    expect(isNurtureSequenceName("  Nurture")).toBe(true);
  });

  it("does NOT match 'Founder classic'", () => {
    expect(isNurtureSequenceName("Founder classic")).toBe(false);
  });

  it("does NOT match 'Re-nurture' (substring, not prefix)", () => {
    expect(isNurtureSequenceName("Re-nurture")).toBe(false);
  });

  it("does NOT match an empty string", () => {
    expect(isNurtureSequenceName("")).toBe(false);
  });
});
