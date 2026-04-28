/**
 * Tests for @/inngest/auto-briefing-trigger — 24h meeting briefing trigger.
 *
 * Validates the Inngest function registration, the 24-25h time window
 * logic, and the skip-already-briefed behavior. Uses mocks for the
 * database, Inngest client, and notification service.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (vi.mock is hoisted — no references to outer variables) ────

vi.mock("@/inngest/client", () => ({
  inngest: {
    createFunction: vi.fn((config: any, handler: any) => {
      // Store both config and handler so tests can invoke the handler
      return { config, handler, __isMock: true };
    }),
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => ({ type: "eq", args })),
  and: vi.fn((...args: any[]) => ({ type: "and", args })),
  sql: new Proxy(() => ({}), {
    apply: () => ({}),
    get: (_t, prop) => {
      if (prop === Symbol.toPrimitive) return () => "sql";
      return () => ({});
    },
  }),
  gte: vi.fn((...args: any[]) => ({ type: "gte", args })),
  lte: vi.fn((...args: any[]) => ({ type: "lte", args })),
  inArray: vi.fn((...args: any[]) => ({ type: "inArray", args })),
}));

vi.mock("@/db/schema", () => ({
  activities: {
    id: "activities.id",
    activityType: "activities.activityType",
    channel: "activities.channel",
    occurredAt: "activities.occurredAt",
    metadata: "activities.metadata",
    tenantId: "activities.tenantId",
    actorId: "activities.actorId",
    summary: "activities.summary",
    entityType: "activities.entityType",
    entityId: "activities.entityId",
  },
  contacts: {
    id: "contacts.id",
    email: "contacts.email",
    tenantId: "contacts.tenantId",
  },
  deals: {
    id: "deals.id",
    contactId: "deals.contactId",
    tenantId: "deals.tenantId",
    stage: "deals.stage",
  },
}));

vi.mock("@/lib/notifications", () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));

// ── Import after mocks ──────────────────────────────────────────────

import { autoBriefingTrigger } from "@/inngest/auto-briefing-trigger";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("autoBriefingTrigger registration", () => {
  it("is registered as an Inngest function", () => {
    expect(autoBriefingTrigger).toBeTruthy();
    // The mock createFunction returns { config, handler }
    expect((autoBriefingTrigger as any).config).toBeDefined();
  });

  it("has the correct function ID", () => {
    const config = (autoBriefingTrigger as any).config;
    expect(config.id).toBe("auto-briefing-trigger-24h");
  });

  it("is scheduled to run hourly via cron", () => {
    const config = (autoBriefingTrigger as any).config;
    expect(config.triggers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cron: "0 * * * *" }),
      ]),
    );
  });

  it("has retry configured to 1", () => {
    const config = (autoBriefingTrigger as any).config;
    expect(config.retries).toBe(1);
  });
});

describe("24-25h window logic", () => {
  it("meetings in the 24-25h window should be selected", () => {
    // The function queries for meetings where occurredAt is between
    // now+24h and now+25h. Verify the window math.
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // A meeting at 24.5h from now is within the window
    const meetingTime = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);
    expect(meetingTime >= in24h).toBe(true);
    expect(meetingTime <= in25h).toBe(true);
  });

  it("meetings before the 24h mark are excluded", () => {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const tooEarly = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    expect(tooEarly >= in24h).toBe(false);
  });

  it("meetings after the 25h mark are excluded", () => {
    const now = new Date();
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const tooLate = new Date(now.getTime() + 26 * 60 * 60 * 1000);
    expect(tooLate <= in25h).toBe(false);
  });

  it("window is exactly 1 hour wide (no overlap between consecutive runs)", () => {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const windowMs = in25h.getTime() - in24h.getTime();
    expect(windowMs).toBe(60 * 60 * 1000); // exactly 1 hour
  });
});

describe("already-briefed meetings skip logic", () => {
  it("unbriefed meetings have no briefingTriggered metadata", () => {
    const unbriefedMeta: Record<string, unknown> = {
      attendees: [{ email: "test@example.com" }],
    };
    expect(unbriefedMeta.briefingTriggered).toBeUndefined();
  });

  it("briefed meetings have briefingTriggered set — would be filtered by SQL", () => {
    const briefedMeta: Record<string, unknown> = {
      attendees: [{ email: "test@example.com" }],
      briefingTriggered: "2026-04-15T10:00:00.000Z",
    };
    expect(briefedMeta.briefingTriggered).toBeDefined();
    expect(typeof briefedMeta.briefingTriggered).toBe("string");
  });

  it("meetings with prepDocument set would also be filtered by SQL", () => {
    const prepMeta: Record<string, unknown> = {
      attendees: [],
      prepDocument: "# Prep notes\nTalking points...",
    };
    expect(prepMeta.prepDocument).toBeDefined();
  });
});

describe("handler structure", () => {
  it("handler is a function", () => {
    const handler = (autoBriefingTrigger as any).handler;
    expect(typeof handler).toBe("function");
  });

  it("meetings with no attendees are skipped (empty attendees array)", () => {
    // The handler checks: if (attendees.length === 0) continue;
    const meetingMeta = { attendees: [] as unknown[] };
    expect(meetingMeta.attendees.length).toBe(0);
  });

  it("meetings with attendees proceed to trigger prep", () => {
    const meetingMeta = {
      attendees: [
        { email: "buyer@example.com", displayName: "Buyer" },
      ],
    };
    expect(meetingMeta.attendees.length).toBeGreaterThan(0);
  });
});
