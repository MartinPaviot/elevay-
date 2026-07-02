/**
 * M13 T6b — G2 (factual) gate on the chat compose path.
 *
 * generateFollowUpEmail and suggestEmailReply return drafts straight to the
 * founder's composer. Before this gate, a thin/absent research brief let the
 * model invent hard specifics (counts, named tech) that read as fabricated to
 * a real recipient. These tests drive the tools' execute() with the REAL
 * decideFabricationGate (pure) and boundary mocks everywhere else, asserting:
 *   - grounded draft (cached brief has facts) → draft returned, verdict pass
 *   - fabricated draft, no brief → blocked result, NO draft body, verdict blocked
 *   - brief lookup failure → fail-soft to the strictest posture (still blocks)
 *   - suggestEmailReply: blocked options dropped; pass / reworked / blocked
 *     verdicts; one gate row per option set
 *   - the path stays DETERMINISTIC-only (no semantic judge — grep guard)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const {
  selectResults,
  selectMock,
  gateRows,
  recordGateDecisionMock,
  recordGateDecisionsMock,
  tracedGenerateObjectMock,
  readCachedBriefMock,
  genOut,
} = vi.hoisted(() => {
  const selectResults: unknown[][] = [];
  const selectMock = vi.fn(() => ({
    from: () => ({
      where: () => ({
        limit: () => selectResults.shift() ?? [],
        orderBy: () => ({ limit: () => selectResults.shift() ?? [] }),
      }),
    }),
  }));
  const gateRows: Array<{
    tenantId: string;
    subjectType: string;
    subjectId: string;
    gate: number;
    rubricVersion: string;
    verdict: string;
    reasons?: Record<string, unknown>;
  }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recordGateDecisionMock = vi.fn(async (row: any) => {
    gateRows.push(row);
    return 1;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recordGateDecisionsMock = vi.fn(async (rows: any[]) => {
    gateRows.push(...rows);
    return rows.length;
  });
  const genOut: { value: unknown } = { value: {} };
  const tracedGenerateObjectMock = vi.fn(async () => ({ object: genOut.value }));
  const readCachedBriefMock = vi.fn();
  return {
    selectResults,
    selectMock,
    gateRows,
    recordGateDecisionMock,
    recordGateDecisionsMock,
    tracedGenerateObjectMock,
    readCachedBriefMock,
    genOut,
  };
});

vi.mock("@/db", () => ({
  db: {
    select: selectMock,
    insert: () => ({ values: () => ({ returning: () => [] }) }),
    update: () => ({ set: () => ({ where: () => [] }) }),
  },
}));

// Schema stub — vitest v4 validates named exports, so list the exact tables
// action.ts imports (each is only a drizzle table handle here, never read).
vi.mock("@/db/schema", () => ({
  activities: {}, comments: {}, companies: {}, connectedMailboxes: {},
  contacts: {}, deals: {}, emailOptouts: {}, outboundEmails: {},
  pendingInvites: {}, sequenceEnrollments: {}, sequenceSteps: {},
  sequences: {}, tasks: {}, tenants: {}, users: {},
}));

vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ and: a }),
  desc: (...a: unknown[]) => ({ desc: a }),
  eq: (...a: unknown[]) => ({ eq: a }),
  gte: (...a: unknown[]) => ({ gte: a }),
  inArray: (...a: unknown[]) => ({ inArray: a }),
  isNotNull: (...a: unknown[]) => ({ isNotNull: a }),
  isNull: (...a: unknown[]) => ({ isNull: a }),
  sql: (strings: TemplateStringsArray, ...exprs: unknown[]) => ({ sql: { strings, exprs } }),
}));

// Mock the `ai` package's `tool()` helper to an identity passthrough so
// `.execute` stays accessible (same pattern as chat-create-approval-gate).
vi.mock("ai", () => ({ tool: (cfg: unknown) => cfg }));

// BOUNDARY MOCKS — every heavy module action.ts statically imports gets
// mocked at its OWN boundary (never partially through a shared mock).
// decideFabricationGate stays REAL: it is pure and is the unit under test.
vi.mock("@/lib/anti-collision/enroll-guard", () => ({ guardEnrollment: vi.fn() }));
vi.mock("@/lib/emails/recipient-guardrail", () => ({
  isRecipientAllowed: vi.fn(() => true),
  recipientBlockReason: vi.fn(() => null),
}));
vi.mock("@/lib/ai/ai-provider", () => ({ anthropic: vi.fn(() => ({ modelId: "claude-mock" })) }));
vi.mock("@ai-sdk/openai", () => ({ openai: vi.fn(() => ({ modelId: "gpt-mock" })) }));
vi.mock("@/lib/ai/traced-ai", () => ({ tracedGenerateObject: tracedGenerateObjectMock }));
vi.mock("@/lib/context/prospect-context", () => ({ buildProspectContext: vi.fn() }));
vi.mock("@/lib/agents/sequence-generator", () => ({ generateSequence: vi.fn() }));
vi.mock("@/lib/sequences/enrollment", () => ({ pauseEnrollmentsForContacts: vi.fn() }));
vi.mock("@/lib/emails/email-invite", () => ({ sendInviteEmail: vi.fn() }));
vi.mock("@/lib/chat/ai-attributes", () => ({ runAiAttribute: vi.fn() }));
vi.mock("@/lib/chat/tool-call-log", () => ({ logToolCall: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/billing/plan-limits", () => ({ checkPlanLimit: vi.fn() }));
vi.mock("@/lib/auth/invite-token", () => ({ generateInviteToken: vi.fn() }));
vi.mock("@/lib/sequences/enrollment-eligibility", () => ({ checkContactEligibility: vi.fn() }));
vi.mock("@/lib/sequences/eligibility-context", () => ({ loadG1Context: vi.fn() }));
vi.mock("@/lib/sequences/suppression", () => ({
  loadSuppressedEmails: vi.fn(),
  isEmailSuppressed: vi.fn(() => false),
}));
vi.mock("@/lib/config/tenant-settings", () => ({ getTenantSettings: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/guardrails/approval-mode", () => ({
  readApprovalMode: vi.fn(() => "review-each"),
  enforceAgentApprovalMode: vi.fn(),
}));
vi.mock("@/lib/agents/agent-actions", () => ({ recordAgentAction: vi.fn() }));
vi.mock("@/lib/gates/gate-decisions", () => ({
  GATE_RUBRICS: {
    g1: "g1.enrollment.v1",
    g2Deterministic: "g2.det.v1",
    g4Step: "g4.step.v1",
    g4Sequence: "g4.sequence.v1",
    g5Transport: "g5.transport.v1",
  },
  recordGateDecision: recordGateDecisionMock,
  recordGateDecisions: recordGateDecisionsMock,
  g1DecisionRow: vi.fn(() => null),
}));
vi.mock("@/lib/campaign-engine/build-intelligence-brief", () => ({
  readCachedBrief: readCachedBriefMock,
  toResearchBriefContext: vi.fn((b: unknown) => b),
}));

const { buildActionTools } = await import("@/lib/chat/tools/action");
import type { ToolContext } from "@/lib/chat/tools/context";

const CONTACT = {
  id: "ct-1",
  firstName: "Jean",
  lastName: "Dupont",
  title: "CTO",
  email: "jean@acme.fr",
  companyId: "co-1",
};
const COMPANY = { id: "co-1", name: "Acme SA", domain: "acme.fr" };

/** A brief with sourced facts — briefHasFacts=true, deterministic layer stands down. */
const FACTUAL_BRIEF = {
  bestAngle: "They just migrated 3,848 projects to Supabase",
  painPoints: ["manual project tracking"],
  competitorDetected: null,
  publicContent: [{ type: "metric", title: "case study", quote: "3,848 projects on Supabase" }],
  warmthSignals: [],
};

// Hard specifics the empty-brief rule blocks by construction: a
// thousands-separated count qualifying a count-noun + a named tech token.
const FABRICATED_BODY =
  "Great chatting today — impressive that you run 3,848 projects on Supabase. Following up on our next steps.";
const CLEAN_BODY =
  "Thanks for the deep-dive today. Recapping next steps: I will send over the security doc and you will loop in your team.";

function makeCtx(): ToolContext {
  return {
    tenantId: "t1",
    userId: "u1",
    authCtx: { role: "member", appUserId: "u1", tenantId: "t1" },
    settings: {},
    agentApprovalMode: "review-each",
  } as unknown as ToolContext;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function run(tool: any, input: Record<string, unknown>) {
  return (tool.execute as (i: unknown, o?: unknown) => Promise<unknown>)(input, {});
}

beforeEach(() => {
  gateRows.length = 0;
  selectResults.length = 0;
  selectMock.mockClear();
  tracedGenerateObjectMock.mockClear();
  recordGateDecisionMock.mockClear();
  recordGateDecisionsMock.mockClear();
  readCachedBriefMock.mockReset();
  readCachedBriefMock.mockResolvedValue(null);
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateFollowUpEmail — G2 deterministic gate", () => {
  it("grounded (cached brief has facts): draft returned intact, verdict pass", async () => {
    selectResults.push([CONTACT], [COMPANY]);
    readCachedBriefMock.mockResolvedValue(FACTUAL_BRIEF);
    genOut.value = {
      subject: "Following up on our call",
      body: "You mentioned the 3,848 projects on Supabase — here is the rollout plan we discussed.",
      actionItems: ["send rollout plan"],
    };

    const tools = buildActionTools(makeCtx());
    const res = (await run(tools.generateFollowUpEmail, {
      contactId: "ct-1",
      context: "Call recap: discussed rollout plan.",
    })) as {
      blocked?: boolean;
      emailDraft?: { subject: string; body: string; actionItems: string[] };
    };

    expect(res.blocked).toBeUndefined();
    expect(res.emailDraft?.subject).toBe("Following up on our call");
    expect(res.emailDraft?.body).toContain("rollout plan");
    expect(res.emailDraft?.actionItems).toEqual(["send rollout plan"]);
    expect(readCachedBriefMock).toHaveBeenCalledWith("t1", "co-1", "ct-1");

    expect(gateRows).toHaveLength(1);
    expect(gateRows[0]).toMatchObject({
      tenantId: "t1",
      subjectType: "manual",
      subjectId: "ct-1",
      gate: 2,
      rubricVersion: "g2.det.v1",
      verdict: "pass",
    });
    expect(gateRows[0].reasons).toMatchObject({ briefHasFacts: true, path: "chat_follow_up" });
  });

  it("fabricated + no brief: blocked result, NO draft body, verdict blocked", async () => {
    selectResults.push([CONTACT], [COMPANY]);
    readCachedBriefMock.mockResolvedValue(null);
    genOut.value = { subject: "Quick follow-up", body: FABRICATED_BODY, actionItems: [] };

    const tools = buildActionTools(makeCtx());
    const res = (await run(tools.generateFollowUpEmail, {
      contactId: "ct-1",
      context: "Call recap.",
    })) as { blocked?: boolean; reason?: string; ungrounded?: string[]; emailDraft?: unknown };

    expect(res.blocked).toBe(true);
    expect(res.emailDraft).toBeUndefined();
    expect(res.ungrounded).toEqual(expect.arrayContaining(["3,848", "supabase"]));
    expect(res.reason).toContain("Unverifiable claim");
    // The fabricated body must not leak through any field of the result.
    expect(JSON.stringify(res)).not.toContain("impressive that you run");

    expect(gateRows).toHaveLength(1);
    expect(gateRows[0]).toMatchObject({
      subjectType: "manual",
      subjectId: "ct-1",
      gate: 2,
      rubricVersion: "g2.det.v1",
      verdict: "blocked",
    });
    expect(gateRows[0].reasons).toMatchObject({ briefHasFacts: false, path: "chat_follow_up" });
    expect(gateRows[0].reasons?.ungrounded).toEqual(expect.arrayContaining(["3,848", "supabase"]));
  });

  it("brief lookup failure: fail-soft to strictest posture — fabricated body still blocked, no crash", async () => {
    selectResults.push([CONTACT], [COMPANY]);
    readCachedBriefMock.mockRejectedValue(new Error("db down"));
    genOut.value = { subject: "Quick follow-up", body: FABRICATED_BODY, actionItems: [] };

    const tools = buildActionTools(makeCtx());
    const res = (await run(tools.generateFollowUpEmail, {
      contactId: "ct-1",
      context: "Call recap.",
    })) as { blocked?: boolean; emailDraft?: unknown };

    expect(res.blocked).toBe(true);
    expect(res.emailDraft).toBeUndefined();
    expect(gateRows[0]?.verdict).toBe("blocked");
  });

  it("no brief + no hard specifics: a generic follow-up still passes", async () => {
    selectResults.push([CONTACT], [COMPANY]);
    readCachedBriefMock.mockResolvedValue(null);
    genOut.value = { subject: "Next steps", body: CLEAN_BODY, actionItems: ["send security doc"] };

    const tools = buildActionTools(makeCtx());
    const res = (await run(tools.generateFollowUpEmail, {
      contactId: "ct-1",
      context: "Call recap.",
    })) as { blocked?: boolean; emailDraft?: { body: string } };

    expect(res.blocked).toBeUndefined();
    expect(res.emailDraft?.body).toBe(CLEAN_BODY);
    expect(gateRows[0]?.verdict).toBe("pass");
  });

  it("clean body but FABRICATED subject: blocked (the concatenation is gated, not the body alone)", async () => {
    selectResults.push([CONTACT], [COMPANY]);
    readCachedBriefMock.mockResolvedValue(null);
    genOut.value = {
      subject: "Congrats on your 4,200 Keycloak users",
      body: CLEAN_BODY,
      actionItems: [],
    };

    const tools = buildActionTools(makeCtx());
    const res = (await run(tools.generateFollowUpEmail, {
      contactId: "ct-1",
      context: "Call recap.",
    })) as { blocked?: boolean; ungrounded?: string[]; emailDraft?: unknown };

    expect(res.blocked).toBe(true);
    expect(res.emailDraft).toBeUndefined();
    expect(res.ungrounded).toEqual(expect.arrayContaining(["4,200"]));
    expect(gateRows[0]?.verdict).toBe("blocked");
  });

  it("fabricated ACTION ITEM: blocked like a fabricated body", async () => {
    selectResults.push([CONTACT], [COMPANY]);
    readCachedBriefMock.mockResolvedValue(null);
    genOut.value = {
      subject: "Next steps",
      body: CLEAN_BODY,
      actionItems: ["confirm the 8,900 store rollout"],
    };

    const tools = buildActionTools(makeCtx());
    const res = (await run(tools.generateFollowUpEmail, {
      contactId: "ct-1",
      context: "Call recap.",
    })) as { blocked?: boolean };

    expect(res.blocked).toBe(true);
    expect(gateRows[0]?.verdict).toBe("blocked");
  });
});

describe("suggestEmailReply — G2 deterministic gate per option", () => {
  const REPLY_INPUT = {
    emailContent: "Hi — could you tell me more about your onboarding?",
    senderName: "Claire Martin",
    senderEmail: "claire@bricks.co",
  };
  const CLEAN_BRIEF_REPLY = {
    tone: "brief",
    subject: "Re: onboarding",
    body: "Happy to help, Claire — does Thursday work for a quick call?",
  };
  const FABRICATED_REPLY = {
    tone: "detailed",
    subject: "Re: onboarding",
    body: "We could mirror the setup you run on Keycloak and roll it out to your 4,200 users next quarter.",
  };
  const CLEAN_DECLINE_REPLY = {
    tone: "decline",
    subject: "Re: onboarding",
    body: "This quarter is packed on our side. Can we revisit early next quarter?",
  };

  it("1 of 3 fabricated: survivors returned, one gate row, verdict reworked", async () => {
    genOut.value = { replies: [CLEAN_BRIEF_REPLY, FABRICATED_REPLY, CLEAN_DECLINE_REPLY] };

    const tools = buildActionTools(makeCtx());
    const res = (await run(tools.suggestEmailReply, REPLY_INPUT)) as {
      replies?: Array<{ tone: string }>;
      droppedOptions?: number;
      droppedReason?: string;
      blocked?: boolean;
    };

    expect(res.blocked).toBeUndefined();
    expect(res.replies?.map((r) => r.tone)).toEqual(["brief", "decline"]);
    expect(res.droppedOptions).toBe(1);
    expect(res.droppedReason).toContain("unverifiable specifics");

    expect(gateRows).toHaveLength(1);
    expect(gateRows[0]).toMatchObject({
      tenantId: "t1",
      subjectType: "manual",
      subjectId: "claire@bricks.co",
      gate: 2,
      rubricVersion: "g2.det.v1",
      verdict: "reworked",
    });
    expect(gateRows[0].reasons).toMatchObject({
      optionsBlocked: 1,
      optionsTotal: 3,
      briefHasFacts: false,
      path: "chat_suggest_reply",
    });
    expect(gateRows[0].reasons?.ungrounded).toEqual(expect.arrayContaining(["4,200", "keycloak"]));
  });

  it("all options fabricated: blocked explanation, NO replies, verdict blocked", async () => {
    genOut.value = {
      replies: [
        { tone: "brief", subject: "Re:", body: "Sure — we already power 12,500 users on Snowflake." },
        { tone: "detailed", subject: "Re:", body: "Our Kubernetes rollout handles 40,000 seats like yours." },
        { tone: "decline", subject: "Re:", body: "After MWC 2026 we can revisit your 8,900 stores." },
      ],
    };

    const tools = buildActionTools(makeCtx());
    const res = (await run(tools.suggestEmailReply, REPLY_INPUT)) as {
      blocked?: boolean;
      replies?: unknown;
      reason?: string;
      ungrounded?: string[];
    };

    expect(res.blocked).toBe(true);
    expect(res.replies).toBeUndefined();
    expect(res.reason).toContain("unverifiable specifics");
    expect(res.ungrounded?.length).toBeGreaterThan(0);
    expect(gateRows).toHaveLength(1);
    expect(gateRows[0].verdict).toBe("blocked");
    expect(gateRows[0].reasons).toMatchObject({ optionsBlocked: 3, optionsTotal: 3 });
  });

  it("all options clean: all 3 returned, verdict pass, nothing dropped", async () => {
    genOut.value = {
      replies: [
        CLEAN_BRIEF_REPLY,
        { tone: "detailed", subject: "Re:", body: "Onboarding takes about two weeks; happy to walk you through each step." },
        CLEAN_DECLINE_REPLY,
      ],
    };

    const tools = buildActionTools(makeCtx());
    const res = (await run(tools.suggestEmailReply, REPLY_INPUT)) as {
      replies?: Array<{ tone: string }>;
      droppedOptions?: number;
    };

    expect(res.replies).toHaveLength(3);
    expect(res.droppedOptions).toBeUndefined();
    expect(gateRows).toHaveLength(1);
    expect(gateRows[0].verdict).toBe("pass");
    expect(gateRows[0].reasons).toMatchObject({ optionsBlocked: 0, optionsTotal: 3 });
  });

  it("clean body but FABRICATED subject: that option is dropped (concatenation gated)", async () => {
    genOut.value = {
      replies: [
        CLEAN_BRIEF_REPLY,
        {
          tone: "detailed",
          subject: "Re: your 12,500 Snowflake seats",
          body: "Happy to walk you through onboarding whenever suits you.",
        },
        CLEAN_DECLINE_REPLY,
      ],
    };

    const tools = buildActionTools(makeCtx());
    const res = (await run(tools.suggestEmailReply, REPLY_INPUT)) as {
      replies?: Array<{ tone: string }>;
      droppedOptions?: number;
    };

    expect(res.replies?.map((r) => r.tone)).toEqual(["brief", "decline"]);
    expect(res.droppedOptions).toBe(1);
    expect(gateRows[0].verdict).toBe("reworked");
    expect(gateRows[0].reasons?.ungrounded).toEqual(expect.arrayContaining(["12,500"]));
  });
});

describe("the chat compose path stays deterministic-only (grep guard)", () => {
  it("action.ts never calls the semantic judge (judgeFabrication)", () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(__dirname, "..", "lib", "chat", "tools", "action.ts"), "utf-8");
    expect(src).toContain("decideFabricationGate");
    expect(src).not.toContain("judgeFabrication");
  });
});
