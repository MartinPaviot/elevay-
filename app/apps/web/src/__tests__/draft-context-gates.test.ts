import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * T11c (M13-R7) — the draft context route surfaces the gate verdicts +
 * composite quality score for the review panel. Pins: gate_decisions is
 * reduced to the LAST verdict per gate (a reworked draft supersedes its
 * earlier one), qualityScore rides the draft payload, and a draft with no
 * verdicts returns an empty gateScores map (never throws).
 *
 * Call-ordered db mock: each db.select() pops the next result set. With a
 * null-company contact the branch order is draft -> contact -> activities
 * -> gates (company/deal skipped).
 */

let selectQueue: unknown[][] = [];

vi.mock("@/lib/auth/auth-utils", () => ({
  getAuthContext: vi.fn(async () => ({ tenantId: "t1", userId: "u1", appUserId: "au1" })),
}));
vi.mock("@/db", () => ({
  db: {
    select: () => {
      const rows = selectQueue.shift() ?? [];
      const chain = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => Promise.resolve(rows),
        then: (res: (v: unknown) => void) => res(rows),
      };
      return chain;
    },
  },
}));
vi.mock("@/db/schema", () => ({
  sequenceDrafts: {},
  contacts: {},
  companies: {},
  deals: {},
  activities: {},
  gateDecisions: { gate: "gate", score: "score", verdict: "verdict", reasons: "reasons", createdAt: "created", tenantId: "tenant", subjectType: "st", subjectId: "sid" },
}));
vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ op: "and", a }),
  asc: (c: unknown) => ({ op: "asc", c }),
  desc: (c: unknown) => ({ op: "desc", c }),
  eq: (c: unknown, v: unknown) => ({ op: "eq", c, v }),
  isNull: (c: unknown) => ({ op: "isNull", c }),
}));

import { GET } from "@/app/api/sequences/drafts/[id]/context/route";

const call = () =>
  GET(new Request("http://x/api/sequences/drafts/d1/context"), {
    params: Promise.resolve({ id: "d1" }),
  });

const draft = (over: Record<string, unknown> = {}) => ({
  id: "d1",
  tenantId: "t1",
  status: "pending_approval",
  triggerReason: "post_funding_signal",
  contactId: "c1",
  generatedAt: new Date("2026-07-01T10:00:00Z"),
  spamScore: null,
  spamSeverity: null,
  spamWarnings: [],
  qualityScore: 0.82,
  personalizationSources: [],
  ...over,
});

const contactNoCompany = { id: "c1", companyId: null, firstName: "Ada", lastName: "L", email: "a@x.co", title: "CTO", score: 70 };

beforeEach(() => {
  selectQueue = [];
});

describe("GET draft context — gate scores (T11c)", () => {
  it("reduces gate_decisions to the LAST verdict per gate + surfaces qualityScore", async () => {
    selectQueue = [
      [draft()], // draft
      [contactNoCompany], // contact (no company -> skip company/deal)
      [], // recent activities
      [
        // gate rows ASC by createdAt — the later g2 supersedes the earlier.
        { gate: 4, score: 0.9, verdict: "pass", reasons: {} },
        { gate: 2, score: null, verdict: "blocked", reasons: { ungrounded: ["700k users"] } },
        { gate: 2, score: null, verdict: "reworked", reasons: { ungrounded: ["n8n", "supabase"] } },
      ],
    ];
    const res = await call();
    const body = await res.json();

    expect(body.draft.qualityScore).toBe(0.82);
    // T11c follow-up — the shape gained `reason` (null on a pass verdict).
    expect(body.gateScores.g4).toEqual({ score: 0.9, verdict: "pass", reason: null });
    // last g2 wins AND its reason is surfaced from the reasons jsonb.
    expect(body.gateScores.g2).toEqual({
      score: null,
      verdict: "reworked",
      reason: "Unverifiable: n8n, supabase",
    });
  });

  it("a draft with no verdicts returns an empty gateScores map (no throw)", async () => {
    selectQueue = [[draft({ qualityScore: null })], [contactNoCompany], [], []];
    const res = await call();
    const body = await res.json();
    expect(body.gateScores).toEqual({});
    expect(body.draft.qualityScore).toBeNull();
  });

  it("still 404s a missing draft before touching gates", async () => {
    selectQueue = [[]]; // draft lookup empty
    const res = await call();
    expect(res.status).toBe(404);
  });
});
