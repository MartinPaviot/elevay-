import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

/**
 * M13 T6b — the AUTO-mode sequence-step paths gate the FINAL body at the
 * insert seam (whatever produced it: legacy personalisation, template-only
 * fallback, or the copy-engine primary). Both seams, deterministic-only
 * (the semantic judge lives on the generator/reply paths):
 *  - legacy sendSequenceStep (inngest/functions.ts) via enqueueOutbound
 *  - V2 conductor tickEnrollmentV2 (lib/sequence/db-conductor.ts) sendEmail port
 * Pinned per seam:
 *  - clean body        -> queued unchanged (byte-identical disposition), "pass" logged
 *  - fabricated body   -> status "draft" + queuedAt null, "blocked" + autoSendDowngraded,
 *                         queued-stage/sent-activity side-effects skipped, NO stall
 *  - caller-verified ground truth (tenant templates, copy-engine whitelist)
 *    is never re-flagged
 * The fabrication gate is the REAL module (pure), driven by fabricated vs
 * clean bodies; @/db, @/db/schema, drizzle-orm and every other dependency are
 * mocked at their own module boundary with ALL accessed exports present.
 */

// ── Spies (referenced lazily inside factories — same pattern as
//    reply-handler-g2.test.ts) ──
const buildProspectContext = vi.fn();
const personalizeStepEmail = vi.fn();
const recordGateDecision = vi.fn();
const trackPipeline = vi.fn();
const getTenantSettings = vi.fn();
const isCopyEnginePrimaryEnabled = vi.fn();
const generateCopyMessage = vi.fn();
const persistShadowSample = vi.fn();
const resolveTenantCopyLang = vi.fn();
const decideRouteMode = vi.fn();

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
  sql: Object.assign((..._a: unknown[]) => ({ op: "sql" }), { raw: () => ({ op: "sql.raw" }) }),
}));

vi.mock("@/db/schema", () => ({
  companies: { __table: "companies", id: "id" },
  contacts: {
    __table: "contacts",
    id: "id",
    tenantId: "tenant_id",
    email: "email",
    companyId: "company_id",
    emailStatus: "email_status",
    firstName: "first_name",
    lastName: "last_name",
    title: "title",
  },
  sequenceSteps: { __table: "sequence_steps", sequenceId: "sequence_id", stepNumber: "step_number" },
  sequenceEnrollments: {
    __table: "sequence_enrollments",
    id: "id",
    contactId: "contact_id",
    sequenceId: "sequence_id",
    status: "status",
    currentStep: "current_step",
    nextStepAt: "next_step_at",
  },
  activities: { __table: "activities" },
  outboundEmails: {
    __table: "outbound_emails",
    id: "id",
    enrollmentId: "enrollment_id",
    stepNumber: "step_number",
    status: "status",
  },
  emailOptouts: { __table: "email_optouts", tenantId: "tenant_id", emailAddress: "email_address" },
  tenants: { __table: "tenants", id: "id", settings: "settings" },
}));

// The GLOBAL @/db mock: sequenced selects (legacy handler + enqueueOutbound's
// insert, which both seams route through). Inserts capture (table, values).
let dbSelects: unknown[][] = [];
let dbSelectCall = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbInserted: { table?: string; values: any }[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbUpdates: { table?: string; set: any }[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chainFor(result: unknown[]): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    limit: () => Promise.resolve(result),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };
  chain.from = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  return chain;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function insertReturn(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = Promise.resolve(undefined);
  p.returning = () => Promise.resolve([{ id: "email1" }]);
  p.onConflictDoNothing = () => Promise.resolve(undefined);
  return p;
}

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => chainFor((dbSelects[dbSelectCall++] ?? []) as unknown[])),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insert: vi.fn((table: any) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      values: (v: any) => {
        dbInserted.push({ table: table?.__table, values: v });
        return insertReturn();
      },
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: vi.fn((table: any) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set: (s: any) => {
        dbUpdates.push({ table: table?.__table, set: s });
        return { where: () => Promise.resolve(undefined) };
      },
    })),
  },
}));

// ── Boundary mocks for everything else functions.ts / db-conductor.ts import.
//    fabrication-gate, outbound-hold, and the sequence engine stay REAL. ──
vi.mock("@/lib/anti-collision/enroll-guard", () => ({
  releaseEnrollmentById: vi.fn(async () => undefined),
  releaseEnrollment: vi.fn(async () => undefined),
}));
vi.mock("@/lib/util/business-days", () => ({ addBusinessDays: (d: Date) => d }));
vi.mock("@/lib/config/tenant-settings", () => ({
  getTenantSettings: (...a: unknown[]) => getTenantSettings(...a),
}));
vi.mock("@/lib/sequence-dispatch/registry", () => ({ dispatchStep: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/sequences/enrollment", () => ({ pauseEnrollment: vi.fn(async () => undefined) }));
vi.mock("@/lib/ai/traced-ai", () => ({ tracedGenerateObject: vi.fn() }));
vi.mock("@/lib/ai/ai-provider", () => ({ anthropic: () => "anthropic-model" }));
vi.mock("@ai-sdk/openai", () => ({ openai: () => "openai-model" }));
vi.mock("@/lib/ai/embeddings", () => ({
  embedEntity: vi.fn(),
  companyToText: vi.fn(),
  contactToText: vi.fn(),
}));
vi.mock("@/lib/ai/ai-account-summary", () => ({ generateAccountSummary: vi.fn() }));
vi.mock("@/lib/context/prospect-context", () => ({
  buildProspectContext: (...a: unknown[]) => buildProspectContext(...a),
}));
vi.mock("@/lib/agents/sequence-generator", () => ({
  personalizeStepEmail: (...a: unknown[]) => personalizeStepEmail(...a),
}));
vi.mock("@/lib/scoring/outbound-methodologies", () => ({ STEP_STRATEGIES: [{ stepNumber: 1 }] }));
vi.mock("@/lib/copy/personalization/db-shadow", () => ({
  generateCopyMessage: (...a: unknown[]) => generateCopyMessage(...a),
  persistShadowSample: (...a: unknown[]) => persistShadowSample(...a),
  isCopyEnginePrimaryEnabled: (...a: unknown[]) => isCopyEnginePrimaryEnabled(...a),
}));
vi.mock("@/lib/copy/assets/db-store", () => ({
  resolveTenantCopyLang: (...a: unknown[]) => resolveTenantCopyLang(...a),
}));
vi.mock("@/lib/analytics/pipeline-tracker", () => ({
  trackPipeline: (...a: unknown[]) => trackPipeline(...a),
}));
vi.mock("@/lib/observability/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/sequence-drafts/router", () => ({
  decideRouteMode: (...a: unknown[]) => decideRouteMode(...a),
}));
vi.mock("@/lib/integrations/apollo-client", () => ({
  enrichOrganization: vi.fn(),
  employeeCountToRange: vi.fn(),
  revenueToRange: vi.fn(),
  isApolloAvailable: vi.fn(() => false),
}));
vi.mock("@/lib/providers/contact-enrichment/waterfall", () => ({ enrichContact: vi.fn() }));
vi.mock("@/lib/gates/gate-decisions", () => ({
  GATE_RUBRICS: { g2Deterministic: "g2.det.v1" },
  recordGateDecision: (...a: unknown[]) => recordGateDecision(...a),
}));
// V2-conductor-only dependencies.
vi.mock("@/lib/contacts/email/db-status", () => ({ isEmailKnownUnsendable: vi.fn(() => false) }));
vi.mock("@/lib/guardrails/sending-gate", () => ({ isSuppressed: vi.fn(async () => false) }));
vi.mock("@/lib/suppression/db-store", () => ({
  isSuppressedDb: vi.fn(async () => null),
  drizzleSuppressionLoader: vi.fn(() => ({})),
}));
vi.mock("@/lib/deliverability/db-guard", () => ({ guardTrippedForTenant: vi.fn(async () => false) }));

import { sendSequenceStep } from "@/inngest/functions";
import { tickEnrollmentV2 } from "@/lib/sequence/db-conductor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = (sendSequenceStep as any).handler;
const fakeStep = { run: (_n: string, fn: () => unknown) => fn() };

// Empty researchBrief -> the deterministic layer is ARMED (strict posture).
const ctxFixture = {
  contact: { id: "c1", fullName: "Ada Lovelace", title: "CTO" },
  company: { id: "co1", name: "Acme", domain: "acme.com" },
  researchBrief: undefined,
  aiTone: "Direct",
};

// No hard specifics -> passes the armed deterministic layer.
const CLEAN_BODY = "Hi Ada, noticed Acme is growing. Worth a quick chat about how we help teams like yours?";
// A named tool + a prospect-specific count with an empty brief -> blocked.
const FAB_BODY = "Hi Ada, saw you run n8n across 3,848 projects at Acme. Worth a chat?";
// Copy-engine body whose specifics are grounded ONLY by its own whitelist.
const COPY_BODY = "Saw Acme runs n8n for ops - one specific idea for your team.";
const COPY_GROUND_TRUTH = ["Acme uses n8n for internal automation"];

const DEFAULT_SUBJECT_TEMPLATE = "Quick question {{firstName}}";
const DEFAULT_BODY_TEMPLATE = "Hi {{firstName}}, wanted to reach out about your team.";

function legacySelects(overrides: { subjectTemplate?: string; bodyTemplate?: string } = {}): unknown[][] {
  return [
    // fetch-enrollment
    [{ id: "enr1", contactId: "c1", sequenceId: "seq1", status: "active", currentStep: 1 }],
    // fetch-tenant-mode: contact tenant, then tenant settings
    [{ tenantId: "t1" }],
    [{ settings: {} }],
    // fetch-step
    [{
      id: "st1",
      sequenceId: "seq1",
      stepNumber: 1,
      stepType: "email",
      subjectTemplate: overrides.subjectTemplate ?? DEFAULT_SUBJECT_TEMPLATE,
      bodyTemplate: overrides.bodyTemplate ?? DEFAULT_BODY_TEMPLATE,
      channelConfig: {},
    }],
    // fetch-contact
    [{ id: "c1", tenantId: "t1", companyId: "co1", email: "ada@acme.com", firstName: "Ada", lastName: "Lovelace", title: "CTO" }],
    // check-duplicate
    [],
    // check-optout
    [],
    // advanceEnrollment: no next step -> enrollment completed
    [],
  ];
}

function v2Selects(): unknown[][] {
  return [
    // enrollment row (due in the past so the engine acts now)
    [{ id: "enr1", contactId: "c1", sequenceId: "seq1", status: "active", currentStep: 1, nextStepAt: new Date(Date.now() - 60_000) }],
    // contact
    [{ id: "c1", email: "ada@acme.com", tenantId: "t1", companyId: "co1", emailStatus: "valid", firstName: "Ada", lastName: "Lovelace", title: "CTO" }],
    // tenant settings (manual-mode bail check)
    [{ settings: {} }],
    // stepRows
    [{ id: "st1", stepNumber: 1, stepType: "email", subjectTemplate: DEFAULT_SUBJECT_TEMPLATE, bodyTemplate: DEFAULT_BODY_TEMPLATE, delayDays: 0 }],
    // existing outbounds (idempotency)
    [],
  ];
}

/** An injected V2 database (tickEnrollmentV2's second arg) with its own captures. */
function makeV2Db(selects: unknown[][]) {
  let call = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inserted: { table?: string; values: any }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: { table?: string; set: any }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database: any = {
    select: () => chainFor((selects[call++] ?? []) as unknown[]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insert: (table: any) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      values: (v: any) => {
        inserted.push({ table: table?.__table, values: v });
        return insertReturn();
      },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (table: any) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set: (s: any) => {
        updates.push({ table: table?.__table, set: s });
        return { where: () => Promise.resolve(undefined) };
      },
    }),
  };
  return { database, inserted, updates };
}

const outboundRows = () => dbInserted.filter((r) => r.table === "outbound_emails");
const activityRows = () => dbInserted.filter((r) => r.table === "activities");

// The suite must run the LEGACY path through the handler; keep the V2 flag off
// and restore whatever the worker env had.
const ORIG_V2_FLAG = process.env.SEQUENCE_ENGINE_V2;
afterAll(() => {
  if (ORIG_V2_FLAG === undefined) delete process.env.SEQUENCE_ENGINE_V2;
  else process.env.SEQUENCE_ENGINE_V2 = ORIG_V2_FLAG;
});

beforeEach(() => {
  delete process.env.SEQUENCE_ENGINE_V2;
  dbSelects = [];
  dbSelectCall = 0;
  dbInserted.length = 0;
  dbUpdates.length = 0;

  buildProspectContext.mockReset().mockResolvedValue(ctxFixture);
  personalizeStepEmail.mockReset().mockResolvedValue({ subject: "Quick question Ada", body: CLEAN_BODY });
  recordGateDecision.mockReset().mockResolvedValue(1);
  trackPipeline.mockReset().mockResolvedValue(undefined);
  getTenantSettings.mockReset().mockResolvedValue({});
  isCopyEnginePrimaryEnabled.mockReset().mockReturnValue(false);
  generateCopyMessage.mockReset().mockResolvedValue({ ran: false, reason: "no_prospect_context" });
  persistShadowSample.mockReset().mockResolvedValue(undefined);
  resolveTenantCopyLang.mockReset().mockResolvedValue("en");
  decideRouteMode.mockReset().mockReturnValue("auto");
});

describe("sendSequenceStep (legacy auto path) — G2 at the insert seam", () => {
  it("clean body -> queued unchanged (byte-identical disposition), verdict pass logged on the row id", async () => {
    dbSelects = legacySelects();

    const res = await handler({ event: { data: { enrollmentId: "enr1" } }, step: fakeStep });
    expect(res).toMatchObject({ enrollmentId: "enr1", sent: true, step: 1 });

    expect(outboundRows()).toHaveLength(1);
    const row = outboundRows()[0].values;
    expect(row).toMatchObject({
      tenantId: "t1",
      status: "queued",
      bodyText: CLEAN_BODY,
      toAddress: "ada@acme.com",
      fromAddress: "pending@rotation",
      stepNumber: 1,
      errorMessage: null,
    });
    expect(row.queuedAt).toBeTruthy();
    expect(row.holdUntil).toBeNull();

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
    expect(logged.reasons).toMatchObject({ path: "sequence_step_auto", briefHasFacts: false, ungrounded: [] });
    expect(logged.reasons.autoSendDowngraded).toBeUndefined();

    // Clean path keeps its side-effects.
    expect(trackPipeline).toHaveBeenCalledTimes(1);
    expect(activityRows()).toHaveLength(1);
  });

  it("fabricated body -> draft + queuedAt null, blocked + autoSendDowngraded, side-effects skipped, no stall", async () => {
    dbSelects = legacySelects();
    personalizeStepEmail.mockResolvedValue({ subject: "Quick question Ada", body: FAB_BODY });

    const res = await handler({ event: { data: { enrollmentId: "enr1" } }, step: fakeStep });
    expect(res).toMatchObject({ enrollmentId: "enr1", sent: false, step: 1 });
    expect(String(res.reason)).toContain("g2_fabrication_blocked");

    expect(outboundRows()).toHaveLength(1);
    const row = outboundRows()[0].values;
    expect(row).toMatchObject({ status: "draft", bodyText: FAB_BODY });
    expect(row.queuedAt).toBeNull();
    expect(row.holdUntil).toBeNull();

    const logged = recordGateDecision.mock.calls[0][0];
    expect(logged).toMatchObject({ subjectType: "draft", subjectId: "email1", gate: 2, verdict: "blocked" });
    expect(logged.reasons).toMatchObject({ path: "sequence_step_auto", autoSendDowngraded: true, briefHasFacts: false });
    expect(logged.reasons.ungrounded).toEqual(expect.arrayContaining(["n8n"]));
    expect(logged.reasons.ungrounded.length).toBeLessThanOrEqual(8);

    // Neither queued nor sent -> no queued pipeline stage, no sent activity.
    expect(trackPipeline).not.toHaveBeenCalled();
    expect(activityRows()).toHaveLength(0);
    // The enrollment still advances (here: completes) — a blocked step must
    // not stall the sequence behind the idempotency check.
    expect(dbUpdates).toHaveLength(1);
    expect(dbUpdates[0]).toMatchObject({ table: "sequence_enrollments" });
    expect(dbUpdates[0].set).toMatchObject({ status: "completed" });
  });

  it("template-only fallback: tenant-authored template specifics are ground truth -> queued, pass", async () => {
    dbSelects = legacySelects({ bodyTemplate: "Hi {{firstName}}, we help Salesforce teams move faster." });
    personalizeStepEmail.mockRejectedValue(new Error("model down"));

    const res = await handler({ event: { data: { enrollmentId: "enr1" } }, step: fakeStep });
    expect(res).toMatchObject({ sent: true });

    const row = outboundRows()[0].values;
    expect(row).toMatchObject({
      status: "queued",
      bodyText: "Hi Ada, we help Salesforce teams move faster.",
      errorMessage: "[fallback:llm_personalize_threw] sent with template-only personalisation",
    });
    expect(recordGateDecision.mock.calls[0][0].verdict).toBe("pass");
  });

  it("copy-engine primary body: the source-verified whitelist rides through -> grounded specifics not re-flagged", async () => {
    dbSelects = legacySelects();
    isCopyEnginePrimaryEnabled.mockReturnValue(true);
    generateCopyMessage.mockResolvedValue({
      ran: true,
      message: { body: COPY_BODY, personalization_level: "high", flags: [] },
      evidenceCount: 1,
      groundTruth: COPY_GROUND_TRUTH,
    });

    const res = await handler({ event: { data: { enrollmentId: "enr1" } }, step: fakeStep });
    expect(res).toMatchObject({ sent: true });

    const row = outboundRows()[0].values;
    // "n8n" appears in the copy body but is grounded by the copy engine's own
    // whitelist — the seam gate must not downgrade a source-gate PASS.
    expect(row).toMatchObject({ status: "queued", bodyText: COPY_BODY });
    expect(persistShadowSample).toHaveBeenCalledTimes(1);
    const logged = recordGateDecision.mock.calls[0][0];
    expect(logged.verdict).toBe("pass");
    expect(logged.reasons).toMatchObject({ path: "sequence_step_auto", ungrounded: [] });
  });

  it("brief with sourced facts flows out of the personalize step -> deterministic layer stays disarmed", async () => {
    dbSelects = legacySelects();
    buildProspectContext.mockResolvedValue({ ...ctxFixture, researchBrief: { bestAngle: "hiring push" } });
    personalizeStepEmail.mockResolvedValue({ subject: "Quick question Ada", body: FAB_BODY });

    const res = await handler({ event: { data: { enrollmentId: "enr1" } }, step: fakeStep });
    // By design the deterministic layer only fires on an EMPTY brief — a real
    // brief must not get its crawled specifics punished (fabrication-gate.ts).
    expect(res).toMatchObject({ sent: true });
    expect(outboundRows()[0].values).toMatchObject({ status: "queued" });
    const logged = recordGateDecision.mock.calls[0][0];
    expect(logged.verdict).toBe("pass");
    expect(logged.reasons).toMatchObject({ briefHasFacts: true });
  });
});

describe("tickEnrollmentV2 (V2 conductor) — G2 at the insert seam", () => {
  it("clean body -> queued unchanged, verdict pass logged (path sequence_step_v2) via the injected database", async () => {
    const { database, inserted, updates } = makeV2Db(v2Selects());

    const outcome = await tickEnrollmentV2("enr1", database);
    expect(outcome).toMatchObject({ ran: true, status: "completed", currentStepIndex: 1 });

    // enqueueOutbound routes through the global @/db seam.
    expect(outboundRows()).toHaveLength(1);
    const row = outboundRows()[0].values;
    expect(row).toMatchObject({
      tenantId: "t1",
      status: "queued",
      bodyText: CLEAN_BODY,
      toAddress: "ada@acme.com",
      fromAddress: "pending@rotation",
      stepNumber: 1,
    });
    expect(row.queuedAt).toBeTruthy();
    expect(row.holdUntil).toBeNull();

    expect(recordGateDecision).toHaveBeenCalledTimes(1);
    const [loggedRow, loggedDb] = recordGateDecision.mock.calls[0];
    expect(loggedRow).toMatchObject({
      tenantId: "t1",
      subjectType: "draft",
      subjectId: "email1",
      gate: 2,
      rubricVersion: "g2.det.v1",
      verdict: "pass",
    });
    expect(loggedRow.reasons).toMatchObject({ path: "sequence_step_v2", briefHasFacts: false, ungrounded: [] });
    expect(loggedDb).toBe(database); // honours the conductor's injection seam

    expect(trackPipeline).toHaveBeenCalledTimes(1);
    expect(inserted.filter((r) => r.table === "activities")).toHaveLength(1);
    expect(updates[0].set).toMatchObject({ status: "completed", currentStep: 2 });
  });

  it("fabricated body -> draft + queuedAt null, blocked + autoSendDowngraded, engine still advances (no stall)", async () => {
    const { database, inserted, updates } = makeV2Db(v2Selects());
    personalizeStepEmail.mockResolvedValue({ subject: "Quick question Ada", body: FAB_BODY });

    const outcome = await tickEnrollmentV2("enr1", database);
    expect(outcome).toMatchObject({ ran: true, status: "completed", currentStepIndex: 1 });

    expect(outboundRows()).toHaveLength(1);
    const row = outboundRows()[0].values;
    expect(row).toMatchObject({ status: "draft", bodyText: FAB_BODY });
    expect(row.queuedAt).toBeNull();
    expect(row.holdUntil).toBeNull();

    const loggedRow = recordGateDecision.mock.calls[0][0];
    expect(loggedRow).toMatchObject({ subjectType: "draft", subjectId: "email1", gate: 2, verdict: "blocked" });
    expect(loggedRow.reasons).toMatchObject({ path: "sequence_step_v2", autoSendDowngraded: true, briefHasFacts: false });
    expect(loggedRow.reasons.ungrounded).toEqual(expect.arrayContaining(["n8n"]));

    // Neither queued nor sent -> no queued pipeline stage, no sent activity —
    // but the engine marks the step handled so the sequence never stalls.
    expect(trackPipeline).not.toHaveBeenCalled();
    expect(inserted.filter((r) => r.table === "activities")).toHaveLength(0);
    expect(updates[0].set).toMatchObject({ status: "completed", currentStep: 2 });
  });

  it("copy-engine primary body (V2): the source-verified whitelist rides through -> pass", async () => {
    const { database } = makeV2Db(v2Selects());
    isCopyEnginePrimaryEnabled.mockReturnValue(true);
    generateCopyMessage.mockResolvedValue({
      ran: true,
      message: { body: COPY_BODY, personalization_level: "high", flags: [] },
      evidenceCount: 1,
      groundTruth: COPY_GROUND_TRUTH,
    });

    const outcome = await tickEnrollmentV2("enr1", database);
    expect(outcome).toMatchObject({ ran: true, status: "completed" });

    const row = outboundRows()[0].values;
    expect(row).toMatchObject({ status: "queued", bodyText: COPY_BODY });
    const loggedRow = recordGateDecision.mock.calls[0][0];
    expect(loggedRow.verdict).toBe("pass");
    expect(loggedRow.reasons).toMatchObject({ path: "sequence_step_v2", ungrounded: [] });
  });
});
