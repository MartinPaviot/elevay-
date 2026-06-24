import { describe, it, expect } from "vitest";
import {
  buildOptimizerPrompt,
  parseProposals,
  dbRunAgent,
  dbIsAutonomous,
  dbApplyChange,
  dbAudit,
  runWeeklyReviewForTenant,
  type OptimizerContext,
} from "../db-review";
import type { OutboundRollupRow } from "../../rollups/db-rollups";
import type { Metrics } from "../../rollups/rollup";
import type { AuditEntry } from "../review";
import type { Proposal } from "../risk";

// Stub db: loadOptimizerContext does computeCampaignRollups (select->from->leftJoin->where,
// outbound) THEN regressionAlert (select->from->where, no leftJoin). dbAudit inserts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stubDb(opts: { outboundRows?: any[]; alertRows?: any[]; onUpsert?: (v: any) => void } = {}) {
  return {
    select: () => {
      let isOutbound = false;
      const chain: any = {
        from: () => chain,
        leftJoin: () => { isOutbound = true; return chain; },
        where: () => Promise.resolve(isOutbound ? (opts.outboundRows ?? []) : (opts.alertRows ?? [])),
      };
      return chain;
    },
    insert: () => ({ values: (v: any) => ({ onConflictDoUpdate: async () => { opts.onUpsert?.(v); } }) }),
  } as any;
}

const orow = (over: Partial<OutboundRollupRow>): OutboundRollupRow => ({
  id: "o1", campaignId: "c1", sequenceId: null, stepNumber: 1,
  sentAt: new Date(1000), deliveredAt: null, repliedAt: null, replyClassification: null, bouncedAt: null, bounceType: null,
  ...over,
});

const proposalJson = (proposals: unknown[]) => JSON.stringify({ proposals });

const validProposal = (over: Partial<Proposal> = {}): Proposal => ({
  id: "p1", type: "copy_adjust", target: "c1", rationale: "low reply rate", risk: "low",
  citedMetric: { name: "replyRate", value: 0.01, scope: "c1" },
  ...over,
});

describe("buildOptimizerPrompt", () => {
  it("renders campaign rates and active alerts", () => {
    const ctx: OptimizerContext = {
      campaigns: [{ campaignId: "c1", metrics: { sent: 200, replies: 4, replyRate: 0.02, positiveReplies: 1, positiveRate: 0.005, bounceRate: 0.01, spamRate: 0.001 } as Metrics }],
      alerts: [{ scope: "c1", metric: "replyRate", current: 0.01, baseline: 0.03, magnitude: 0.66, route: "weekly" }],
    };
    const prompt = buildOptimizerPrompt(ctx);
    expect(prompt).toContain("c1: sent=200");
    expect(prompt).toContain("Active regression alerts");
    expect(prompt).toContain("c1 replyRate");
  });

  it("notes when there are no campaigns", () => {
    expect(buildOptimizerPrompt({ campaigns: [], alerts: [] })).toContain("no campaigns with sends");
  });
});

describe("parseProposals", () => {
  it("extracts and validates well-formed proposals", () => {
    const out = parseProposals(proposalJson([validProposal()]));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("p1");
  });

  it("drops invalid proposals (bad type / missing fields) and survives non-JSON", () => {
    expect(parseProposals(proposalJson([{ id: "x", type: "nope", target: "c1", rationale: "r", risk: "low" }]))).toHaveLength(0);
    expect(parseProposals("not json at all")).toEqual([]);
    expect(parseProposals(proposalJson([validProposal(), { id: "bad" }]))).toHaveLength(1);
  });
});

describe("dbRunAgent", () => {
  it("returns parsed proposals on a good model response", async () => {
    const res = await dbRunAgent("t1", {
      database: stubDb({ outboundRows: [orow({})] }),
      generate: async () => proposalJson([validProposal()]),
    });
    expect(res.evalPassed).toBe(true);
    expect(res.value?.proposals).toHaveLength(1);
  });

  it("returns a non-result when the model throws (never raises)", async () => {
    const res = await dbRunAgent("t1", {
      database: stubDb({ outboundRows: [orow({})] }),
      generate: async () => { throw new Error("model down"); },
    });
    expect(res.evalPassed).toBe(false);
    expect(res.reason).toMatch(/model down/);
  });
});

describe("observe-only routing deps", () => {
  it("dbIsAutonomous is always false (everything gated)", () => {
    expect(dbIsAutonomous()).toBe(false);
  });

  it("dbApplyChange throws (never auto-applies in v1)", async () => {
    await expect(dbApplyChange(validProposal())).rejects.toThrow(/not implemented/);
  });
});

describe("dbAudit", () => {
  it("upserts a reviewed proposal with its route + decision", async () => {
    const upserts: Array<Record<string, unknown>> = [];
    const entry: AuditEntry = {
      proposal: validProposal(),
      decision: { proposalId: "p1", route: "gated", applied: false, reason: "low risk, but campaign is not autonomous" },
    };
    await dbAudit("t1", "2026-06-22", entry, stubDb({ onUpsert: (v) => upserts.push(v) }));
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ tenantId: "t1", week: "2026-06-22", proposalId: "p1", route: "gated", applied: false });
  });
});

describe("runWeeklyReviewForTenant", () => {
  it("routes every proposal to the gated queue (observe-only) and audits them", async () => {
    const upserts: Array<Record<string, unknown>> = [];
    const db = stubDb({ outboundRows: [orow({})], onUpsert: (v) => upserts.push(v) });
    const result = await runWeeklyReviewForTenant("t1", "2026-06-22", {
      database: db,
      generate: async () => proposalJson([
        validProposal({ id: "p1", risk: "low" }),   // would auto-apply only if autonomous → gated
        validProposal({ id: "p2", risk: "high" }),  // always gated
      ]),
    });
    expect(result.evalPassed).toBe(true);
    expect(result.proposals).toHaveLength(2);
    expect(result.applied).toEqual([]); // nothing applied in observe mode
    expect(result.decisions.every((d) => !d.applied)).toBe(true);
    expect(upserts).toHaveLength(2);
    expect(upserts.every((u) => u.route === "gated")).toBe(true);
  });
});
