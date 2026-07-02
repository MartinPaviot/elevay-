import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import type { ProspectContext } from "@/lib/context/prospect-context";

// buildProspectContext is not injectable — mock it at the module boundary so the
// happy path runs without a DB. The other IO (copyContextForTenant, persist) takes
// an injected stub database.
const ctxState = vi.hoisted(() => ({ ctx: null as unknown }));
vi.mock("@/lib/context/prospect-context", () => ({
  buildProspectContext: vi.fn(async () => ctxState.ctx),
}));

// T6b — capture the G2 verdict rows. FULL module mock (never partial): the
// production code accesses GATE_RUBRICS + recordGateDecision, and a partially
// mocked module throws on any unmocked export access.
const gateState = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>> }));
vi.mock("@/lib/gates/gate-decisions", () => ({
  GATE_RUBRICS: {
    g1: "g1.enrollment.v1",
    g2Deterministic: "g2.det.v1",
    g4Step: "g4.step.v1",
    g4Sequence: "g4.sequence.v1",
    g5Transport: "g5.transport.v1",
  },
  recordGateDecision: vi.fn(async (row: Record<string, unknown>) => {
    gateState.calls.push(row);
    return 1;
  }),
  recordGateDecisions: vi.fn(async (rows: Array<Record<string, unknown>>) => {
    gateState.calls.push(...rows);
    return rows.length;
  }),
  g1DecisionRow: vi.fn(() => null),
}));

import { copyAssetBlock } from "@/db/schema";
import { buildAgentPrompt, personalizationRunAgent, generateShadowCopy, generateCopyMessage, isCopyEnginePrimaryEnabled } from "../db-shadow";
import type { PersonalizationAgentInput } from "../generate-message";

const ORIG = process.env.COPY_ENGINE_SHADOW;
const ORIG_PRIMARY = process.env.COPY_ENGINE_PRIMARY;
afterEach(() => {
  if (ORIG === undefined) delete process.env.COPY_ENGINE_SHADOW;
  else process.env.COPY_ENGINE_SHADOW = ORIG;
  if (ORIG_PRIMARY === undefined) delete process.env.COPY_ENGINE_PRIMARY;
  else process.env.COPY_ENGINE_PRIMARY = ORIG_PRIMARY;
});
beforeEach(() => {
  gateState.calls.length = 0;
});

// Grounds on a PROVIDER-VERIFIED fact (funding) — synthesized public content is
// now sub-floor and would not ground, so a high-personalization fixture must use
// a verified fact.
const highCtx = () =>
  ({
    contact: { id: "c1", seniority: "vp", firstName: "Sam", lastName: "Lee", fullName: "Sam Lee", email: "s@x.com", title: "VP", departments: [], linkedinUrl: null, score: null, scoreReasons: [] },
    funding: { stage: "Series A", amount: null, amountPrinted: "$12M" },
    technologies: [],
    bestSignal: null,
    researchBrief: { bestAngle: null, painPoints: [], competitorDetected: null, warmthSignals: [], publicContent: [] },
  }) as unknown;

const agentInput = (over: Partial<PersonalizationAgentInput> = {}): PersonalizationAgentInput => ({
  kind: "grounded-personalization",
  assets: { positioning: "We cut onboarding time.", offer: "30-day pilot" },
  voice: { banned: ["synergy"], frFormality: "vouvoiement" },
  evidence: [{ id: "pc-0", fact: "We just shipped X", source: "linkedin_post", confidence: 0.85 }],
  lang: "en",
  ...over,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stubDb(opts: { assets?: any[]; guides?: any[]; onInsert?: (v: any) => void } = {}) {
  return {
    select: () => {
      let table: any;
      const chain: any = { from: (t: any) => { table = t; return chain; }, where: async () => (table === copyAssetBlock ? (opts.assets ?? []) : (opts.guides ?? [])) };
      return chain;
    },
    insert: () => ({ values: async (v: any) => { opts.onInsert?.(v); } }),
  } as any;
}

describe("buildAgentPrompt", () => {
  it("lists evidence by id and the banned tokens", () => {
    const { system, user } = buildAgentPrompt(agentInput());
    expect(system).toMatch(/NEVER invent/);
    expect(user).toContain("[pc-0]");
    expect(user).toContain("We just shipped X");
    expect(user).toContain("synergy");
  });
});

describe("personalizationRunAgent", () => {
  it("parses a grounded JSON result", async () => {
    const res = await personalizationRunAgent(agentInput(), async () => JSON.stringify({ line: "Saw you shipped X.", citedIds: ["pc-0"] }));
    expect(res.evalPassed).toBe(true);
    expect(res.value).toMatchObject({ line: "Saw you shipped X.", citedIds: ["pc-0"] });
  });

  it("returns a non-result on no-JSON / bad shape / throw", async () => {
    expect((await personalizationRunAgent(agentInput(), async () => "no json")).evalPassed).toBe(false);
    expect((await personalizationRunAgent(agentInput(), async () => JSON.stringify({ line: 1 }))).evalPassed).toBe(false);
    expect((await personalizationRunAgent(agentInput(), async () => { throw new Error("model down"); })).evalPassed).toBe(false);
  });
});

describe("generateShadowCopy", () => {
  it("is a no-op when the flag is off", async () => {
    delete process.env.COPY_ENGINE_SHADOW;
    const res = await generateShadowCopy("c1", "t1", { database: stubDb() });
    expect(res).toEqual({ ran: false, reason: "copy_shadow_disabled" });
  });

  it("reports no_prospect_context when the context is missing", async () => {
    process.env.COPY_ENGINE_SHADOW = "1";
    ctxState.ctx = null;
    const res = await generateShadowCopy("c1", "t1", { database: stubDb() });
    expect(res).toEqual({ ran: false, reason: "no_prospect_context" });
  });

  it("generates a grounded high-personalization sample (on a provider fact) and persists it", async () => {
    process.env.COPY_ENGINE_SHADOW = "1";
    ctxState.ctx = highCtx() as ProspectContext; // grounds on the verified funding fact

    let inserted: any;
    const res = await generateShadowCopy("c1", "t1", {
      database: stubDb({ assets: [{ id: "a1", tenantId: "t1", campaignId: null, lang: "en", kind: "positioning", content: "We cut onboarding time.", version: 1, isCurrent: true, createdAt: new Date() }], onInsert: (v) => (inserted = v) }),
      generate: async () => JSON.stringify({ line: "Congrats on the Series A, relevant to onboarding speed.", citedIds: ["funding"] }),
    });
    expect(res.ran).toBe(true);
    expect(res.message?.personalization_level).toBe("high");
    expect(res.message?.body).toContain("Series A");
    expect(res.evidenceCount).toBe(1);
    expect(inserted).toMatchObject({ tenantId: "t1", contactId: "c1", lang: "en", personalizationLevel: "high" });
  });
});

describe("isCopyEnginePrimaryEnabled", () => {
  it("off by default, on for 1/true", () => {
    delete process.env.COPY_ENGINE_PRIMARY;
    expect(isCopyEnginePrimaryEnabled()).toBe(false);
    process.env.COPY_ENGINE_PRIMARY = "1";
    expect(isCopyEnginePrimaryEnabled()).toBe(true);
    process.env.COPY_ENGINE_PRIMARY = "true";
    expect(isCopyEnginePrimaryEnabled()).toBe(true);
    process.env.COPY_ENGINE_PRIMARY = "off";
    expect(isCopyEnginePrimaryEnabled()).toBe(false);
  });
});

describe("generateCopyMessage (no flag gate — the cutover core)", () => {
  it("runs the engine and returns a high-personalization message even when the shadow flag is OFF, without persisting", async () => {
    delete process.env.COPY_ENGINE_SHADOW; // generateCopyMessage ignores it
    ctxState.ctx = highCtx();
    let inserted = false;
    const res = await generateCopyMessage("c1", "t1", {
      database: stubDb({ assets: [{ id: "a1", tenantId: "t1", campaignId: null, lang: "en", kind: "positioning", content: "We cut onboarding time.", version: 1, isCurrent: true, createdAt: new Date() }], onInsert: () => (inserted = true) }),
      generate: async () => JSON.stringify({ line: "Congrats on the Series A, relevant to onboarding speed.", citedIds: ["funding"] }),
    });
    expect(res.ran).toBe(true);
    expect(res.message?.personalization_level).toBe("high");
    expect(inserted).toBe(false); // core does NOT persist; the shadow/primary wrappers do
  });

  it("reports no_prospect_context when the context is missing", async () => {
    ctxState.ctx = null;
    const res = await generateCopyMessage("c1", "t1", { database: stubDb() });
    expect(res).toEqual({ ran: false, reason: "no_prospect_context" });
  });
});

// T6b — G2 factual gate at the SOURCE: a fabricated body never leaves
// generateCopyMessage, so every consumer (autopilot prepare, draft-router
// primary, auto-send, V2 conductor, shadow) inherits the gate.
describe("generateCopyMessage — G2 factual gate (deterministic layer)", () => {
  const assetsRow = [{ id: "a1", tenantId: "t1", campaignId: null, lang: "en", kind: "positioning", content: "We cut onboarding time.", version: 1, isCurrent: true, createdAt: new Date() }];

  it("blocks a fabricated body: no message (every caller falls back) + a blocked verdict row", async () => {
    ctxState.ctx = highCtx(); // brief has ZERO sourced facts -> deterministic layer fires
    const res = await generateCopyMessage("c1", "t1", {
      database: stubDb({ assets: assetsRow }),
      // Cites the real funding evidence (so the engine ships it high) but
      // asserts a headcount + named tools the research never recorded.
      generate: async () => JSON.stringify({ line: "Saw your team of 3,848 people runs n8n and Keycloak.", citedIds: ["funding"] }),
    });
    expect(res.ran).toBe(true);
    expect(res.message).toBeUndefined();
    expect(res.reason).toBe("g2_fabrication_blocked");
    expect(res.evidenceCount).toBe(1);
    expect(gateState.calls).toHaveLength(1);
    expect(gateState.calls[0]).toMatchObject({
      tenantId: "t1",
      subjectType: "step",
      subjectId: "c1",
      gate: 2,
      rubricVersion: "g2.det.v1",
      verdict: "blocked",
    });
    const reasons = gateState.calls[0].reasons as { ungrounded: string[]; briefHasFacts: boolean; path: string };
    expect(reasons.path).toBe("copy_engine");
    expect(reasons.briefHasFacts).toBe(false);
    expect(reasons.ungrounded).toEqual(expect.arrayContaining(["3,848", "n8n", "keycloak"]));
  });

  it("passes a grounded body untouched + a pass verdict row", async () => {
    ctxState.ctx = highCtx();
    const res = await generateCopyMessage("c1", "t1", {
      database: stubDb({ assets: assetsRow }),
      generate: async () => JSON.stringify({ line: "Congrats on the Series A, relevant to onboarding speed.", citedIds: ["funding"] }),
    });
    expect(res.ran).toBe(true);
    expect(res.message?.personalization_level).toBe("high");
    expect(res.message?.body).toContain("Series A");
    expect(gateState.calls).toHaveLength(1);
    expect(gateState.calls[0]).toMatchObject({
      tenantId: "t1",
      subjectType: "step",
      subjectId: "c1",
      gate: 2,
      rubricVersion: "g2.det.v1",
      verdict: "pass",
      reasons: { ungrounded: [], briefHasFacts: false, path: "copy_engine" },
    });
  });

  it("the shadow wrapper never persists a G2-blocked message", async () => {
    process.env.COPY_ENGINE_SHADOW = "1";
    ctxState.ctx = highCtx();
    let inserted = false;
    const res = await generateShadowCopy("c1", "t1", {
      database: stubDb({ assets: assetsRow, onInsert: () => (inserted = true) }),
      generate: async () => JSON.stringify({ line: "Saw your team of 3,848 people runs n8n and Keycloak.", citedIds: ["funding"] }),
    });
    expect(res.ran).toBe(true);
    expect(res.message).toBeUndefined();
    expect(inserted).toBe(false);
  });
});
