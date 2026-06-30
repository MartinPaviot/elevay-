import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const embedEntity = vi.fn().mockResolvedValue(undefined);
const ingestEpisode = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/ai/embeddings", () => ({ embedEntity: (...a: unknown[]) => embedEntity(...a) }));
vi.mock("@/lib/ai/context-graph", () => ({ ingestEpisode: (...a: unknown[]) => ingestEpisode(...a) }));

import { captureOutboundEmail } from "../outbound-email-capture";

const base = {
  tenantId: "t1",
  contactId: "c1",
  subject: "Following up",
  body: "Hi there, here is the deck we discussed.",
  messageId: "m1",
};

describe("captureOutboundEmail", () => {
  beforeEach(() => {
    embedEntity.mockClear();
    ingestEpisode.mockClear();
    process.env.OPENAI_API_KEY = "test-key";
  });
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("embeds (contact-keyed) AND ingests an episode for a normal sent email", () => {
    captureOutboundEmail(base);
    expect(embedEntity).toHaveBeenCalledTimes(1);
    expect(embedEntity).toHaveBeenCalledWith("t1", "contact", "c1-email-m1", expect.stringContaining("here is the deck"));
    expect(ingestEpisode).toHaveBeenCalledTimes(1);
    const [tenant, content, type, id] = ingestEpisode.mock.calls[0];
    expect(tenant).toBe("t1");
    expect(type).toBe("email");
    expect(id).toBe("m1");
    expect(content).toContain("Outbound email to contact c1");
    expect(content).toContain("here is the deck");
  });

  it("does NOT embed without OPENAI_API_KEY, but STILL ingests the episode", () => {
    delete process.env.OPENAI_API_KEY;
    captureOutboundEmail(base);
    expect(embedEntity).not.toHaveBeenCalled();
    expect(ingestEpisode).toHaveBeenCalledTimes(1);
  });

  it("does NOT embed without a contactId (no entity to anchor), still ingests unattributed", () => {
    captureOutboundEmail({ ...base, contactId: null });
    expect(embedEntity).not.toHaveBeenCalled();
    expect(ingestEpisode).toHaveBeenCalledTimes(1);
    expect(ingestEpisode.mock.calls[0][1]).not.toContain("to contact");
  });

  it("does NOT embed without a messageId (no retry-stable key), still ingests with undefined episode id", () => {
    captureOutboundEmail({ ...base, messageId: null });
    expect(embedEntity).not.toHaveBeenCalled();
    expect(ingestEpisode).toHaveBeenCalledTimes(1);
    expect(ingestEpisode.mock.calls[0][3]).toBeUndefined();
  });

  it("captures nothing when the body is empty or whitespace", () => {
    captureOutboundEmail({ ...base, body: "   " });
    captureOutboundEmail({ ...base, body: null });
    expect(embedEntity).not.toHaveBeenCalled();
    expect(ingestEpisode).not.toHaveBeenCalled();
  });

  it("captures nothing without a tenantId", () => {
    captureOutboundEmail({ ...base, tenantId: "" });
    expect(embedEntity).not.toHaveBeenCalled();
    expect(ingestEpisode).not.toHaveBeenCalled();
  });

  it("truncates the body (5000 for embed, 3000 for episode)", () => {
    const big = "x".repeat(9000);
    captureOutboundEmail({ ...base, body: big });
    const embedText = embedEntity.mock.calls[0][3] as string;
    const episodeText = ingestEpisode.mock.calls[0][1] as string;
    // embed prefix "Email (sent): Following up\n\n" + 5000 body chars
    expect((embedText.match(/x/g) || []).length).toBe(5000);
    expect((episodeText.match(/x/g) || []).length).toBe(3000);
  });

  it("never throws even when a primitive rejects (fail-soft, fire-and-forget)", () => {
    embedEntity.mockRejectedValueOnce(new Error("openai down"));
    ingestEpisode.mockRejectedValueOnce(new Error("graph down"));
    expect(() => captureOutboundEmail(base)).not.toThrow();
  });
});
