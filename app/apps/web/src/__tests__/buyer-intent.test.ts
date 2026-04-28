/**
 * Tests for buyer-intent.ts
 *
 * Tests the pure signal scoring functions by exercising scoreBuyerIntent
 * with mocked DB data. Each signal type is tested independently by
 * constructing activity sets that target specific scoring paths.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ───────────────────────────────────────────────

const { selectChainMock } = vi.hoisted(() => ({
  selectChainMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => selectChainMock(),
  },
}));

vi.mock("@/db/schema", () => ({
  activities: {
    id: "id",
    tenantId: "tenant_id",
    entityType: "entity_type",
    entityId: "entity_id",
    activityType: "activity_type",
    direction: "direction",
    summary: "summary",
    occurredAt: "occurred_at",
    rawContent: "raw_content",
  },
  contacts: {
    id: "id",
    tenantId: "tenant_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ and: args }),
  eq: (...args: unknown[]) => ({ eq: args }),
  desc: (x: unknown) => ({ desc: x }),
  gte: (...args: unknown[]) => ({ gte: args }),
  sql: (strings: TemplateStringsArray, ...exprs: unknown[]) => ({
    sql: { strings, exprs },
  }),
}));

const { scoreBuyerIntent } = await import("@/lib/scoring/buyer-intent");

// ── Test helpers ────────────────────────────────────────────────

function setActivities(rows: unknown[]) {
  selectChainMock.mockReturnValue({
    from: () => ({
      where: () => ({
        orderBy: () => Promise.resolve(rows),
      }),
    }),
  });
}

function makeActivity(overrides: Partial<{
  activityType: string;
  direction: string;
  occurredAt: Date;
  rawContent: string;
  summary: string;
}>) {
  return {
    activityType: overrides.activityType || "email_received",
    direction: overrides.direction || "inbound",
    occurredAt: overrides.occurredAt || new Date(),
    rawContent: overrides.rawContent || null,
    summary: overrides.summary || null,
  };
}

beforeEach(() => {
  selectChainMock.mockReset();
});

// ── Response Time Scoring ───────────────────────────────────────

describe("response time scoring", () => {
  it("scores high when replies come within 1 hour", async () => {
    const now = new Date();
    const outboundTime = new Date(now.getTime() - 2 * 3600000); // 2h ago
    const inboundTime = new Date(outboundTime.getTime() + 30 * 60000); // 30min later

    setActivities([
      makeActivity({ activityType: "email_sent", direction: "outbound", occurredAt: outboundTime }),
      makeActivity({ activityType: "email_received", direction: "inbound", occurredAt: inboundTime, rawContent: "Thanks!" }),
    ]);

    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    const rtSignal = result.signals.find((s) => s.type === "response_time");
    expect(rtSignal).toBeDefined();
    expect(rtSignal!.value).toBe(1.0); // <1h => 1.0
  });

  it("scores low when replies come after 3+ days", async () => {
    const now = new Date();
    const outboundTime = new Date(now.getTime() - 10 * 86400000); // 10d ago
    const inboundTime = new Date(outboundTime.getTime() + 4 * 86400000); // 4d later

    setActivities([
      makeActivity({ activityType: "email_sent", direction: "outbound", occurredAt: outboundTime }),
      makeActivity({ activityType: "email_received", direction: "inbound", occurredAt: inboundTime, rawContent: "Got it" }),
    ]);

    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    const rtSignal = result.signals.find((s) => s.type === "response_time");
    expect(rtSignal!.value).toBeLessThanOrEqual(0.1);
  });
});

// ── Meeting Acceptance ──────────────────────────────────────────

describe("meeting acceptance scoring", () => {
  it("scores high when all meetings are accepted and completed", async () => {
    const now = new Date();
    setActivities([
      makeActivity({ activityType: "meeting_scheduled", occurredAt: now }),
      makeActivity({ activityType: "meeting_scheduled", occurredAt: now }),
      makeActivity({ activityType: "meeting_completed", occurredAt: now }),
      makeActivity({ activityType: "meeting_completed", occurredAt: now }),
    ]);

    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    const meetingSignal = result.signals.find((s) => s.type === "meeting_acceptance");
    expect(meetingSignal!.value).toBeGreaterThanOrEqual(0.9);
  });

  it("scores low when half of meetings are cancelled", async () => {
    const now = new Date();
    setActivities([
      makeActivity({ activityType: "meeting_scheduled", occurredAt: now }),
      makeActivity({ activityType: "meeting_scheduled", occurredAt: now }),
      makeActivity({ activityType: "meeting_cancelled", occurredAt: now }),
      makeActivity({ activityType: "meeting_cancelled", occurredAt: now }),
    ]);

    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    const meetingSignal = result.signals.find((s) => s.type === "meeting_acceptance");
    // 2 scheduled / (2 scheduled + 2 cancelled) = 0.5
    expect(meetingSignal!.value).toBe(0.5);
  });
});

// ── Question Density ────────────────────────────────────────────

describe("question density scoring", () => {
  it("scores high when emails contain many questions", async () => {
    setActivities([
      makeActivity({
        activityType: "email_received",
        rawContent: "What is the pricing? How does integration work? Can you share docs? Do you support SSO? What about the SLA?",
      }),
    ]);

    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    const qSignal = result.signals.find((s) => s.type === "question_density");
    expect(qSignal!.value).toBe(1.0); // 5 questions => 1.0
  });

  it("scores zero when no questions in emails", async () => {
    setActivities([
      makeActivity({
        activityType: "email_received",
        rawContent: "Thanks for the info. We will review it internally.",
      }),
    ]);

    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    const qSignal = result.signals.find((s) => s.type === "question_density");
    expect(qSignal!.value).toBe(0.0);
  });
});

// ── Email Length Trend ──────────────────────────────────────────

describe("email length trend scoring", () => {
  it("scores high when emails get progressively longer", async () => {
    const now = new Date();
    setActivities([
      makeActivity({
        activityType: "email_received",
        occurredAt: new Date(now.getTime() - 30 * 86400000),
        rawContent: "Short reply.",
      }),
      makeActivity({
        activityType: "email_received",
        occurredAt: new Date(now.getTime() - 20 * 86400000),
        rawContent: "A bit longer reply here, with more details.",
      }),
      makeActivity({
        activityType: "email_received",
        occurredAt: new Date(now.getTime() - 10 * 86400000),
        rawContent: "This is a much longer reply with many details about our requirements, timeline, budget considerations, and technical needs for the integration project.",
      }),
      makeActivity({
        activityType: "email_received",
        occurredAt: new Date(now.getTime() - 5 * 86400000),
        rawContent: "We have been discussing this extensively internally and I wanted to share our detailed requirements document. The team has reviewed the proposal and we have several points to discuss regarding implementation timeline, data migration strategy, and ongoing support model.",
      }),
    ]);

    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    const lengthSignal = result.signals.find((s) => s.type === "email_length_trend");
    expect(lengthSignal!.value).toBeGreaterThanOrEqual(0.7);
  });

  it("scores low when emails get shorter", async () => {
    const now = new Date();
    setActivities([
      makeActivity({
        activityType: "email_received",
        occurredAt: new Date(now.getTime() - 30 * 86400000),
        rawContent: "This is a very detailed email with lots of information about our requirements, timeline, and budget considerations for the upcoming project.",
      }),
      makeActivity({
        activityType: "email_received",
        occurredAt: new Date(now.getTime() - 20 * 86400000),
        rawContent: "Shorter reply now, fewer details.",
      }),
      makeActivity({
        activityType: "email_received",
        occurredAt: new Date(now.getTime() - 10 * 86400000),
        rawContent: "Ok got it.",
      }),
      makeActivity({
        activityType: "email_received",
        occurredAt: new Date(now.getTime() - 5 * 86400000),
        rawContent: "Thanks.",
      }),
    ]);

    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    const lengthSignal = result.signals.find((s) => s.type === "email_length_trend");
    expect(lengthSignal!.value).toBe(0.0); // shrinking
  });
});

// ── Forwarding / Expansion ──────────────────────────────────────

describe("forwarding scoring", () => {
  it("detects forwarding signals in summaries", async () => {
    setActivities([
      makeActivity({
        activityType: "email_received",
        summary: "Looping in my manager for final approval",
        rawContent: "Some content",
      }),
      makeActivity({
        activityType: "email_received",
        summary: "I've added our CTO to discuss technical requirements",
        rawContent: "Another email",
      }),
    ]);

    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    const fwdSignal = result.signals.find((s) => s.type === "forwarding");
    expect(fwdSignal!.value).toBeGreaterThanOrEqual(0.8);
  });

  it("scores zero when no forwarding signals present", async () => {
    setActivities([
      makeActivity({
        activityType: "email_received",
        summary: "Thanks for the demo, looked great",
        rawContent: "Just a regular email",
      }),
    ]);

    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    const fwdSignal = result.signals.find((s) => s.type === "forwarding");
    expect(fwdSignal!.value).toBe(0);
  });
});

// ── Document Requests ───────────────────────────────────────────

describe("document request scoring", () => {
  it("detects pricing and case study requests", async () => {
    setActivities([
      makeActivity({
        activityType: "email_received",
        rawContent: "Can you send us your pricing? We also need a case study from your SaaS customers.",
      }),
    ]);

    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    const docSignal = result.signals.find((s) => s.type === "document_requests");
    expect(docSignal!.value).toBeGreaterThanOrEqual(0.7); // 2+ doc types
  });

  it("scores zero for generic email without document requests", async () => {
    setActivities([
      makeActivity({
        activityType: "email_received",
        rawContent: "Thanks for the meeting today, it was very informative.",
      }),
    ]);

    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    const docSignal = result.signals.find((s) => s.type === "document_requests");
    expect(docSignal!.value).toBe(0);
  });
});

// ── After-Hours Engagement ──────────────────────────────────────

describe("after-hours engagement scoring", () => {
  it("detects weekend emails as after-hours signals", async () => {
    // Create dates that fall on Saturday (day 6) and Sunday (day 0)
    // 2026-04-25 is a Saturday, 2026-04-26 is a Sunday
    setActivities([
      makeActivity({
        activityType: "email_received",
        occurredAt: new Date("2026-04-25T10:00:00Z"), // Saturday
        rawContent: "Weekend email 1",
      }),
      makeActivity({
        activityType: "email_received",
        occurredAt: new Date("2026-04-26T14:00:00Z"), // Sunday
        rawContent: "Weekend email 2",
      }),
    ]);

    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    const ahSignal = result.signals.find((s) => s.type === "after_hours");
    expect(ahSignal!.value).toBeGreaterThanOrEqual(0.6); // 100% after-hours
  });
});

// ── Trend Detection ─────────────────────────────────────────────

describe("trend detection", () => {
  it("detects heating trend when recent activity exceeds previous period", async () => {
    const now = new Date();
    const recentActivities = Array.from({ length: 8 }, (_, i) =>
      makeActivity({
        activityType: "email_received",
        occurredAt: new Date(now.getTime() - i * 86400000), // last 8 days
        rawContent: `Recent email ${i}`,
      }),
    );
    const oldActivities = [
      makeActivity({
        activityType: "email_received",
        occurredAt: new Date(now.getTime() - 20 * 86400000),
        rawContent: "Old email",
      }),
    ];

    setActivities([...recentActivities, ...oldActivities]);
    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    expect(result.trend).toBe("heating");
  });

  it("detects cooling trend when recent activity is sparse vs previous", async () => {
    const now = new Date();
    const oldActivities = Array.from({ length: 8 }, (_, i) =>
      makeActivity({
        activityType: "email_received",
        occurredAt: new Date(now.getTime() - (15 + i) * 86400000), // 15-23 days ago
        rawContent: `Old email ${i}`,
      }),
    );
    const recentActivity = makeActivity({
      activityType: "email_received",
      occurredAt: new Date(now.getTime() - 5 * 86400000), // 5 days ago
      rawContent: "Lone recent email",
    });

    setActivities([recentActivity, ...oldActivities]);
    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    expect(result.trend).toBe("cooling");
  });
});

// ── Overall Score ───────────────────────────────────────────────

describe("overall score computation", () => {
  it("returns score capped between 0 and 100", async () => {
    setActivities([]);
    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("returns all 8 signal types in the signals array", async () => {
    setActivities([]);
    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    expect(result.signals.length).toBe(8);
    const types = result.signals.map((s) => s.type);
    expect(types).toContain("response_time");
    expect(types).toContain("meeting_acceptance");
    expect(types).toContain("question_density");
    expect(types).toContain("email_length_trend");
    expect(types).toContain("forwarding");
    expect(types).toContain("document_requests");
    expect(types).toContain("after_hours");
    expect(types).toContain("volume_recency");
  });

  it("includes lastUpdated ISO string", async () => {
    setActivities([]);
    const result = await scoreBuyerIntent("contact-1", "tenant-1");
    expect(result.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
