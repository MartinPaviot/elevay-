import { describe, it, expect } from "vitest";
import { tomorrowMorning, inThreeDays, nextMonday } from "../snooze-presets";

/**
 * B6.4 — snooze presets resolve to 09:00 local on the right day, with an
 * injectable clock so the `s` key and the pane popover agree on the instant.
 */

// A Wednesday afternoon: 2026-06-17T14:30 local.
const wed = new Date(2026, 5, 17, 14, 30, 0, 0);

describe("snooze presets", () => {
  it("tomorrowMorning = next calendar day at 09:00 local", () => {
    const d = tomorrowMorning(wed);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(18);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });

  it("tomorrowMorning is strictly in the future and does not mutate the input", () => {
    const before = wed.getTime();
    const d = tomorrowMorning(wed);
    expect(d.getTime()).toBeGreaterThan(wed.getTime());
    expect(wed.getTime()).toBe(before); // input untouched (we clone)
  });

  it("inThreeDays = +3 calendar days at 09:00", () => {
    const d = inThreeDays(wed);
    expect(d.getDate()).toBe(20);
    expect(d.getHours()).toBe(9);
  });

  it("nextMonday from a Wednesday lands on the following Monday (the 22nd) at 09:00", () => {
    const d = nextMonday(wed);
    expect(d.getDay()).toBe(1); // Monday
    expect(d.getDate()).toBe(22);
    expect(d.getHours()).toBe(9);
  });

  it("nextMonday from a Monday rolls to the NEXT Monday, never today", () => {
    const mon = new Date(2026, 5, 15, 8, 0, 0, 0); // 2026-06-15 is a Monday
    const d = nextMonday(mon);
    expect(d.getDay()).toBe(1);
    expect(d.getDate()).toBe(22);
    expect(d.getTime()).toBeGreaterThan(mon.getTime());
  });
});
