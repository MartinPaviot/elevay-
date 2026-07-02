/**
 * GET /api/reports/outreach-learning (outreach-autopilot T11) — the
 * outcomes-first Reports aggregate. Call-ordered db mock: the route runs
 * exactly four selects in this order — outcomes (groupBy outcomeType),
 * sends (count outreach_decisions), gates (groupBy gate+rubric+path),
 * decisions (join outreach_decisions -> action_outcomes).
 *
 * The load-bearing assertion: gate rows GROUP BY (gate, rubricVersion,
 * reasons.path) NOT gate alone. Both G2 producers write (gate 2, g2.det.v1);
 * only reasons.path distinguishes copy_engine from sequence_step_v2. A naive
 * GROUP BY gate would collapse them into one rate. The mock returns the two
 * path-distinct groups postgres would; the route must surface BOTH.
 *
 * computeInsights is the REAL pure aggregator (no mock) so the decisions
 * n/lift math is exercised end to end.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/auth-utils", () => ({
  getAuthContext: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: { select: vi.fn() },
}));

// Distinct sentinel per column so the tenant-scope assertion can prove which
// table's tenant_id filter fired. The mocked db/drizzle ignore the values.
vi.mock("@/db/schema", () => ({
  actionOutcomes: {
    id: "actionOutcomes.id",
    tenantId: "actionOutcomes.tenantId",
    status: "actionOutcomes.status",
    outcomeType: "actionOutcomes.outcomeType",
    positivity: "actionOutcomes.positivity",
    resolvedAt: "actionOutcomes.resolvedAt",
  },
  outreachDecisions: {
    tenantId: "outreachDecisions.tenantId",
    persona: "outreachDecisions.persona",
    signal: "outreachDecisions.signal",
    outcomeId: "outreachDecisions.outcomeId",
    createdAt: "outreachDecisions.createdAt",
  },
  gateDecisions: {
    tenantId: "gateDecisions.tenantId",
    gate: "gateDecisions.gate",
    rubricVersion: "gateDecisions.rubricVersion",
    verdict: "gateDecisions.verdict",
    reasons: "gateDecisions.reasons",
    createdAt: "gateDecisions.createdAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  gte: vi.fn((a: unknown, b: unknown) => ({ gte: [a, b] })),
  // Usable as a template tag: sql`...` -> sql(strings, ...values).
  sql: vi.fn(() => "sql-frag"),
}));

import { getAuthContext } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { eq } from "drizzle-orm";

const mod = await import("@/app/api/reports/outreach-learning/route");

const AUTH = { userId: "auth-1", tenantId: "t1", appUserId: "u1", role: "member" as const };

function req(url = "http://localhost/api/reports/outreach-learning") {
  return new Request(url);
}

// ── Call-ordered select builders (one db.select() each, in route order) ──
function mockGroupBy(rows: unknown[]) {
  const groupBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ groupBy });
  const from = vi.fn().mockReturnValue({ where });
  vi.mocked(db.select).mockReturnValueOnce({ from } as never);
}
function mockWhere(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const from = vi.fn().mockReturnValue({ where });
  vi.mocked(db.select).mockReturnValueOnce({ from } as never);
}
function mockJoinWhere(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const innerJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ innerJoin });
  vi.mocked(db.select).mockReturnValueOnce({ from } as never);
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/reports/outreach-learning", () => {
  it("401 when unauthenticated", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null);
    const res = await mod.GET(req());
    expect(res.status).toBe(401);
  });

  it("groups G2 by (gate, rubricVersion, reasons.path) — two path-distinct rows, not one conflated rate", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(AUTH);

    // 1. outcomes by type
    mockGroupBy([
      { outcomeType: "meeting_held", n: 3 },
      { outcomeType: "meeting_booked", n: 5 },
      { outcomeType: "replied_positive", n: 7 },
      { outcomeType: "deal_advanced", n: 2 },
      { outcomeType: "no_response", n: 40 }, // present but not surfaced as a headline
    ]);
    // 2. sends (outreach_decisions count)
    mockWhere([{ sends: 42 }]);
    // 3. gates — the two G2 producers share (gate 2, g2.det.v1); path splits them
    mockGroupBy([
      { gate: 2, rubricVersion: "g2.det.v1", path: "copy_engine", n: 10, blocked: 4 },
      { gate: 2, rubricVersion: "g2.det.v1", path: "sequence_step_v2", n: 8, blocked: 2 },
      { gate: 1, rubricVersion: "g1.enrollment.v1", path: null, n: 20, blocked: 5 },
    ]);
    // 4. decisions (join) — two buckets, n>=10, lift vs baseline
    const bucketA = { seniority: "senior", function: "sales" };
    const signalA = { type: "funding" };
    const bucketB = { seniority: "junior", function: "ops" };
    const decisionRows = [
      ...Array.from({ length: 12 }, () => ({ persona: bucketA, signal: signalA, positivity: 0.9 })),
      ...Array.from({ length: 12 }, () => ({ persona: bucketB, signal: null, positivity: 0.1 })),
    ];
    mockJoinWhere(decisionRows);

    const res = await mod.GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();

    // Outcomes-first mapping.
    expect(body.outcomes).toMatchObject({
      meetingsHeld: 3,
      meetingsBooked: 5,
      positiveReplies: 7,
      dealsAdvanced: 2,
      sends: 42,
    });

    // GATE GROUPING: the two g2.det.v1 producers survive as TWO rows.
    const g2 = body.gates.filter(
      (r: { gate: number; rubricVersion: string }) => r.gate === 2 && r.rubricVersion === "g2.det.v1",
    );
    expect(g2).toHaveLength(2);
    const paths = g2.map((r: { path: string }) => r.path).sort();
    expect(paths).toEqual(["copy_engine", "sequence_step_v2"]);

    // Block-rate math per group.
    const copy = g2.find((r: { path: string }) => r.path === "copy_engine");
    const seq = g2.find((r: { path: string }) => r.path === "sequence_step_v2");
    expect(copy.blockRate).toBeCloseTo(0.4); // 4/10
    expect(seq.blockRate).toBeCloseTo(0.25); // 2/8
    const g1 = body.gates.find((r: { gate: number }) => r.gate === 1);
    expect(g1.path).toBeNull();
    expect(g1.blockRate).toBeCloseTo(0.25); // 5/20

    // DECISIONS: real computeInsights over the joined rows.
    expect(body.decisionsSummary.total).toBe(24);
    expect(body.decisionsSummary.baseline).toBeCloseTo(0.5);
    const funding = body.decisions.find((d: { signal: string }) => d.signal === "funding");
    expect(funding.persona).toBe("senior / sales");
    expect(funding.n).toBe(12);
    expect(funding.lift).toBeCloseTo(0.4);
    expect(funding.positivityAvg).toBeCloseTo(0.9);
  });

  it("scopes every aggregate to the caller's tenant (eq(table.tenantId, 't1'))", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(AUTH);
    mockGroupBy([]);
    mockWhere([{ sends: 0 }]);
    mockGroupBy([]);
    mockJoinWhere([]);

    await mod.GET(req());

    const eqCalls = vi.mocked(eq).mock.calls;
    // eq's first param is typed Column/SQLWrapper; the schema mock returns
    // string sentinels for the columns, so compare through unknown.
    const scoped = (col: string) =>
      eqCalls.some((c) => (c[0] as unknown) === col && (c[1] as unknown) === "t1");
    expect(scoped("actionOutcomes.tenantId")).toBe(true);
    expect(scoped("outreachDecisions.tenantId")).toBe(true);
    expect(scoped("gateDecisions.tenantId")).toBe(true);
  });

  it("defaults to a 30-day window and clamps ?days", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(AUTH);
    mockGroupBy([]);
    mockWhere([{ sends: 0 }]);
    mockGroupBy([]);
    mockJoinWhere([]);
    const res = await mod.GET(req());
    const body = await res.json();
    expect(body.window.days).toBe(30);

    // Explicit clamp: 9999 -> 365.
    mockGroupBy([]);
    mockWhere([{ sends: 0 }]);
    mockGroupBy([]);
    mockJoinWhere([]);
    const res2 = await mod.GET(req("http://localhost/api/reports/outreach-learning?days=9999"));
    const body2 = await res2.json();
    expect(body2.window.days).toBe(365);
  });

  it("a sub-threshold tenant returns no decision buckets (honest cold start), still 200", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(AUTH);
    mockGroupBy([]);
    mockWhere([{ sends: 3 }]);
    mockGroupBy([]);
    // 4 resolved decisions — below MIN_PATTERN_N (10) -> no buckets published.
    mockJoinWhere(
      Array.from({ length: 4 }, () => ({
        persona: { seniority: "senior" },
        signal: { type: "funding" },
        positivity: 0.9,
      })),
    );
    const res = await mod.GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decisions).toEqual([]);
    expect(body.decisionsSummary.total).toBe(4);
  });
});
