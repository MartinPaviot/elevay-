import { describe, it, expect, vi } from "vitest";
import {
  ingestReply,
  ingestEmailReply,
  classifyReply,
  routeReply,
  type ReplyEvent,
  type ReplyClassification,
  type ClassifyAgentResult,
  type ClassifyDeps,
  type RouteDeps,
  type ReplyOutcome,
} from "../index";

const reply = (over: Partial<ReplyEvent> = {}): ReplyEvent => ({
  providerMessageId: "pm-1",
  source: "email",
  contactId: "c1",
  enrollmentId: "e1",
  fromEmail: "jane@acme.com",
  text: "Please remove me from your list, not interested.",
  receivedAt: 1000,
  ...over,
});

describe("ingestReply — AC1 normalization", () => {
  it("normalizes an email webhook to a canonical reply event", () => {
    const e = ingestEmailReply({ message_id: "m1", contact_id: "c1", from_email: "Jane@Acme.com", body_text: " hi ", received_at: 5 });
    expect(e).toMatchObject({ providerMessageId: "m1", source: "email", contactId: "c1", fromEmail: "jane@acme.com", text: "hi", receivedAt: 5 });
  });
  it("normalizes a linkedin webhook", () => {
    const e = ingestReply({ message_id: "m2", contact_id: "c2", profile_url: "https://li/x", text: "thanks" }, "linkedin");
    expect(e).toMatchObject({ providerMessageId: "m2", source: "linkedin", fromProfileUrl: "https://li/x", text: "thanks" });
  });
});

const agent = (value: ClassifyAgentResult["value"], evalPassed = true): ClassifyDeps => ({
  runAgent: vi.fn(async () => ({ evalPassed, value })),
});

describe("classifyReply — AC2/AC5 eval gate", () => {
  it("returns a confident, grounded classification", async () => {
    const c = await classifyReply(reply(), agent({ sentiment: "negative", intent: "opt_out", confidence: 0.95, rationale: "asks to remove from the list" }));
    expect(c).toMatchObject({ sentiment: "negative", intent: "opt_out", needsReview: false });
  });
  it("low confidence → needs-review (labels kept for the reviewer)", async () => {
    const c = await classifyReply(reply(), agent({ sentiment: "positive", intent: "interested", confidence: 0.3, rationale: "interested in your list" }));
    expect(c.needsReview).toBe(true);
  });
  it("invalid enum → needs-review", async () => {
    const c = await classifyReply(reply(), agent({ sentiment: "happy", intent: "opt_out", confidence: 0.9, rationale: "remove" }));
    expect(c.needsReview).toBe(true);
  });
  it("a failed eval → needs-review", async () => {
    const c = await classifyReply(reply(), agent({ sentiment: "negative", intent: "opt_out", confidence: 0.9, rationale: "remove me" }, false));
    expect(c.needsReview).toBe(true);
  });
  it("an ungrounded rationale → needs-review", async () => {
    const c = await classifyReply(reply(), agent({ sentiment: "positive", intent: "interested", confidence: 0.95, rationale: "vibes" }));
    expect(c.needsReview).toBe(true);
  });
  it("an agent throw → needs-review", async () => {
    const c = await classifyReply(reply(), { runAgent: async () => { throw new Error("down"); } });
    expect(c.needsReview).toBe(true);
  });
});

function routeDeps(over: Partial<RouteDeps> = {}) {
  const store = new Map<string, ReplyOutcome>();
  const calls = { addSuppression: 0, haltSequence: [] as string[], reschedule: 0, emitHotLead: 0 };
  const deps: RouteDeps = {
    addSuppression: () => void calls.addSuppression++,
    haltSequence: (_r, reason) => void calls.haltSequence.push(reason),
    reschedule: () => void calls.reschedule++,
    emitHotLead: () => void calls.emitHotLead++,
    idempotency: { get: async (id) => store.get(id) ?? null, set: async (id, o) => void store.set(id, o) },
    ...over,
  };
  return { deps, calls, store };
}

const cls = (over: Partial<ReplyClassification>): ReplyClassification => ({ sentiment: "neutral", intent: "not_now", confidence: 0.9, needsReview: false, ...over });

describe("routeReply — AC3/AC4 routing", () => {
  it("opt-out → suppress + halt", async () => {
    const { deps, calls } = routeDeps();
    const out = await routeReply(reply(), cls({ intent: "opt_out", sentiment: "negative" }), deps);
    expect(out).toMatchObject({ action: "opt_out", suppressed: true, halted: true });
    expect(calls.addSuppression).toBe(1);
    expect(calls.haltSequence).toEqual(["opt_out"]);
  });

  it("OOO → reschedule, never halt or suppress", async () => {
    const { deps, calls } = routeDeps();
    const out = await routeReply(reply(), cls({ intent: "ooo" }), deps);
    expect(out).toMatchObject({ action: "reschedule", rescheduled: true, halted: false, suppressed: false });
    expect(calls.reschedule).toBe(1);
    expect(calls.haltSequence).toEqual([]);
  });

  it("positive → hot-lead + halt", async () => {
    const { deps, calls } = routeDeps();
    const out = await routeReply(reply(), cls({ sentiment: "positive", intent: "not_now" }), deps);
    expect(out).toMatchObject({ action: "hot_lead", hotLead: true, halted: true });
    expect(calls.emitHotLead).toBe(1);
  });

  it("interested → hot-lead even when sentiment is neutral", async () => {
    const { deps, calls } = routeDeps();
    await routeReply(reply(), cls({ intent: "interested", sentiment: "neutral" }), deps);
    expect(calls.emitHotLead).toBe(1);
  });

  it("a plain negative (non-opt-out) reply halts without a hot-lead", async () => {
    const { deps, calls } = routeDeps();
    const out = await routeReply(reply(), cls({ sentiment: "negative", intent: "not_now" }), deps);
    expect(out).toMatchObject({ action: "halted", halted: true, hotLead: false });
    expect(calls.haltSequence).toEqual(["replied"]);
  });
});

describe("routeReply — AC5 review + idempotency", () => {
  it("needs-review takes no automatic action", async () => {
    const { deps, calls } = routeDeps();
    const out = await routeReply(reply(), cls({ intent: "opt_out", needsReview: true }), deps);
    expect(out.action).toBe("review");
    expect(calls.addSuppression).toBe(0);
    expect(calls.haltSequence).toEqual([]);
  });

  it("a duplicate provider message id returns the prior outcome without re-acting", async () => {
    const { deps, calls } = routeDeps();
    await routeReply(reply(), cls({ intent: "opt_out" }), deps);
    const dup = await routeReply(reply(), cls({ intent: "opt_out" }), deps);
    expect(dup.deduped).toBe(true);
    expect(calls.addSuppression).toBe(1); // not 2
    expect(calls.haltSequence).toEqual(["opt_out"]); // not twice
  });
});
