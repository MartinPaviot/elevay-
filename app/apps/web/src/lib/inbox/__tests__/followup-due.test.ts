import { describe, it, expect } from "vitest";
import {
  computeFollowupDue,
  followupLabel,
  businessDaysBetween,
  DEFAULT_BACKOFF_BUSINESS_DAYS,
} from "../followup-due";

/**
 * B7 B1.1/B1.2 — the pure follow-up timing core. All fixtures use an injected
 * `now` so nothing reads the wall clock. Anchored on a known Monday (UTC).
 */

const MON = Date.UTC(2026, 5, 15, 9, 0, 0); // 2026-06-15 09:00Z
const THU = Date.UTC(2026, 5, 18, 9, 0, 0); // +3 business days
const NEXT_MON = Date.UTC(2026, 5, 22, 9, 0, 0); // +5 business days

describe("computeFollowupDue — fixture sanity", () => {
  it("the anchor really is a Monday / Thursday in UTC", () => {
    expect(new Date(MON).getUTCDay()).toBe(1);
    expect(new Date(THU).getUTCDay()).toBe(4);
    expect(new Date(NEXT_MON).getUTCDay()).toBe(1);
    expect([...DEFAULT_BACKOFF_BUSINESS_DAYS]).toEqual([3, 5, 8]);
  });
});

describe("computeFollowupDue — backoff ladder (R1.2/R1.4)", () => {
  it("stage 1 (no prior nudge) is due +3 business days", () => {
    const f = computeFollowupDue(MON, { now: MON, priorNudgeCount: 0 });
    expect(f.dueAt).toBe(THU);
    expect(f.stage).toBe(1);
  });

  it("stage 2 (one prior nudge) is due +5 business days", () => {
    const f = computeFollowupDue(MON, { now: MON, priorNudgeCount: 1 });
    expect(f.dueAt).toBe(NEXT_MON);
    expect(f.stage).toBe(2);
  });

  it("stage 3 is due +8 business days, and stage 4+ repeats the last rung (never shrinks)", () => {
    const s3 = computeFollowupDue(MON, { now: MON, priorNudgeCount: 2 });
    const s4 = computeFollowupDue(MON, { now: MON, priorNudgeCount: 3 });
    // +8 business days from Mon 06-15 = Thu 06-25.
    expect(s3.dueAt).toBe(Date.UTC(2026, 5, 25, 9, 0, 0));
    expect(s3.stage).toBe(3);
    expect(s4.dueAt).toBe(s3.dueAt); // clamps to the last rung
    expect(s4.stage).toBe(4);
  });

  it("honours a custom backoff override and falls back when empty (R1.8)", () => {
    const one = computeFollowupDue(MON, { now: MON, priorNudgeCount: 0, backoffBusinessDays: [1] });
    expect(one.dueAt).toBe(Date.UTC(2026, 5, 16, 9, 0, 0)); // +1 business day = Tue
    const fallback = computeFollowupDue(MON, { now: MON, backoffBusinessDays: [] });
    expect(fallback.dueAt).toBe(THU); // empty -> default ladder
  });
});

describe("computeFollowupDue — never weekend (R1.5)", () => {
  it("dueAt is never a Saturday or Sunday, swept across 14 start days", () => {
    for (let i = 0; i < 14; i++) {
      const start = Date.UTC(2026, 5, 1 + i, 9, 0, 0);
      const f = computeFollowupDue(start, { now: start });
      const dow = new Date(f.dueAt!).getUTCDay();
      expect(dow, `start day ${i}`).not.toBe(0);
      expect(dow).not.toBe(6);
    }
  });
});

describe("computeFollowupDue — overdue vs upcoming (R1.6)", () => {
  it("now before dueAt -> not overdue, daysUntilDue = calendar days to the due date", () => {
    const f = computeFollowupDue(MON, { now: Date.UTC(2026, 5, 16, 9, 0, 0) }); // Tue
    expect(f.overdue).toBe(false);
    expect(f.daysUntilDue).toBe(2); // Tue -> Thu
    expect(f.businessDaysOverdue).toBe(0);
  });

  it("now on the due date but earlier in the day -> due today (0), not overdue", () => {
    const f = computeFollowupDue(MON, { now: Date.UTC(2026, 5, 18, 8, 0, 0) }); // Thu 08:00 < dueAt 09:00
    expect(f.overdue).toBe(false);
    expect(f.daysUntilDue).toBe(0);
  });

  it("now at/after dueAt -> overdue with whole business days overdue", () => {
    const f = computeFollowupDue(MON, { now: Date.UTC(2026, 5, 25, 9, 0, 0) }); // Thu next week
    expect(f.overdue).toBe(true);
    expect(f.daysUntilDue).toBe(0);
    expect(f.businessDaysOverdue).toBe(5); // Thu 06-18 -> Thu 06-25 = 5 business days
  });

  it("just-overdue same day -> overdue with 0 business days overdue", () => {
    const f = computeFollowupDue(MON, { now: Date.UTC(2026, 5, 18, 10, 0, 0) }); // Thu 10:00 > 09:00
    expect(f.overdue).toBe(true);
    expect(f.businessDaysOverdue).toBe(0);
  });
});

describe("computeFollowupDue — sentinel + purity (R1.7/R1.9)", () => {
  it("null / NaN / future last-outbound -> non-due sentinel, never throws", () => {
    const sentinel = { dueAt: null, stage: 0, overdue: false, daysUntilDue: 0, businessDaysOverdue: 0 };
    expect(computeFollowupDue(null, { now: MON })).toEqual(sentinel);
    expect(computeFollowupDue(Number.NaN, { now: MON })).toEqual(sentinel);
    expect(computeFollowupDue(MON + 86_400_000, { now: MON })).toEqual(sentinel); // future
  });

  it("is deterministic: identical inputs deep-equal twice", () => {
    const a = computeFollowupDue(MON, { now: Date.UTC(2026, 5, 25, 9, 0, 0), priorNudgeCount: 1 });
    const b = computeFollowupDue(MON, { now: Date.UTC(2026, 5, 25, 9, 0, 0), priorNudgeCount: 1 });
    expect(a).toEqual(b);
  });
});

describe("businessDaysBetween", () => {
  it("excludes weekends and is 0 when b <= a", () => {
    expect(businessDaysBetween(THU, THU)).toBe(0);
    expect(businessDaysBetween(NEXT_MON, MON)).toBe(0); // reversed
    // Thu 06-18 -> Mon 06-22 spans Fri + Mon = 2 business days (weekend excluded).
    expect(businessDaysBetween(THU, NEXT_MON)).toBe(2);
  });
});

describe("followupLabel (B1.2)", () => {
  it("null dueAt -> null", () => {
    expect(followupLabel(computeFollowupDue(null, { now: MON }))).toBeNull();
  });

  it("upcoming -> 'Follow up in {x}d'", () => {
    expect(followupLabel(computeFollowupDue(MON, { now: Date.UTC(2026, 5, 16, 9, 0, 0) }))).toBe("Follow up in 2d");
  });

  it("due today -> 'Follow up due today'", () => {
    expect(followupLabel(computeFollowupDue(MON, { now: Date.UTC(2026, 5, 18, 8, 0, 0) }))).toBe("Follow up due today");
  });

  it("overdue by N -> 'Follow up overdue · {n}d'; same-day overdue -> 'Follow up overdue'", () => {
    expect(followupLabel(computeFollowupDue(MON, { now: Date.UTC(2026, 5, 25, 9, 0, 0) }))).toBe("Follow up overdue · 5d");
    expect(followupLabel(computeFollowupDue(MON, { now: Date.UTC(2026, 5, 18, 10, 0, 0) }))).toBe("Follow up overdue");
  });
});
