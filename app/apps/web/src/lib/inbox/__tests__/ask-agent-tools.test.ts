import { describe, it, expect } from "vitest";
import { buildAskAgentTools, newSeenLedger, type AgentCorpus } from "@/lib/inbox/ask-agent-tools";
import type { InboxThread } from "@/lib/inbox/ask-inbox";

const corpus: AgentCorpus = {
  threads: [
    { key: "t1", subject: "Acme contract", messages: [{ body: "The Acme contract value is 40000." }, { body: "Signed." }] },
    { key: "t2", subject: "Beta renewal", messages: [{ body: "Beta renews in March." }] },
  ] as unknown as InboxThread[],
};

// The AI-SDK tool execute is (input, options) — options is unused by our tools.
const opt = {} as never;

describe("buildAskAgentTools — search_inbox", () => {
  it("returns indexed refs and records what it surfaced", async () => {
    const seen = newSeenLedger();
    const tools = buildAskAgentTools(corpus, seen);
    const out = (await tools.search_inbox.execute!({ query: "Acme contract" }, opt)) as Array<{ key: string; subject: string }>;
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].key).toBe("t1");
    expect(seen.keys.has("t1")).toBe(true);
    expect(seen.msgCount.get("t1")).toBe(2);
  });
  it("returns empty for a no-match query (drives abstention)", async () => {
    const seen = newSeenLedger();
    const tools = buildAskAgentTools(corpus, seen);
    const out = (await tools.search_inbox.execute!({ query: "zephyr migration timeline" }, opt)) as unknown[];
    expect(out).toEqual([]);
    expect(seen.keys.size).toBe(0);
  });
});

describe("buildAskAgentTools — read_thread / summarize_thread", () => {
  it("read_thread returns indexed messages + records the key", async () => {
    const seen = newSeenLedger();
    const tools = buildAskAgentTools(corpus, seen);
    const out = (await tools.read_thread.execute!({ key: "t1" }, opt)) as { messages: Array<{ idx: number; body: string }> };
    expect(out.messages).toHaveLength(2);
    expect(out.messages[0]).toEqual({ idx: 0, body: "The Acme contract value is 40000." });
    expect(seen.msgCount.get("t1")).toBe(2);
  });
  it("read_thread errors on an unknown key (and records nothing)", async () => {
    const seen = newSeenLedger();
    const tools = buildAskAgentTools(corpus, seen);
    const out = (await tools.read_thread.execute!({ key: "ghost" }, opt)) as { error?: string };
    expect(out.error).toBeTruthy();
    expect(seen.keys.size).toBe(0);
  });
  it("summarize_thread returns the thread content for an existing key", async () => {
    const seen = newSeenLedger();
    const tools = buildAskAgentTools(corpus, seen);
    const out = (await tools.summarize_thread.execute!({ key: "t2" }, opt)) as { key: string; messages: unknown[] };
    expect(out.key).toBe("t2");
    expect(out.messages).toHaveLength(1);
  });
});
