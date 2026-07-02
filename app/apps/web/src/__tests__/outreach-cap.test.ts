import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * INV-1 (outreach-autopilot T1) — the tenant daily outreach cap primitive.
 * Pins: the cap is the compiled constant 100; the day key follows the TENANT's
 * timezone (falls back to UTC, never throws); the slot is granted by the
 * conditional UPDATE's RETURNING (no read-then-write); exhaustion reports the
 * current count; a store failure propagates (the gate fails closed on throw).
 */

const state = vi.hoisted(() => ({
  updateReturns: [] as Array<{ sentCount: number }>,
  selectCount: null as number | null,
  inserted: [] as Array<Record<string, unknown>>,
  throwOnUpdate: false,
}));

vi.mock("@/db/schema", () => ({
  tenantSendCounters: { tenantId: "tenant_id", day: "day", sentCount: "sent_count" },
}));
vi.mock("drizzle-orm", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  and: (...args: any[]) => ({ op: "and", args }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eq: (col: any, val: any) => ({ op: "eq", col, val }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lt: (col: any, val: any) => ({ op: "lt", col, val }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql: (strings: any, ...vals: any[]) => ({ op: "sql", strings, vals }),
}));
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: (v: Record<string, unknown>) => ({
        onConflictDoNothing: async () => {
          state.inserted.push(v);
        },
      }),
    })),
    update: vi.fn(() => ({
      set: () => ({
        where: () => ({
          returning: async () => {
            if (state.throwOnUpdate) throw new Error("counter store boom");
            return state.updateReturns;
          },
        }),
      }),
    })),
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () =>
            state.selectCount === null ? [] : [{ sentCount: state.selectCount }],
        }),
      }),
    })),
  },
}));

import {
  OUTREACH_DAILY_TENANT_CAP,
  tenantDayKey,
  consumeOutreachCapSlot,
  getOutreachCapCount,
} from "@/lib/guardrails/outreach-cap";

beforeEach(() => {
  state.updateReturns = [];
  state.selectCount = null;
  state.inserted = [];
  state.throwOnUpdate = false;
});

describe("OUTREACH_DAILY_TENANT_CAP", () => {
  it("is the compiled constant 100 — the invariant, not a config", () => {
    expect(OUTREACH_DAILY_TENANT_CAP).toBe(100);
  });
});

describe("tenantDayKey — the reset boundary is the tenant's midnight", () => {
  const lateUtc = new Date("2026-07-02T23:30:00Z"); // 01:30 on the 3rd in Paris (UTC+2)

  it("same instant, different tenant days: UTC vs Europe/Paris", () => {
    expect(tenantDayKey("UTC", lateUtc)).toBe("2026-07-02");
    expect(tenantDayKey("Europe/Paris", lateUtc)).toBe("2026-07-03");
  });

  it("missing timezone falls back to UTC", () => {
    expect(tenantDayKey(null, lateUtc)).toBe("2026-07-02");
    expect(tenantDayKey(undefined, lateUtc)).toBe("2026-07-02");
  });

  it("an invalid timezone never throws — falls back to UTC", () => {
    expect(tenantDayKey("Not/AZone", lateUtc)).toBe("2026-07-02");
  });
});

describe("consumeOutreachCapSlot — atomic conditional grant", () => {
  it("grants when the conditional UPDATE returns a row, after seeding the counter", async () => {
    state.updateReturns = [{ sentCount: 7 }];
    const r = await consumeOutreachCapSlot("t1", "2026-07-02");
    expect(r).toEqual({ granted: true, sentCount: 7 });
    // The counter row is seeded first (idempotent) so day one works.
    expect(state.inserted).toEqual([{ tenantId: "t1", day: "2026-07-02", sentCount: 0 }]);
  });

  it("refuses when the UPDATE matches nothing (cap reached) and reports the count", async () => {
    state.updateReturns = [];
    state.selectCount = 100;
    const r = await consumeOutreachCapSlot("t1", "2026-07-02");
    expect(r).toEqual({ granted: false, sentCount: 100 });
  });

  it("propagates a store failure — the sending gate fails CLOSED on throw", async () => {
    state.throwOnUpdate = true;
    await expect(consumeOutreachCapSlot("t1", "2026-07-02")).rejects.toThrow("counter store boom");
  });
});

describe("getOutreachCapCount", () => {
  it("returns 0 when no counter row exists yet", async () => {
    state.selectCount = null;
    expect(await getOutreachCapCount("t1", "2026-07-02")).toBe(0);
  });
  it("returns the stored count", async () => {
    state.selectCount = 42;
    expect(await getOutreachCapCount("t1", "2026-07-02")).toBe(42);
  });
});
