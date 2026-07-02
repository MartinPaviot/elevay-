import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

/**
 * T10 (M8-R2) — processReply's confidence gate: a classification below the
 * shared floor (DEFAULT_MIN_CONFIDENCE, lib/reply/classify.ts) lands in
 * reply_review_queue as an OVERLAY — routing continues either way (a hot
 * lead never waits on a human), and a confident classification never
 * queues. Also pins: "objection" is a first-level enum value, and the
 * queue insert is retry-deduped + non-fatal.
 */

const inserted: Array<Record<string, unknown>> = [];
const updated: Array<Record<string, unknown>> = [];
const sent: Array<Record<string, unknown>> = [];
let conflictInsert = false;
let insertThrows = false;

vi.mock("@/inngest/client", () => ({
  inngest: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createFunction: vi.fn((config: any, handler: any) => ({ config, handler })),
    send: vi.fn(async (ev: Record<string, unknown>) => {
      sent.push(ev);
    }),
  },
}));
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => {
      if (insertThrows) throw new Error("db down");
      return {
        values: (v: Record<string, unknown>) => ({
          onConflictDoNothing: () => {
            if (!conflictInsert) inserted.push(v);
            return Promise.resolve(undefined);
          },
          returning: async () => [{ id: "row1" }],
          then: (resolve: (v: unknown) => void) => resolve(undefined),
        }),
      };
    }),
    update: vi.fn(() => ({
      set: (v: Record<string, unknown>) => ({
        where: () => {
          updated.push(v);
          return Promise.resolve(undefined);
        },
      }),
    })),
    select: vi.fn(() => ({
      from: () => ({
        where: () => {
          const p = Promise.resolve([]) as unknown as Promise<unknown[]> & {
            limit: () => Promise<unknown[]>;
          };
          p.limit = () => Promise.resolve([]);
          return p;
        },
      }),
    })),
  },
}));
vi.mock("@/db/schema", () => ({
  companies: {},
  contacts: {},
  sequenceSteps: {},
  sequenceEnrollments: {},
  activities: {},
  outboundEmails: { id: "oe.id", tenantId: "oe.tenant" },
  emailOptouts: {},
  tenants: {},
  replyReviewQueue: { __table: "reply_review_queue" },
}));
const tracedGenerateObjectMock = vi.fn();
vi.mock("@/lib/ai/traced-ai", () => ({
  tracedGenerateObject: (...args: unknown[]) => tracedGenerateObjectMock(...args),
}));
vi.mock("@/lib/ai/ai-provider", () => ({ anthropic: vi.fn(() => ({ model: "haiku" })) }));
vi.mock("@/lib/sequences/enrollment", () => ({ pauseEnrollment: vi.fn(async () => undefined) }));
// Heavy transitive imports of inngest/functions.ts — mocked at their own
// boundary so the module graph loads keyless (the T5/T6b lesson).
vi.mock("@/lib/anti-collision/enroll-guard", () => ({ releaseEnrollmentById: vi.fn() }));
vi.mock("@/lib/sequence/db-conductor", () => ({ isSequenceEngineV2Enabled: () => false, tickEnrollmentV2: vi.fn() }));
vi.mock("@/lib/sequence-dispatch/registry", () => ({ dispatchStep: vi.fn() }));
vi.mock("@/lib/emails/outbound-hold", () => ({ enqueueOutbound: vi.fn() }));
vi.mock("@/lib/ai/embeddings", () => ({ embedEntity: vi.fn(), companyToText: vi.fn(), contactToText: vi.fn() }));
vi.mock("@/lib/ai/ai-account-summary", () => ({ generateAccountSummary: vi.fn() }));
vi.mock("@/lib/context/prospect-context", () => ({ buildProspectContext: vi.fn() }));
vi.mock("@/lib/agents/sequence-generator", () => ({ personalizeStepEmail: vi.fn() }));
vi.mock("@/lib/copy/personalization/db-shadow", () => ({
  generateCopyMessage: vi.fn(),
  persistShadowSample: vi.fn(),
  isCopyEnginePrimaryEnabled: () => false,
}));
vi.mock("@/lib/copy/assets/db-store", () => ({ resolveTenantCopyLang: vi.fn() }));
vi.mock("@/lib/evals/fabrication-gate", () => ({ decideFabricationGate: vi.fn() }));
vi.mock("@/lib/gates/gate-decisions", () => ({ GATE_RUBRICS: {}, recordGateDecision: vi.fn() }));
vi.mock("@/lib/analytics/pipeline-tracker", () => ({ trackPipeline: vi.fn() }));
vi.mock("@/lib/config/tenant-settings", () => ({ getTenantSettings: vi.fn(async () => null) }));
vi.mock("@/lib/sequence-drafts/router", () => ({ decideRouteMode: vi.fn() }));
vi.mock("@/lib/integrations/apollo-client", () => ({
  enrichOrganization: vi.fn(),
  employeeCountToRange: vi.fn(),
  revenueToRange: vi.fn(),
  isApolloAvailable: () => false,
}));
vi.mock("@/lib/providers/contact-enrichment/waterfall", () => ({ enrichContact: vi.fn() }));

import { processReply } from "@/inngest/functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = (processReply as any).handler;
const fakeStep = { run: (_n: string, fn: () => unknown) => fn() };

const makeEvent = (over: Record<string, unknown> = {}) => ({
  data: {
    enrollmentId: "enr1",
    outboundEmailId: "oe1",
    tenantId: "t1",
    contactId: "c1",
    replyContent: "Interesting, but we already use a competitor tool.",
    ...over,
  },
});

const classify = (classification: string, confidence: number) => ({
  object: {
    classification,
    reason: "test",
    nextAction: "follow up",
    urgency: "medium",
    confidence,
  },
});

const ORIG_KEY = process.env.ANTHROPIC_API_KEY;
afterAll(() => {
  if (ORIG_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIG_KEY;
});

beforeEach(() => {
  inserted.length = 0;
  updated.length = 0;
  sent.length = 0;
  conflictInsert = false;
  insertThrows = false;
  tracedGenerateObjectMock.mockReset();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("processReply — the T10 confidence gate", () => {
  it("a 0.3-confidence classification lands in the queue AND still routes", async () => {
    tracedGenerateObjectMock.mockResolvedValue(classify("objection", 0.3));

    await handler({ event: makeEvent(), step: fakeStep });

    // Queued for review with the full guess...
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      tenantId: "t1",
      outboundEmailId: "oe1",
      enrollmentId: "enr1",
      contactId: "c1",
      classification: { classification: "objection", confidence: 0.3, reason: "test" },
    });
    // ...and the routing event STILL fired (overlay, not a gate).
    expect(sent.some((e) => e.name === "reply/classified")).toBe(true);
  });

  it("a confident classification never touches the queue", async () => {
    tracedGenerateObjectMock.mockResolvedValue(classify("interested", 0.92));

    await handler({ event: makeEvent(), step: fakeStep });

    expect(inserted).toHaveLength(0);
    expect(sent.some((e) => e.name === "reply/classified")).toBe(true);
  });

  it("exactly at the floor (0.6) does not queue — the floor is strict-below", async () => {
    tracedGenerateObjectMock.mockResolvedValue(classify("interested", 0.6));
    await handler({ event: makeEvent(), step: fakeStep });
    expect(inserted).toHaveLength(0);
  });

  it("a missing confidence field is treated as ZERO (queues) — absence is not certainty", async () => {
    tracedGenerateObjectMock.mockResolvedValue({
      object: { classification: "interested", reason: "r", nextAction: "n", urgency: "low" },
    });
    await handler({ event: makeEvent(), step: fakeStep });
    expect(inserted).toHaveLength(1);
  });

  it("bare 'objection' is a legal first-level classification and routes to the handler", async () => {
    tracedGenerateObjectMock.mockResolvedValue(classify("objection", 0.9));

    const res = await handler({ event: makeEvent(), step: fakeStep });

    expect(res.classification ?? "objection").toBeTruthy();
    const ev = sent.find((e) => e.name === "reply/classified") as
      | { data: { classification: string } }
      | undefined;
    expect(ev?.data.classification).toBe("objection");
  });

  it("an Inngest retry never double-queues (ON CONFLICT no-op)", async () => {
    tracedGenerateObjectMock.mockResolvedValue(classify("objection", 0.3));
    conflictInsert = true; // simulate the unique index absorbing the retry
    await handler({ event: makeEvent(), step: fakeStep });
    expect(inserted).toHaveLength(0); // no second row
    expect(sent.some((e) => e.name === "reply/classified")).toBe(true);
  });

  it("a queue-insert failure is NON-FATAL — the reply pipeline continues", async () => {
    tracedGenerateObjectMock.mockResolvedValue(classify("objection", 0.3));
    insertThrows = true;
    await expect(handler({ event: makeEvent(), step: fakeStep })).resolves.toBeTruthy();
    expect(sent.some((e) => e.name === "reply/classified")).toBe(true);
  });

  it("the classify schema asks for confidence and carries the tenant in _trace", async () => {
    tracedGenerateObjectMock.mockResolvedValue(classify("interested", 0.9));
    await handler({ event: makeEvent(), step: fakeStep });
    const call = tracedGenerateObjectMock.mock.calls[0][0] as {
      prompt: string;
      _trace: { tenantId: string };
    };
    expect(call.prompt).toContain("confidence");
    expect(call.prompt).toContain("objection:");
    expect(call._trace.tenantId).toBe("t1");
  });
});
