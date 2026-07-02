import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

/**
 * M13 T6b — the reply path passes the G2 (factual) gate BLOCKING. The positive
 * branch can AUTO-SEND, so a fabricated body must never reach "queued":
 *  - clean body        -> status unchanged, verdict "pass" logged
 *  - fabricated + one corrective regen clean -> status unchanged, "reworked"
 *  - fabricated + regen still dirty -> status FORCED "draft" even when the
 *    approval authority allowed auto-send, "blocked" + autoSendDowngraded
 *  - objection branch (draft-only by design) is gated + logged the same way
 *  - gate infrastructure error fails CLOSED (draft, "blocked", failClosed)
 * Boundary-mock rule: fabrication-gate / gate-decisions / traced-ai /
 * prospect-context are mocked at their OWN module boundary, never partially.
 */

// ── Spies (referenced lazily inside factories — same pattern as
//    signal-auto-enroll.approval.test.ts) ──
const tracedGenerateObject = vi.fn();
const judgeFabrication = vi.fn();
const decideFabricationGate = vi.fn();
const recordGateDecision = vi.fn();
const getTenantSettings = vi.fn();
const enforceAgentApprovalMode = vi.fn();

vi.mock("@/inngest/client", () => ({
  inngest: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createFunction: vi.fn((config: any, handler: any) => ({ config, handler })),
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: () => ({ op: "eq" }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  and: (...args: any[]) => ({ op: "and", args }),
  desc: () => ({ op: "desc" }),
}));

vi.mock("@/db/schema", () => ({
  sequenceEnrollments: { id: "id", contactId: "contact_id", sequenceId: "sequence_id" },
  contacts: { id: "id" },
  outboundEmails: {
    id: "id",
    subject: "subject",
    bodyText: "body_text",
    stepNumber: "step_number",
    enrollmentId: "enrollment_id",
  },
  users: { id: "id" },
  sequences: { id: "id", tenantId: "tenant_id" },
}));

// Sequenced db.select by call order (positive path):
//  1 load-enrollment  2 contact  3 get-last-email  4 get-slots users -> none
let selectCall = 0;
function selectResultFor(call: number): unknown[] {
  switch (call) {
    case 1:
      return [{ id: "enr1", contactId: "c1", currentStep: 1, sequenceId: "seq1" }];
    case 2:
      return [{ id: "c1", tenantId: "t1", companyId: "co1", email: "prospect@acme.com", firstName: "Ada", lastName: "Lovelace", title: "CTO" }];
    case 3:
      return [{ subject: "Quick idea", bodyText: "orig body" }];
    default:
      return []; // get-slots: no user -> no meeting slots
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const insertedValues: any[] = [];

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => {
      selectCall += 1;
      const result = selectResultFor(selectCall);
      // Chainable: .from().where().orderBy().limit() in any partial order.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        limit: () => Promise.resolve(result),
        then: (resolve: (v: unknown) => void) => resolve(result),
      };
      chain.from = () => chain;
      chain.where = () => chain;
      chain.orderBy = () => chain;
      chain.leftJoin = () => chain;
      return chain;
    }),
    insert: vi.fn(() => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      values: (v: any) => {
        insertedValues.push(v);
        return {
          returning: () => Promise.resolve([{ id: "email1" }]),
          onConflictDoNothing: () => Promise.resolve(undefined),
          then: (resolve: (x: unknown) => void) => resolve(undefined),
        };
      },
    })),
  },
}));

vi.mock("@/lib/ai/traced-ai", () => ({
  tracedGenerateObject: (...a: unknown[]) => tracedGenerateObject(...a),
}));
vi.mock("@/lib/ai/ai-provider", () => ({ anthropic: () => "model-anthropic" }));
vi.mock("@ai-sdk/openai", () => ({ openai: () => "model-openai" }));

vi.mock("@/lib/evals/fabrication-gate", () => ({
  judgeFabrication: (...a: unknown[]) => judgeFabrication(...a),
  decideFabricationGate: (...a: unknown[]) => decideFabricationGate(...a),
}));
vi.mock("@/lib/gates/gate-decisions", () => ({
  GATE_RUBRICS: { g2Deterministic: "g2.det.v1" },
  recordGateDecision: (...a: unknown[]) => recordGateDecision(...a),
}));

const ctxFixture = {
  contact: { id: "c1", fullName: "Ada Lovelace", title: "CTO" },
  company: { id: "co1", name: "Acme", domain: "acme.com" },
  researchBrief: { bestAngle: "hiring push" },
  knowledge: [{ topic: "pricing objections", content: "ROI framing" }],
  aiTone: "Direct",
};
vi.mock("@/lib/context/prospect-context", () => ({
  buildProspectContext: vi.fn(async () => ctxFixture),
  formatContextForPrompt: () => "CTX",
}));

vi.mock("@/lib/integrations/meeting-booking", () => ({
  getAvailableSlots: vi.fn(async () => []),
  formatSlotsForEmail: () => "",
}));
vi.mock("@/lib/campaign-engine/trust-score", () => ({ updateTrustScore: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/analytics/pipeline-tracker", () => ({ trackPipeline: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notify/db-notify", () => ({ notifyTenant: vi.fn().mockResolvedValue({ delivered: 1, source: "db", slack: false }) }));
vi.mock("@/lib/notify/hot-lead-message", () => ({ buildHotLeadNotification: () => ({ title: "hot" }) }));
vi.mock("@/lib/config/tenant-settings", () => ({ getTenantSettings: (...a: unknown[]) => getTenantSettings(...a) }));
vi.mock("@/lib/guardrails/approval-mode", () => ({
  enforceAgentApprovalMode: (...a: unknown[]) => enforceAgentApprovalMode(...a),
  readApprovalMode: (s: { agentApprovalMode?: string }) => s?.agentApprovalMode ?? "review-each",
}));

import { handleReplyIntelligently } from "@/inngest/reply-handler";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = (handleReplyIntelligently as any).handler;
const fakeStep = { run: (_n: string, fn: () => unknown) => fn() };

const makeEvent = (classification: string) => ({
  data: {
    enrollmentId: "enr1",
    classification,
    reason: "wants a demo",
    nextAction: "book a call",
    urgency: "high",
    replyContent: "yes, interested",
  },
});

const CLEAN = { blocked: false, ungrounded: [], reason: "no fabrication detected", briefHasFacts: true };
const BLOCKED = { blocked: true, ungrounded: ["n8n", "500 clients"], reason: "unverifiable specifics", briefHasFacts: false };

// The suite mutates the API-key env vars; restore so files sharing the worker
// never inherit the stubs.
const ORIG_ANTHROPIC = process.env.ANTHROPIC_API_KEY;
const ORIG_OPENAI = process.env.OPENAI_API_KEY;
afterAll(() => {
  if (ORIG_ANTHROPIC === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIG_ANTHROPIC;
  if (ORIG_OPENAI === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = ORIG_OPENAI;
});

beforeEach(() => {
  selectCall = 0;
  insertedValues.length = 0;
  tracedGenerateObject.mockReset();
  judgeFabrication.mockReset();
  decideFabricationGate.mockReset();
  recordGateDecision.mockReset();
  getTenantSettings.mockReset();
  enforceAgentApprovalMode.mockReset();

  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.OPENAI_API_KEY;

  tracedGenerateObject.mockResolvedValue({ object: { subject: "Re: Quick idea", body: "clean body" } });
  judgeFabrication.mockResolvedValue([]);
  decideFabricationGate.mockReturnValue(CLEAN);
  recordGateDecision.mockResolvedValue(1);
  getTenantSettings.mockResolvedValue({ agentApprovalMode: "auto-high-confidence" });
  enforceAgentApprovalMode.mockReturnValue({ allowed: true, queueAs: null, reason: "auto" });
});

describe("reply-handler G2 gate — positive path (can auto-send)", () => {
  it("clean body -> stays queued when autoSend, verdict pass logged on the row id", async () => {
    const res = await handler({ event: makeEvent("interested"), step: fakeStep });
    expect(res).toMatchObject({ result: "auto_queued", classification: "interested" });

    expect(insertedValues).toHaveLength(1);
    expect(insertedValues[0]).toMatchObject({ status: "queued", bodyText: "clean body", toAddress: "prospect@acme.com" });
    expect(insertedValues[0].queuedAt).toBeTruthy();

    // One generation, one judge call, one deterministic decision — no rework.
    expect(tracedGenerateObject).toHaveBeenCalledTimes(1);
    expect(judgeFabrication).toHaveBeenCalledTimes(1);
    expect(judgeFabrication).toHaveBeenCalledWith("clean body", ctxFixture.researchBrief, {
      name: "Ada Lovelace",
      title: "CTO",
      company: "Acme",
      domain: "acme.com",
    });
    expect(decideFabricationGate).toHaveBeenCalledTimes(1);
    expect(decideFabricationGate).toHaveBeenCalledWith(
      expect.objectContaining({ body: "clean body", brief: ctxFixture.researchBrief, semanticClaims: [] }),
    );

    expect(recordGateDecision).toHaveBeenCalledTimes(1);
    const logged = recordGateDecision.mock.calls[0][0];
    expect(logged).toMatchObject({
      tenantId: "t1",
      subjectType: "draft",
      subjectId: "email1",
      gate: 2,
      rubricVersion: "g2.det.v1",
      verdict: "pass",
    });
    expect(logged.reasons).toMatchObject({ path: "reply_positive", briefHasFacts: true, ungrounded: [] });
    expect(logged.reasons.autoSendDowngraded).toBeUndefined();
  });

  it("fabricated body + corrective regen clean -> queued with the CORRECTED body, verdict reworked", async () => {
    tracedGenerateObject
      .mockResolvedValueOnce({ object: { subject: "Re: Quick idea", body: "fabricated body" } })
      .mockResolvedValueOnce({ object: { subject: "Re: Quick idea", body: "corrected body" } });
    decideFabricationGate.mockReturnValueOnce(BLOCKED).mockReturnValueOnce(CLEAN);

    const res = await handler({ event: makeEvent("meeting_request"), step: fakeStep });
    expect(res).toMatchObject({ result: "auto_queued" });

    expect(insertedValues[0]).toMatchObject({ status: "queued", bodyText: "corrected body" });

    // Exactly ONE corrective regeneration carrying the ungrounded list; the
    // recheck is deterministic-only (no second Haiku call).
    expect(tracedGenerateObject).toHaveBeenCalledTimes(2);
    const regenPrompt = tracedGenerateObject.mock.calls[1][0].prompt as string;
    expect(regenPrompt).toContain("PREVIOUS ATTEMPT FEEDBACK");
    expect(regenPrompt).toContain("n8n; 500 clients");
    expect(judgeFabrication).toHaveBeenCalledTimes(1);
    expect(decideFabricationGate).toHaveBeenCalledTimes(2);
    expect(decideFabricationGate.mock.calls[1][0]).toMatchObject({ body: "corrected body" });

    const logged = recordGateDecision.mock.calls[0][0];
    expect(logged.verdict).toBe("reworked");
    expect(logged.reasons).toMatchObject({ path: "reply_positive", ungrounded: ["n8n", "500 clients"] });
    expect(logged.reasons.autoSendDowngraded).toBeUndefined();
  });

  it("still fabricated after regen -> status FORCED draft even with autoSend, verdict blocked + autoSendDowngraded", async () => {
    tracedGenerateObject
      .mockResolvedValueOnce({ object: { subject: "Re: Quick idea", body: "fabricated body" } })
      .mockResolvedValueOnce({ object: { subject: "Re: Quick idea", body: "still dirty body" } });
    decideFabricationGate
      .mockReturnValueOnce(BLOCKED)
      .mockReturnValueOnce({ ...BLOCKED, ungrounded: ["n8n"] });
    enforceAgentApprovalMode.mockReturnValue({ allowed: true, queueAs: null, reason: "auto" });

    const res = await handler({ event: makeEvent("interested"), step: fakeStep });
    expect(res).toMatchObject({ result: "draft_created" });

    expect(insertedValues[0]).toMatchObject({ status: "draft", bodyText: "still dirty body" });
    expect(insertedValues[0].queuedAt).toBeNull();

    const logged = recordGateDecision.mock.calls[0][0];
    expect(logged).toMatchObject({ subjectType: "draft", subjectId: "email1", gate: 2, verdict: "blocked" });
    expect(logged.reasons).toMatchObject({
      path: "reply_positive",
      autoSendDowngraded: true,
      ungrounded: ["n8n"],
    });
  });

  it("gate infrastructure error -> fails CLOSED: draft, verdict blocked, failClosed gate_error", async () => {
    decideFabricationGate.mockImplementation(() => {
      throw new Error("gate exploded");
    });

    const res = await handler({ event: makeEvent("interested"), step: fakeStep });
    expect(res).toMatchObject({ result: "draft_created" });

    // Original body kept, but never queued.
    expect(insertedValues[0]).toMatchObject({ status: "draft", bodyText: "clean body" });
    expect(insertedValues[0].queuedAt).toBeNull();

    const logged = recordGateDecision.mock.calls[0][0];
    expect(logged.verdict).toBe("blocked");
    expect(logged.reasons).toMatchObject({ path: "reply_positive", failClosed: "gate_error", autoSendDowngraded: true });
  });

  it("judge throw is advisory -> deterministic layer still gates, clean verdict passes queued", async () => {
    judgeFabrication.mockRejectedValue(new Error("judge down"));

    const res = await handler({ event: makeEvent("interested"), step: fakeStep });
    expect(res).toMatchObject({ result: "auto_queued" });
    expect(insertedValues[0]).toMatchObject({ status: "queued", bodyText: "clean body" });
    expect(decideFabricationGate).toHaveBeenCalledWith(expect.objectContaining({ semanticClaims: [] }));
    expect(recordGateDecision.mock.calls[0][0].verdict).toBe("pass");
  });

  it("no ANTHROPIC_API_KEY -> semantic judge skipped, deterministic gate still blocks + reworks", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "test-openai"; // getLLMModel still resolves a model
    tracedGenerateObject
      .mockResolvedValueOnce({ object: { subject: "Re: Quick idea", body: "fabricated body" } })
      .mockResolvedValueOnce({ object: { subject: "Re: Quick idea", body: "corrected body" } });
    decideFabricationGate.mockReturnValueOnce(BLOCKED).mockReturnValueOnce(CLEAN);

    const res = await handler({ event: makeEvent("interested"), step: fakeStep });
    expect(res).toMatchObject({ result: "auto_queued" });
    expect(judgeFabrication).not.toHaveBeenCalled();
    expect(insertedValues[0]).toMatchObject({ status: "queued", bodyText: "corrected body" });
    expect(recordGateDecision.mock.calls[0][0].verdict).toBe("reworked");
  });
});

describe("reply-handler G2 gate — objection path (draft-only)", () => {
  it("fabricated objection reply -> stays draft, corrected body stored, verdict logged as reply_objection", async () => {
    tracedGenerateObject
      .mockResolvedValueOnce({ object: { subject: "Re: Quick idea", body: "fabricated body" } })
      .mockResolvedValueOnce({ object: { subject: "Re: Quick idea", body: "corrected body" } });
    decideFabricationGate.mockReturnValueOnce(BLOCKED).mockReturnValueOnce(CLEAN);

    const res = await handler({ event: makeEvent("objection_price"), step: fakeStep });
    expect(res).toMatchObject({ result: "draft_created", objectionType: "price" });

    expect(insertedValues[0]).toMatchObject({ status: "draft", bodyText: "corrected body" });
    // The objection branch never consults the approval authority.
    expect(enforceAgentApprovalMode).not.toHaveBeenCalled();

    const logged = recordGateDecision.mock.calls[0][0];
    expect(logged).toMatchObject({
      tenantId: "t1",
      subjectType: "draft",
      subjectId: "email1",
      gate: 2,
      rubricVersion: "g2.det.v1",
      verdict: "reworked",
    });
    expect(logged.reasons).toMatchObject({ path: "reply_objection", ungrounded: ["n8n", "500 clients"] });
    expect(logged.reasons.autoSendDowngraded).toBeUndefined();
  });

  it("objection reply still dirty after regen -> draft (unchanged) + verdict blocked, no downgrade flag", async () => {
    tracedGenerateObject
      .mockResolvedValueOnce({ object: { subject: "Re: Quick idea", body: "fabricated body" } })
      .mockResolvedValueOnce({ object: { subject: "Re: Quick idea", body: "still dirty body" } });
    decideFabricationGate.mockReturnValueOnce(BLOCKED).mockReturnValueOnce({ ...BLOCKED, ungrounded: ["n8n"] });

    const res = await handler({ event: makeEvent("objection_timing"), step: fakeStep });
    expect(res).toMatchObject({ result: "draft_created", objectionType: "timing" });

    expect(insertedValues[0]).toMatchObject({ status: "draft", bodyText: "still dirty body" });
    const logged = recordGateDecision.mock.calls[0][0];
    expect(logged.verdict).toBe("blocked");
    expect(logged.reasons).toMatchObject({ path: "reply_objection", ungrounded: ["n8n"] });
    expect(logged.reasons.autoSendDowngraded).toBeUndefined();
  });
});
