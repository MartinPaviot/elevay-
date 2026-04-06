import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks — accessible inside vi.mock factories
const { mockSelect, mockUpdate, mockGetBotTranscript, mockGetBotStatus, mockTranscriptToText, mockMapBotStatus } = vi.hoisted(() => {
  const mockUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });

  const mockSelect = vi.fn().mockImplementation(() => {
    const chain: Record<string, any> = {};
    const methods = ["from", "leftJoin", "innerJoin", "where", "groupBy", "having", "orderBy", "limit"];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.then = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve);
    return chain;
  });

  return {
    mockSelect,
    mockUpdate,
    mockGetBotTranscript: vi.fn(),
    mockGetBotStatus: vi.fn(),
    mockTranscriptToText: vi.fn(),
    mockMapBotStatus: vi.fn(),
  };
});

vi.mock("@/db", () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  activities: { id: "id", tenantId: "tenant_id", metadata: "metadata", activityType: "activity_type", summary: "summary", rawContent: "raw_content", sentiment: "sentiment" },
  contacts: { id: "id", tenantId: "tenant_id", firstName: "first_name", lastName: "last_name", email: "email" },
  companies: { id: "id" },
  deals: { id: "id", tenantId: "tenant_id", properties: "properties", updatedAt: "updated_at" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
  ilike: vi.fn(),
}));

vi.mock("@/lib/recall", () => ({
  getBotStatus: mockGetBotStatus,
  getBotTranscript: mockGetBotTranscript,
  transcriptToText: mockTranscriptToText,
  mapBotStatus: mockMapBotStatus,
}));

// Mock LLM
vi.mock("@/lib/traced-ai", () => ({
  tracedGenerateObject: vi.fn().mockResolvedValue({
    object: {
      summary: "Discussion about Q2 pipeline and pricing strategy.",
      keyPoints: ["Pipeline is healthy at $2.1M", "Need to adjust pricing for enterprise tier"],
      actionItems: [
        { owner: "Martin", task: "Send revised pricing deck", deadline: "2026-04-10" },
        { owner: "Alice", task: "Schedule follow-up with CFO", deadline: null },
      ],
      decisions: ["Move forward with tiered pricing model"],
      participants: [
        { name: "Martin Paviot", role: "CEO" },
        { name: "Alice Chen", role: "VP Sales" },
      ],
      buyingSignals: {
        budget: "$50K annual",
        timeline: "Decision by end of Q2",
        currentStack: ["HubSpot", "Outreach"],
        painPoints: ["Too much manual data entry", "No unified view"],
        objections: ["Concerned about migration effort"],
        nextSteps: ["Send pricing proposal", "Demo for technical team"],
        competitors: ["Salesforce", "Apollo"],
        teamSize: "12 people in sales",
      },
      sentiment: "positive",
    },
  }),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn().mockReturnValue("mock-model"),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn().mockReturnValue("mock-model"),
}));

vi.mock("@/lib/embeddings", () => ({
  embedEntity: vi.fn().mockResolvedValue(undefined),
  activityToText: vi.fn().mockReturnValue("mock activity text"),
}));

vi.mock("@/lib/context-graph", () => ({
  ingestEpisode: vi.fn().mockResolvedValue(undefined),
}));

// Import the handler
import { POST } from "@/app/api/webhooks/recall/route";

describe("Recall.ai Webhook → Process Transcript → CRM Pipeline", () => {
  const mockActivity = {
    id: "activity-123",
    tenantId: "tenant-456",
    summary: "Q2 Pipeline Review",
    metadata: {
      recallBotId: "bot-789",
      recordingStatus: "recording",
      startTime: "2026-04-05T14:00:00Z",
      attendees: [
        { email: "martin@elevay.com", displayName: "Martin" },
        { email: "alice@customer.com", displayName: "Alice Chen" },
      ],
      meetingLink: "https://meet.google.com/abc-def-ghi",
      calendarEventId: "cal-event-1",
    },
  };

  const mockTranscriptSegments = [
    {
      participant: { id: 1, name: "Martin Paviot", is_host: true, platform: "desktop" },
      words: [
        { text: "Let's review the Q2 pipeline. We're at 2.1M in total ARR opportunity.", start_timestamp: { relative: 0, absolute: "2026-04-05T14:00:00Z" }, end_timestamp: { relative: 5, absolute: "2026-04-05T14:00:05Z" } },
      ],
    },
    {
      participant: { id: 2, name: "Alice Chen", is_host: false, platform: "desktop" },
      words: [
        { text: "The enterprise pricing tier needs adjustment. Our budget is around 50K annually and we need a decision by end of Q2.", start_timestamp: { relative: 6, absolute: "2026-04-05T14:00:06Z" }, end_timestamp: { relative: 15, absolute: "2026-04-05T14:00:15Z" } },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";

    mockMapBotStatus.mockReturnValue("done");
    mockGetBotStatus.mockResolvedValue({
      id: "bot-789",
      recordings: [{
        id: "rec-1",
        media_shortcuts: {
          video_mixed: { data: { download_url: "https://recall.ai/recordings/bot-789/video.mp4" }, format: "mp4" },
          transcript: { id: "t-1", data: { download_url: "https://recall.ai/transcripts/bot-789" } },
        },
      }],
      status_changes: [],
    });
    mockGetBotTranscript.mockResolvedValue(mockTranscriptSegments);
    mockTranscriptToText.mockReturnValue(
      "Martin Paviot: Let's review the Q2 pipeline. We're at 2.1M in total ARR opportunity.\n\n" +
      "Alice Chen: The enterprise pricing tier needs adjustment. Our budget is around 50K annually and we need a decision by end of Q2."
    );

    // Mock DB select to return our mock activity when querying by recallBotId
    mockSelect.mockImplementation(() => {
      const chain: Record<string, any> = {};
      const methods = ["from", "leftJoin", "innerJoin", "where", "groupBy", "having", "orderBy", "limit"];
      for (const m of methods) {
        chain[m] = vi.fn().mockReturnValue(chain);
      }
      chain.then = (resolve: (v: unknown) => void) => Promise.resolve([mockActivity]).then(resolve);
      return chain;
    });
  });

  it("should handle bot.status_change event and update activity metadata", async () => {
    mockMapBotStatus.mockReturnValueOnce("recording");

    const webhookPayload = {
      event: "bot.status_change",
      data: {
        data: { code: "in_call_recording", sub_code: null, updated_at: "2026-04-05T14:00:05Z" },
        bot: { id: "bot-789", metadata: {} },
      },
    };

    const req = new Request("http://localhost/api/webhooks/recall", {
      method: "POST",
      body: JSON.stringify(webhookPayload),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(json.status).toBe("recording");
    // Should have called db.update to set recordingStatus
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("should handle call_ended event and trigger transcript processing", async () => {
    const webhookPayload = {
      event: "bot.status_change",
      data: {
        data: { code: "call_ended", sub_code: null, updated_at: "2026-04-05T14:45:00Z" },
        bot: { id: "bot-789", metadata: {} },
      },
    };

    const req = new Request("http://localhost/api/webhooks/recall", {
      method: "POST",
      body: JSON.stringify(webhookPayload),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(json.status).toBe("done");

    // Wait for async processing
    await new Promise((r) => setTimeout(r, 100));

    // Should have fetched transcript
    expect(mockGetBotTranscript).toHaveBeenCalledWith("bot-789");
    expect(mockTranscriptToText).toHaveBeenCalledWith(mockTranscriptSegments);
  });

  it("should return 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/webhooks/recall", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 for missing bot ID", async () => {
    const req = new Request("http://localhost/api/webhooks/recall", {
      method: "POST",
      body: JSON.stringify({ event: "bot.status_change", data: { data: {}, bot: {} } }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should handle unknown bot gracefully", async () => {
    // Mock DB to return no activity
    mockSelect.mockImplementation(() => {
      const chain: Record<string, any> = {};
      const methods = ["from", "leftJoin", "innerJoin", "where", "groupBy", "having", "orderBy", "limit"];
      for (const m of methods) {
        chain[m] = vi.fn().mockReturnValue(chain);
      }
      chain.then = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve);
      return chain;
    });

    const webhookPayload = {
      event: "bot.status_change",
      data: {
        data: { code: "in_call_recording", sub_code: null, updated_at: "2026-04-05T14:00:05Z" },
        bot: { id: "unknown-bot", metadata: {} },
      },
    };

    const req = new Request("http://localhost/api/webhooks/recall", {
      method: "POST",
      body: JSON.stringify(webhookPayload),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.warning).toBe("no matching activity");
  });
});
