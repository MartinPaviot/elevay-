import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * M13-G1 (T5) — loadG1Context: batched fresh-signal + ICP-fit facts.
 * Pins: icpScoringActive from the EXISTS probe; freshness uses the SAME TTL
 * rule as the scorer (real filterFreshSignals); unknown/null company = zero
 * signals (fail-closed); malformed signal entries never throw.
 */

const state = vi.hoisted(() => ({
  scoredExists: false,
  companyRows: [] as Array<{ id: string; score: number | null; properties: unknown }>,
}));

vi.mock("@/db/schema", () => ({
  companies: { id: "id", tenantId: "tenant_id", score: "score", properties: "properties" },
}));
vi.mock("drizzle-orm", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  and: (...args: any[]) => ({ op: "and", args }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eq: (col: any, val: any) => ({ op: "eq", col, val }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inArray: (col: any, val: any) => ({ op: "inArray", col, val }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isNotNull: (col: any) => ({ op: "isNotNull", col }),
}));
vi.mock("@/db", () => ({
  db: {
    // Two query shapes: the EXISTS probe chains .limit(); the batch resolves
    // at .where() (thenable) — disambiguated by providing both.
    select: vi.fn(() => ({
      from: () => ({
        where: Object.assign(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (..._a: any[]) => {
            const rows = state.companyRows;
            return Object.assign(Promise.resolve(rows), {
              limit: async () => (state.scoredExists ? [{ id: "any" }] : []),
            });
          },
        ),
      }),
    })),
  },
}));

import { loadG1Context } from "@/lib/sequences/eligibility-context";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

beforeEach(() => {
  state.scoredExists = false;
  state.companyRows = [];
});

describe("loadG1Context", () => {
  it("counts only FRESH signals (same TTL rule as the scorer)", async () => {
    state.companyRows = [
      {
        id: "co1",
        score: 70,
        properties: {
          signals: [
            { type: "funding", detectedAt: daysAgo(10) }, // fresh (TTL 180j)
            { type: "email_clicked", detectedAt: daysAgo(30) }, // expired (TTL 7j)
            { type: null }, // malformed — must not throw
          ],
        },
      },
    ];
    const ctx = await loadG1Context("t1", ["co1"]);
    expect(ctx.forCompany("co1").freshSignalCount).toBe(1);
    expect(ctx.forCompany("co1").icpScore).toBe(70);
  });

  it("icpScoringActive reflects the tenant EXISTS probe", async () => {
    state.scoredExists = true;
    state.companyRows = [{ id: "co1", score: null, properties: {} }];
    const ctx = await loadG1Context("t1", ["co1"]);
    expect(ctx.forCompany("co1").icpScoringActive).toBe(true);
  });

  it("null or unknown company = ZERO fresh signals (fail-closed)", async () => {
    const ctx = await loadG1Context("t1", []);
    expect(ctx.forCompany(null).freshSignalCount).toBe(0);
    expect(ctx.forCompany("ghost").freshSignalCount).toBe(0);
  });

  it("no signals array at all -> zero, never a throw", async () => {
    state.companyRows = [{ id: "co1", score: 50, properties: null }];
    const ctx = await loadG1Context("t1", ["co1"]);
    expect(ctx.forCompany("co1").freshSignalCount).toBe(0);
  });
});
