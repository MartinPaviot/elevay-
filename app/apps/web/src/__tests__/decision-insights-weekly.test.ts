import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * T9 (outreach-autopilot) — the decision-insights-weekly cron, boundary
 * mocks only (@/db routed on projection keys like the T8 backfill test;
 * traced-ai, ai-provider and the deliverability guard mocked; the REAL
 * @/db/schema, drizzle-orm, aggregate module and rejection classifier run).
 *
 * Covers the Done criteria end to end:
 *  - 30-decision tenant -> >= 1 published pattern with correct n/lift + 1
 *    anti_pattern from founder rejection reasons (system rows excluded);
 *  - guard-tripped tenant -> the positive-lift pattern is INVALIDATED
 *    (M12-R5) while negative-lift and anti_pattern rows stay published;
 *  - 5-decision tenant -> exactly ONE quantified cold_start row, no LLM;
 *  - LLM throw -> the deterministic template summaries still publish;
 *  - idempotent re-run: delete-then-insert per (tenant, week_of).
 */

let tenantRows: Array<{ id: string }> = [];
/** Consumed one per decisions-select call (per tenant). */
let decisionResults: Array<{ rows?: unknown[]; reject?: boolean }> = [];
let rejectionRows: Array<{ reviewReason: string | null; reviewedBy: string | null }> = [];
const ops: Array<{ type: "delete" | "insert"; rows?: Record<string, unknown>[] }> = [];

vi.mock("@/db", () => ({
  db: {
    select: (proj?: Record<string, unknown>) => {
      const keys = proj ? Object.keys(proj) : [];
      if (keys.includes("persona")) {
        const next = decisionResults.shift() ?? { rows: [] };
        return {
          from: () => ({
            innerJoin: () => ({
              where: () =>
                next.reject
                  ? Promise.reject(new Error("decision select down"))
                  : Promise.resolve(next.rows ?? []),
            }),
          }),
        };
      }
      if (keys.includes("reviewReason")) {
        return { from: () => ({ where: () => Promise.resolve(rejectionRows) }) };
      }
      // The tenant fan-out projects only { id }.
      return { from: () => Promise.resolve(tenantRows) };
    },
    delete: () => ({
      where: () => {
        ops.push({ type: "delete" });
        return Promise.resolve(undefined);
      },
    }),
    insert: () => ({
      values: (vals: Record<string, unknown> | Record<string, unknown>[]) => {
        ops.push({ type: "insert", rows: Array.isArray(vals) ? vals : [vals] });
        return Promise.resolve(undefined);
      },
    }),
  },
}));

vi.mock("@/inngest/client", () => ({
  inngest: {
    createFunction: (config: unknown, handler: unknown) => ({ config, handler }),
    send: vi.fn(),
  },
}));

const { tracedGenerateObjectMock, guardTrippedMock } = vi.hoisted(() => ({
  tracedGenerateObjectMock: vi.fn(),
  guardTrippedMock: vi.fn(),
}));
vi.mock("@/lib/ai/traced-ai", () => ({ tracedGenerateObject: tracedGenerateObjectMock }));
vi.mock("@/lib/ai/ai-provider", () => ({ anthropic: (id: string) => ({ modelId: id }) }));
vi.mock("@/lib/deliverability/db-guard", () => ({ guardTrippedForTenant: guardTrippedMock }));

import {
  decisionInsightsWeekly,
  mondayOfWeekUtc,
} from "@/inngest/decision-insights-weekly";

const CTO_FUNDING = {
  seniority: "senior",
  function: "CTO",
  company_size: "51-200",
  sector: "SaaS",
  maturity: null,
};
const OPS_NONE = {
  seniority: "mid",
  function: "Head of Ops",
  company_size: "11-50",
  sector: "Logistics",
  maturity: null,
};
const CEO_HIRING = {
  seniority: "exec",
  function: "CEO",
  company_size: "1-10",
  sector: "Fintech",
  maturity: null,
};

const dec = (persona: Record<string, unknown>, signalType: string | null, positivity: number) => ({
  persona,
  signal: signalType ? { type: signalType, detected_at: "2026-06-01", source: "test", freshness_days: 3 } : null,
  positivity,
});

/** The Done-criteria dataset: bucket A 12@0.9, B 9@0.1, C 9@0.5 ->
 *  baseline 0.54, only A publishes (n=12, lift +0.36). */
const thirtyDecisions = () => [
  ...Array.from({ length: 12 }, () => dec(CTO_FUNDING, "funding", 0.9)),
  ...Array.from({ length: 9 }, () => dec(OPS_NONE, null, 0.1)),
  ...Array.from({ length: 9 }, () => dec(CEO_HIRING, "hiring", 0.5)),
];

/** Founder rejected 3x for tone + one SYSTEM row that must never count. */
const toneRejections = () => [
  { reviewReason: "tone way too aggressive for a first touch", reviewedBy: "user-1" },
  { reviewReason: "too pushy, please soften", reviewedBy: "user-1" },
  { reviewReason: "harsh tone again", reviewedBy: "user-1" },
  { reviewReason: "Expired after 72h pending, tone irrelevant", reviewedBy: "system" },
];

const runCron = () =>
  (decisionInsightsWeekly as unknown as {
    handler: (ctx: { step: { run: (id: string, fn: () => unknown) => unknown } }) => Promise<Record<string, unknown>>;
  }).handler({ step: { run: (_id, fn) => fn() } });

const insertedRows = () => ops.filter((o) => o.type === "insert").flatMap((o) => o.rows ?? []);

beforeEach(() => {
  tenantRows = [{ id: "t1" }];
  decisionResults = [];
  rejectionRows = [];
  ops.length = 0;
  tracedGenerateObjectMock.mockReset();
  tracedGenerateObjectMock.mockResolvedValue({ object: { summaries: [] } });
  guardTrippedMock.mockReset();
  guardTrippedMock.mockResolvedValue(false);
});

describe("registration", () => {
  it("registers as decision-insights-weekly, Monday 06:00 UTC, retries 1, concurrency 1", () => {
    const config = (decisionInsightsWeekly as unknown as { config: Record<string, unknown> }).config;
    expect(config.id).toBe("decision-insights-weekly");
    expect(config.triggers).toEqual([{ cron: "0 6 * * 1" }]);
    expect(config.retries).toBe(1);
    expect(config.concurrency).toEqual([{ limit: 1 }]);
    expect(typeof config.onFailure).toBe("function");
  });
});

describe("mondayOfWeekUtc", () => {
  it("maps any weekday to its UTC Monday (batch key stable across a replay)", () => {
    expect(mondayOfWeekUtc(new Date("2026-07-02T10:00:00Z"))).toBe("2026-06-29"); // Thursday
    expect(mondayOfWeekUtc(new Date("2026-06-29T06:00:00Z"))).toBe("2026-06-29"); // Monday itself
    expect(mondayOfWeekUtc(new Date("2026-07-05T23:59:00Z"))).toBe("2026-06-29"); // Sunday
  });
});

describe("the 30-decision tenant (Done criteria)", () => {
  it("publishes 1 pattern with correct n/lift/baseline + 1 anti_pattern from founder rejections", async () => {
    decisionResults = [{ rows: thirtyDecisions() }];
    rejectionRows = toneRejections();

    const res = await runCron();
    expect(res.published).toBe(2);
    expect(res.invalidated).toBe(0);
    expect(res.coldStarts).toBe(0);

    const rows = insertedRows();
    expect(rows).toHaveLength(2);

    const pattern = rows.find((r) => r.kind === "pattern")!;
    expect(pattern.n).toBe(12);
    expect(pattern.lift as number).toBeCloseTo(0.36, 10);
    expect(pattern.positivityAvg as number).toBeCloseTo(0.9, 10);
    expect(pattern.baseline as number).toBeCloseTo(0.54, 10);
    expect(pattern.status).toBe("published");
    expect(pattern.pattern).toEqual({
      seniority: "senior",
      function: "CTO",
      company_size: "51-200",
      sector: "SaaS",
      signal_type: "funding",
    });

    const anti = rows.find((r) => r.kind === "anti_pattern")!;
    // n=3, NOT 4: the reviewedBy='system' expiry row is not founder feedback.
    expect(anti.n).toBe(3);
    expect(anti.pattern).toEqual({ rejection_category: "tone" });
    expect(anti.lift).toBeNull();
    expect(anti.status).toBe("published");
    expect(String(anti.summary)).toContain("tone");
  });

  it("applies the Sonnet rephrasing when the numbers survive the rewrite", async () => {
    decisionResults = [{ rows: thirtyDecisions() }];
    tracedGenerateObjectMock.mockResolvedValue({
      // Digit-preserving rewrite: n=12 and lift +0.36 survive verbatim.
      object: { summaries: [{ index: 0, summary: "REPHRASED: 12 sends to this segment lifted positivity by +0.36." }] },
    });

    await runCron();

    const rows = insertedRows();
    expect(String(rows[0].summary)).toContain("REPHRASED");
    // The traced call carries the synthesizer identity + tenant (budget
    // guard + kill-switch live inside the traced wrapper) and caps output.
    const call = tracedGenerateObjectMock.mock.calls[0][0];
    expect(call._trace).toMatchObject({
      agentId: "decision-insights-synthesizer",
      tenantId: "t1",
    });
    expect(call.maxOutputTokens).toBe(2048);
  });

  it("a rephrase that DROPS the load-bearing digits is discarded (template stands)", async () => {
    decisionResults = [{ rows: thirtyDecisions() }];
    tracedGenerateObjectMock.mockResolvedValue({
      // Hallucination shape: fluent sentence, numbers gone.
      object: { summaries: [{ index: 0, summary: "This segment performs well, prefer it." }] },
    });

    await runCron();

    const rows = insertedRows();
    expect(String(rows[0].summary)).toContain("n=12");
    expect(String(rows[0].summary)).toContain("+0.36");
    expect(String(rows[0].summary)).not.toContain("performs well");
  });

  it("LLM throw -> the deterministic template summaries still publish (numbers intact)", async () => {
    decisionResults = [{ rows: thirtyDecisions() }];
    rejectionRows = toneRejections();
    tracedGenerateObjectMock.mockRejectedValue(new Error("AI_DISABLED"));

    const res = await runCron();
    expect(res.published).toBe(2);

    const rows = insertedRows();
    const pattern = rows.find((r) => r.kind === "pattern")!;
    expect(String(pattern.summary)).toContain("n=12");
    expect(String(pattern.summary)).toContain("+0.36");
    expect(String(pattern.summary)).toContain("0.54");
    const anti = rows.find((r) => r.kind === "anti_pattern")!;
    expect(String(anti.summary)).toContain("rejected 3 drafts");
  });
});

describe("M12-R5 — deliverability cross-check at publication", () => {
  // 20@0.9 + 10@0.1: baseline 19/30; BOTH buckets pass the floors ->
  // positive-lift (n=20) and negative-lift (n=10) patterns.
  const posAndNeg = () => [
    ...Array.from({ length: 20 }, () => dec(CTO_FUNDING, "funding", 0.9)),
    ...Array.from({ length: 10 }, () => dec(OPS_NONE, null, 0.1)),
  ];

  it("guard tripped -> positive-lift pattern INVALIDATED; negative-lift + anti_pattern stay published", async () => {
    decisionResults = [{ rows: posAndNeg() }];
    rejectionRows = toneRejections();
    guardTrippedMock.mockResolvedValue(true);

    const res = await runCron();
    expect(guardTrippedMock).toHaveBeenCalledWith("t1");
    expect(res.invalidated).toBe(1);
    expect(res.published).toBe(2);

    const rows = insertedRows();
    const positive = rows.find((r) => r.kind === "pattern" && (r.lift as number) > 0)!;
    expect(positive.status).toBe("invalidated");
    expect(positive.invalidatedReason).toBe("deliverability_guard_tripped");

    const negative = rows.find((r) => r.kind === "pattern" && (r.lift as number) < 0)!;
    expect(negative.status).toBe("published");
    expect(negative.invalidatedReason).toBeNull();

    const anti = rows.find((r) => r.kind === "anti_pattern")!;
    expect(anti.status).toBe("published");
  });

  it("guard NOT tripped -> the positive-lift pattern publishes normally", async () => {
    decisionResults = [{ rows: posAndNeg() }];

    const res = await runCron();
    expect(res.invalidated).toBe(0);
    const rows = insertedRows();
    expect(rows.filter((r) => r.status === "published")).toHaveLength(rows.length);
  });

  it("a guard evaluation failure fails soft to published (prompts only steer; sends keep their own gates)", async () => {
    decisionResults = [{ rows: posAndNeg() }];
    guardTrippedMock.mockRejectedValue(new Error("guard db down"));

    const res = await runCron();
    expect(res.invalidated).toBe(0);
    expect(res.failures).toBe(0);
  });
});

describe("cold start (under 10 decisions)", () => {
  it("writes exactly ONE quantified cold_start row, no patterns, no LLM, no guard call", async () => {
    decisionResults = [
      { rows: Array.from({ length: 5 }, () => dec(CTO_FUNDING, "funding", 0.9)) },
    ];
    // Even with actionable rejections on file, cold start holds everything.
    rejectionRows = toneRejections();

    const res = await runCron();
    expect(res.coldStarts).toBe(1);
    expect(res.published).toBe(1);

    const rows = insertedRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("cold_start");
    expect(rows[0].n).toBe(5);
    expect(rows[0].pattern).toBeNull();
    expect(rows[0].lift).toBeNull();
    // The quantified state: how far from the minimum.
    expect(String(rows[0].summary)).toMatch(/5 of 10/);
    expect(tracedGenerateObjectMock).not.toHaveBeenCalled();
    expect(guardTrippedMock).not.toHaveBeenCalled();
  });
});

describe("idempotency + fan-out fault isolation", () => {
  it("deletes the (tenant, week_of) batch BEFORE inserting, on every run", async () => {
    decisionResults = [{ rows: thirtyDecisions() }];
    await runCron();

    const deleteIdx = ops.findIndex((o) => o.type === "delete");
    const insertIdx = ops.findIndex((o) => o.type === "insert");
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(insertIdx).toBeGreaterThan(deleteIdx);
    expect(ops.filter((o) => o.type === "delete")).toHaveLength(1);

    // Re-run: the batch is replaced (a second delete precedes the second
    // insert) instead of accumulating duplicate weekly rows.
    decisionResults = [{ rows: thirtyDecisions() }];
    await runCron();
    expect(ops.filter((o) => o.type === "delete")).toHaveLength(2);
    expect(ops.filter((o) => o.type === "insert")).toHaveLength(2);
  });

  it("one tenant's failure never blocks the rest of the fan-out", async () => {
    tenantRows = [{ id: "t-broken" }, { id: "t-ok" }];
    decisionResults = [
      { reject: true },
      { rows: Array.from({ length: 5 }, () => dec(CTO_FUNDING, "funding", 0.9)) },
    ];

    const res = await runCron();
    expect(res.failures).toBe(1);
    expect(res.coldStarts).toBe(1);
    // t-ok's cold-start row still landed.
    expect(insertedRows()).toHaveLength(1);
  });

  it("a tenant with >= 10 decisions but no publishable bucket writes nothing (no filler rows)", async () => {
    // 12 decisions all in ONE bucket: lift = 0 -> below the floor.
    decisionResults = [
      { rows: Array.from({ length: 12 }, () => dec(CTO_FUNDING, "funding", 0.7)) },
    ];

    const res = await runCron();
    expect(res.published).toBe(0);
    expect(res.coldStarts).toBe(0);
    expect(insertedRows()).toHaveLength(0);
    expect(tracedGenerateObjectMock).not.toHaveBeenCalled();
  });
});
