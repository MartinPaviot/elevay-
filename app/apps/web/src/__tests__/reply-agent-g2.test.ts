import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * M13 T6b — the reply-agent (campaign-engine delegated classifications) was
 * the LAST ungated auto-send seam: gateAction is an AUTONOMY gate, not a
 * fabrication gate. Pins the WIRING (the helper's own behavior is covered by
 * reply-handler-g2.test.ts + lib tests): a blocked G2 verdict forces status
 * "draft" even when the autonomy gate says execute; the stored body is the
 * GATED body; every disposition logs a verdict row on the inserted row id.
 */

const insertedValues: Array<Record<string, unknown>> = [];
const gateRows: Array<Record<string, unknown>> = [];

vi.mock("@/inngest/client", () => ({
  inngest: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createFunction: vi.fn((config: any, handler: any) => ({ config, handler })),
  },
}));
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: (v: Record<string, unknown>) => {
        insertedValues.push(v);
        return {
          returning: async () => [{ id: "reply-email-1" }],
          onConflictDoNothing: () => Promise.resolve(undefined),
          then: (resolve: (v: unknown) => void) => resolve(undefined),
        };
      },
    })),
    update: vi.fn(() => ({ set: () => ({ where: async () => undefined }) })),
    select: vi.fn(() => ({ from: () => ({ where: async () => [] }) })),
  },
}));
vi.mock("@/db/schema", () => ({
  sequenceEnrollments: { id: "se.id" },
  contacts: {},
  companies: {},
  outboundEmails: { id: "oe.id" },
  notifications: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: () => ({ op: "eq" }),
  and: (...args: unknown[]) => ({ op: "and", args }),
}));
vi.mock("@/lib/anti-collision/enroll-guard", () => ({ releaseEnrollmentById: vi.fn() }));
vi.mock("@/lib/ai/traced-ai", () => ({ tracedGenerateObject: vi.fn() }));
vi.mock("@/lib/ai/ai-provider", () => ({ anthropic: vi.fn(() => ({ model: "sonnet" })) }));
vi.mock("@/lib/campaign-engine/trust-score", () => ({ updateTrustScore: vi.fn(async () => undefined) }));
vi.mock("@/lib/campaign-engine/build-intelligence-brief", () => ({
  buildIntelligenceBrief: vi.fn(async () => null),
}));
vi.mock("@/lib/context/prospect-context", () => ({
  buildProspectContext: vi.fn(async () => ({
    contact: { fullName: "Ada Lovelace", title: "CTO", email: "prospect@acme.com" },
    company: { id: "co1", name: "Acme", domain: "acme.com" },
    researchBrief: { bestAngle: "ops", painPoints: [], competitorDetected: null, warmthSignals: [], publicContent: [] },
    aiTone: "direct",
  })),
  formatContextForPrompt: vi.fn(() => "CONTEXT"),
}));
const gateActionMock = vi.fn();
vi.mock("@/lib/campaign-engine/execution-gate", () => ({
  gateAction: (...args: unknown[]) => gateActionMock(...args),
}));
const applyG2Mock = vi.fn();
vi.mock("@/lib/reply/g2-fabrication", () => ({
  applyG2FabricationGate: (...args: unknown[]) => applyG2Mock(...args),
}));
vi.mock("@/lib/gates/gate-decisions", () => ({
  GATE_RUBRICS: { g2Deterministic: "g2.det.v1" },
  recordGateDecision: vi.fn(async (row: Record<string, unknown>) => {
    gateRows.push(row);
    return 1;
  }),
}));

import { replyAgent } from "@/inngest/reply-agent";
import { tracedGenerateObject } from "@/lib/ai/traced-ai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = (replyAgent as any).handler;
const fakeStep = { run: (_n: string, fn: () => unknown) => fn() };

const makeEvent = (classification = "info_request") => ({
  data: {
    enrollmentId: "enr1",
    tenantId: "t1",
    contactId: "c1",
    classification,
    replyContent: "can you send more info?",
    originalSubject: "Quick idea",
  },
});

const PASS = { subject: "Re: Quick idea", body: "clean body", verdict: "pass", ungrounded: [], briefHasFacts: true };
const BLOCKED = { subject: "Re: Quick idea", body: "fabricated body", verdict: "blocked", ungrounded: ["n8n"], briefHasFacts: false };

beforeEach(() => {
  insertedValues.length = 0;
  gateRows.length = 0;
  gateActionMock.mockReset().mockResolvedValue({ status: "execute", reason: "auto" });
  applyG2Mock.mockReset().mockResolvedValue(PASS);
  vi.mocked(tracedGenerateObject).mockReset().mockResolvedValue({
    object: { subject: "Re: Quick idea", body: "clean body", action: "send_reply", reasoning: "asked for info" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

describe("reply-agent — G2 wiring on the delegated auto-send seam", () => {
  it("G2 pass + autonomy execute -> queued with the gated body, verdict pass on the row id", async () => {
    const res = await handler({ event: makeEvent(), step: fakeStep });
    expect(res).toMatchObject({ result: "auto_sent" });

    expect(insertedValues).toHaveLength(1);
    expect(insertedValues[0]).toMatchObject({ status: "queued", bodyText: "clean body", subject: "Re: Quick idea" });
    expect(insertedValues[0].queuedAt).toBeTruthy();

    expect(gateRows).toHaveLength(1);
    expect(gateRows[0]).toMatchObject({
      tenantId: "t1",
      subjectType: "draft",
      subjectId: "reply-email-1",
      gate: 2,
      rubricVersion: "g2.det.v1",
      verdict: "pass",
    });
    expect((gateRows[0].reasons as Record<string, unknown>).path).toBe("reply_agent");
  });

  it("G2 blocked + autonomy execute -> status FORCED draft (never queued), autoSendDowngraded", async () => {
    applyG2Mock.mockResolvedValue(BLOCKED);

    const res = await handler({ event: makeEvent("question"), step: fakeStep });
    expect(res).toMatchObject({ result: "draft_created" });

    expect(insertedValues[0]).toMatchObject({ status: "draft", bodyText: "fabricated body" });
    expect(insertedValues[0].queuedAt ?? null).toBeNull();

    expect(gateRows[0]).toMatchObject({ verdict: "blocked" });
    expect(gateRows[0].reasons).toMatchObject({ path: "reply_agent", autoSendDowngraded: true, ungrounded: ["n8n"] });
  });

  it("autonomy gate defers -> draft branch stores the GATED body + verdict logged, no downgrade flag", async () => {
    gateActionMock.mockResolvedValue({ status: "review", reason: "needs approval" });
    applyG2Mock.mockResolvedValue({ ...PASS, subject: "Re: gated", body: "gated body", verdict: "reworked", ungrounded: ["500"] });

    const res = await handler({ event: makeEvent("not_now"), step: fakeStep });
    expect(res).toMatchObject({ result: "pending_approval" });

    expect(insertedValues[0]).toMatchObject({ status: "draft", bodyText: "gated body", subject: "Re: gated" });
    expect(gateRows[0]).toMatchObject({ verdict: "reworked", subjectId: "reply-email-1" });
    expect((gateRows[0].reasons as Record<string, unknown>).autoSendDowngraded).toBeUndefined();
  });

  it("escalate_to_human stores NO email body and runs NO G2 gate", async () => {
    vi.mocked(tracedGenerateObject).mockResolvedValue({
      object: { subject: "s", body: "b", action: "escalate_to_human", reasoning: "complex ask" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await handler({ event: makeEvent(), step: fakeStep });
    expect(res).toMatchObject({ result: "escalated" });
    // Only the notification insert — never an outbound email, never a gate row.
    expect(insertedValues.every((v) => !("bodyText" in v))).toBe(true);
    expect(applyG2Mock).not.toHaveBeenCalled();
    expect(gateRows).toHaveLength(0);
  });
});
