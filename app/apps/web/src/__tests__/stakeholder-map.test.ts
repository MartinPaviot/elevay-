/**
 * Tests for stakeholder-map.ts
 *
 * Tests the pure computation functions: role classification via keyword
 * matching, engagement scoring, sentiment computation, influence scoring,
 * gap analysis, and the deterministic strategy builder.
 *
 * Uses mocked DB and LLM to test the main buildStakeholderMap function.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ───────────────────────────────────────────────

const { selectChainMock, updateChainMock, tracedGenerateTextMock } = vi.hoisted(() => ({
  selectChainMock: vi.fn(),
  updateChainMock: vi.fn(),
  tracedGenerateTextMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => selectChainMock(),
    update: () => updateChainMock(),
  },
}));

vi.mock("@/db/schema", () => ({
  deals: {
    id: "id",
    tenantId: "tenant_id",
    name: "name",
    contactId: "contact_id",
    companyId: "company_id",
    properties: "properties",
    updatedAt: "updated_at",
  },
  contacts: {
    id: "id",
    tenantId: "tenant_id",
    companyId: "company_id",
    firstName: "first_name",
    lastName: "last_name",
    email: "email",
    title: "title",
  },
  companies: {
    id: "id",
  },
  activities: {
    id: "id",
    tenantId: "tenant_id",
    entityType: "entity_type",
    entityId: "entity_id",
    activityType: "activity_type",
    direction: "direction",
    occurredAt: "occurred_at",
    rawContent: "raw_content",
    summary: "summary",
    sentiment: "sentiment",
    metadata: "metadata",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ and: args }),
  eq: (...args: unknown[]) => ({ eq: args }),
  or: (...args: unknown[]) => args[0],
  desc: (x: unknown) => ({ desc: x }),
  gte: (...args: unknown[]) => ({ gte: args }),
  sql: (strings: TemplateStringsArray, ...exprs: unknown[]) => ({
    sql: { strings, exprs },
  }),
}));

vi.mock("@/lib/traced-ai", () => ({
  tracedGenerateText: (...args: unknown[]) => tracedGenerateTextMock(...args),
}));

vi.mock("@/lib/ai-provider", () => ({
  anthropic: (m: string) => `mock-${m}`,
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: (m: string) => `mock-${m}`,
}));

const { buildStakeholderMap } = await import("@/lib/analysis/stakeholder-map");

// ── Test helpers ────────────────────────────────────────────────

/**
 * Thenable chain: every method returns self, `await` resolves to rows.
 */
function chainOf(rows: unknown[]): unknown {
  const self: Record<string, unknown> = {};
  for (const m of [
    "from",
    "where",
    "limit",
    "orderBy",
    "groupBy",
    "innerJoin",
    "leftJoin",
  ]) {
    self[m] = () => self;
  }
  self.then = (
    resolve: (v: unknown) => void,
    reject: (e: unknown) => void,
  ) => Promise.resolve(rows).then(resolve, reject);
  return self;
}

function setupDbCalls(overrides: {
  deal?: Record<string, unknown> | null;
  contacts?: unknown[];
  contactActivities?: unknown[];
  dealActivities?: unknown[];
}) {
  let callIdx = 0;

  selectChainMock.mockImplementation(() => {
    callIdx++;

    switch (callIdx) {
      case 1: // deal lookup
        return chainOf(overrides.deal ? [overrides.deal] : []);
      case 2: // contacts
        return chainOf(overrides.contacts || []);
      case 3: // contact activities
        return chainOf(overrides.contactActivities || []);
      case 4: // deal activities
        return chainOf(overrides.dealActivities || []);
      default:
        return chainOf([]);
    }
  });

  updateChainMock.mockReturnValue({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  });
}

const baseDeal = {
  id: "deal-1",
  name: "Acme Corp Deal",
  contactId: "c1",
  companyId: "co1",
  properties: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

// ── Champion Detection ──────────────────────────────────────────

describe("champion role detection", () => {
  it("classifies contact as champion with positive sentiment + advocacy keywords + high engagement", async () => {
    setupDbCalls({
      deal: baseDeal,
      contacts: [
        { id: "c1", firstName: "Sarah", lastName: "Chen", email: "sarah@acme.com", title: "Product Director", companyId: "co1" },
      ],
      contactActivities: [
        { entityId: "c1", activityType: "email_sent", direction: "outbound", occurredAt: new Date(), rawContent: null, summary: "I love this solution and I am excited to advocate internally for it", sentiment: "positive", metadata: { cc: ["boss@acme.com", "cto@acme.com"] } },
        { entityId: "c1", activityType: "email_sent", direction: "outbound", occurredAt: new Date(), rawContent: null, summary: "I will push for fast-track approval", sentiment: "positive", metadata: {} },
        { entityId: "c1", activityType: "email_sent", direction: "outbound", occurredAt: new Date(), rawContent: null, summary: "Getting buy-in from the team", sentiment: "positive", metadata: { cc: ["vp@acme.com"] } },
        { entityId: "c1", activityType: "meeting_completed", direction: null, occurredAt: new Date(), rawContent: null, summary: "Demo session with champion", sentiment: "positive", metadata: {} },
        { entityId: "c1", activityType: "meeting_completed", direction: null, occurredAt: new Date(), rawContent: null, summary: "Follow-up meeting", sentiment: "positive", metadata: {} },
        { entityId: "c1", activityType: "meeting_completed", direction: null, occurredAt: new Date(), rawContent: null, summary: "Technical review", sentiment: null, metadata: {} },
      ],
    });

    const result = await buildStakeholderMap("deal-1", "tenant-1");
    expect(result.stakeholders.length).toBe(1);
    expect(result.stakeholders[0].role).toBe("champion");
    expect(result.coverage.hasChampion).toBe(true);
  });

  it("does not classify contact as champion without enough signals", async () => {
    setupDbCalls({
      deal: baseDeal,
      contacts: [
        { id: "c1", firstName: "Tom", lastName: "Generic", email: "tom@acme.com", title: "Analyst", companyId: "co1" },
      ],
      contactActivities: [
        { entityId: "c1", activityType: "email_received", direction: "inbound", occurredAt: new Date(), rawContent: null, summary: "Please send more info", sentiment: "neutral", metadata: {} },
      ],
    });

    const result = await buildStakeholderMap("deal-1", "tenant-1");
    expect(result.stakeholders[0].role).not.toBe("champion");
  });
});

// ── Economic Buyer Detection ────────────────────────────────────

describe("economic buyer detection", () => {
  it("classifies C-level contact discussing pricing as economic buyer", async () => {
    setupDbCalls({
      deal: baseDeal,
      contacts: [
        { id: "c1", firstName: "David", lastName: "CFO", email: "david@acme.com", title: "Chief Financial Officer", companyId: "co1" },
      ],
      contactActivities: [
        { entityId: "c1", activityType: "email_received", direction: "inbound", occurredAt: new Date(), rawContent: null, summary: "What is the total cost? We need to review budget allocation and get procurement approval", sentiment: "neutral", metadata: {} },
        { entityId: "c1", activityType: "email_received", direction: "inbound", occurredAt: new Date(), rawContent: null, summary: "Please send the contract for our legal team to review the ROI and investment details", sentiment: "neutral", metadata: {} },
      ],
    });

    const result = await buildStakeholderMap("deal-1", "tenant-1");
    expect(result.stakeholders[0].role).toBe("economic_buyer");
    expect(result.coverage.hasEconomicBuyer).toBe(true);
  });

  it("assigns high influence to C-suite contacts", async () => {
    setupDbCalls({
      deal: baseDeal,
      contacts: [
        { id: "c1", firstName: "CEO", lastName: "Boss", email: "ceo@acme.com", title: "CEO", companyId: "co1" },
      ],
      contactActivities: [
        { entityId: "c1", activityType: "email_received", direction: "inbound", occurredAt: new Date(), rawContent: null, summary: "Reviewing the proposal", sentiment: "neutral", metadata: {} },
      ],
    });

    const result = await buildStakeholderMap("deal-1", "tenant-1");
    expect(result.stakeholders[0].influence).toBe("high");
  });
});

// ── Blocker Detection ───────────────────────────────────────────

describe("blocker detection", () => {
  it("identifies blocker from negative sentiment + objection keywords", async () => {
    setupDbCalls({
      deal: baseDeal,
      contacts: [
        { id: "c1", firstName: "Karen", lastName: "Blocker", email: "karen@acme.com", title: "IT Manager", companyId: "co1" },
      ],
      contactActivities: [
        { entityId: "c1", activityType: "email_received", direction: "inbound", occurredAt: new Date(), rawContent: null, summary: "I have serious concerns about this. Not convinced this is the right approach and we should delay.", sentiment: "negative", metadata: {} },
        { entityId: "c1", activityType: "email_received", direction: "inbound", occurredAt: new Date(), rawContent: null, summary: "We should push back on the timeline. This is premature and I am hesitant to proceed.", sentiment: "negative", metadata: {} },
        { entityId: "c1", activityType: "email_received", direction: "inbound", occurredAt: new Date(), rawContent: null, summary: "We already have a solution. Not sure why we would risk switching.", sentiment: "negative", metadata: {} },
      ],
    });

    const result = await buildStakeholderMap("deal-1", "tenant-1");
    expect(result.stakeholders[0].role).toBe("blocker");
    expect(result.stakeholders[0].sentiment).toBe("negative");
    expect(result.coverage.hasBlocker).toBe(true);
  });

  it("generates gap warning for blockers", async () => {
    setupDbCalls({
      deal: baseDeal,
      contacts: [
        { id: "c1", firstName: "Karen", lastName: "Blocker", email: "karen@acme.com", title: "IT Manager", companyId: "co1" },
      ],
      contactActivities: [
        { entityId: "c1", activityType: "email_received", direction: "inbound", occurredAt: new Date(), rawContent: null, summary: "I have concern about risk and I am not convinced this is needed. We should postpone.", sentiment: "negative", metadata: {} },
        { entityId: "c1", activityType: "email_received", direction: "inbound", occurredAt: new Date(), rawContent: null, summary: "This feels premature, we should wait and revisit later.", sentiment: "negative", metadata: {} },
      ],
    });

    const result = await buildStakeholderMap("deal-1", "tenant-1");
    const blockerGap = result.gaps.find((g) => g.includes("blocker"));
    expect(blockerGap).toBeDefined();
  });
});

// ── Coverage Gap Analysis ───────────────────────────────────────

describe("coverage gap analysis", () => {
  it("flags missing champion when no champion identified", async () => {
    setupDbCalls({
      deal: baseDeal,
      contacts: [
        { id: "c1", firstName: "Tom", lastName: "User", email: "tom@acme.com", title: "Analyst", companyId: "co1" },
      ],
      contactActivities: [
        { entityId: "c1", activityType: "email_received", direction: "inbound", occurredAt: new Date(), rawContent: null, summary: "Here is my daily workflow requirement", sentiment: "neutral", metadata: {} },
      ],
    });

    const result = await buildStakeholderMap("deal-1", "tenant-1");
    expect(result.coverage.hasChampion).toBe(false);
    const championGap = result.gaps.find((g) =>
      g.toLowerCase().includes("no champion"),
    );
    expect(championGap).toBeDefined();
  });

  it("does not flag champion gap when champion exists", async () => {
    setupDbCalls({
      deal: baseDeal,
      contacts: [
        { id: "c1", firstName: "Sarah", lastName: "Fan", email: "sarah@acme.com", title: "Director of Ops", companyId: "co1" },
      ],
      contactActivities: [
        { entityId: "c1", activityType: "email_sent", direction: "outbound", occurredAt: new Date(), rawContent: null, summary: "I love this, exactly what we need. I will advocate and push for fast-track approval.", sentiment: "positive", metadata: { cc: ["boss@acme.com", "team@acme.com"] } },
        { entityId: "c1", activityType: "email_sent", direction: "outbound", occurredAt: new Date(), rawContent: null, summary: "Getting buy-in from the team, sponsor wants to see this succeed", sentiment: "positive", metadata: {} },
        { entityId: "c1", activityType: "email_sent", direction: "outbound", occurredAt: new Date(), rawContent: null, summary: "Excited about the progress, I am convinced this is the solution", sentiment: "positive", metadata: {} },
        { entityId: "c1", activityType: "meeting_completed", direction: null, occurredAt: new Date(), rawContent: null, summary: "Champion demo review", sentiment: "positive", metadata: {} },
        { entityId: "c1", activityType: "meeting_completed", direction: null, occurredAt: new Date(), rawContent: null, summary: "Follow-up session", sentiment: "positive", metadata: {} },
        { entityId: "c1", activityType: "meeting_completed", direction: null, occurredAt: new Date(), rawContent: null, summary: "Final review", sentiment: null, metadata: {} },
      ],
    });

    const result = await buildStakeholderMap("deal-1", "tenant-1");
    expect(result.coverage.hasChampion).toBe(true);
    const championGap = result.gaps.find((g) =>
      g.toLowerCase().includes("no champion identified"),
    );
    expect(championGap).toBeUndefined();
  });
});

// ── Influence Scoring ───────────────────────────────────────────

describe("influence scoring", () => {
  it("assigns high influence to contacts who CC many people", async () => {
    setupDbCalls({
      deal: baseDeal,
      contacts: [
        { id: "c1", firstName: "Alice", lastName: "Network", email: "alice@acme.com", title: "Head of Product", companyId: "co1" },
      ],
      contactActivities: [
        { entityId: "c1", activityType: "email_received", direction: "inbound", occurredAt: new Date(), rawContent: null, summary: "Forwarding to the team", sentiment: "neutral", metadata: { cc: ["a@acme.com", "b@acme.com", "c@acme.com", "d@acme.com"] } },
      ],
    });

    const result = await buildStakeholderMap("deal-1", "tenant-1");
    // Head of = manager seniority = medium, but 4 CCs bumps to medium at least
    expect(["high", "medium"]).toContain(result.stakeholders[0].influence);
  });

  it("assigns low influence to individual contributors with no CC patterns", async () => {
    setupDbCalls({
      deal: baseDeal,
      contacts: [
        { id: "c1", firstName: "Junior", lastName: "Dev", email: "junior@acme.com", title: "Software Developer", companyId: "co1" },
      ],
      contactActivities: [
        { entityId: "c1", activityType: "email_received", direction: "inbound", occurredAt: new Date(), rawContent: null, summary: "Regular question", sentiment: "neutral", metadata: {} },
      ],
    });

    const result = await buildStakeholderMap("deal-1", "tenant-1");
    expect(result.stakeholders[0].influence).toBe("low");
  });
});

// ── Edge Cases ──────────────────────────────────────────────────

describe("edge cases", () => {
  it("returns empty map when deal has no contacts", async () => {
    setupDbCalls({
      deal: { ...baseDeal, contactId: null, companyId: null },
      contacts: [],
    });

    const result = await buildStakeholderMap("deal-1", "tenant-1");
    expect(result.stakeholders).toEqual([]);
    expect(result.coverage.hasChampion).toBe(false);
  });

  it("returns error gap when deal is not found", async () => {
    setupDbCalls({ deal: null });

    const result = await buildStakeholderMap("nonexistent", "tenant-1");
    expect(result.gaps).toContain("Deal not found");
  });
});
