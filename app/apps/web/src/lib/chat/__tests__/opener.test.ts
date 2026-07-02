import { describe, expect, it } from "vitest";
import {
  buildOpener,
  parseFromHeader,
  parseSilentDays,
  OPENER_ALL_CLEAR,
  OPENER_MAX_CHIPS,
  type OpenerInputs,
  type OpenerTodo,
} from "../opener";

const reply = (over: Partial<OpenerTodo> = {}): OpenerTodo => ({
  kind: "reply",
  title: "marie@pilae.ch",
  subtitle: "Re: pricing",
  why: "Replied",
  stakes: null,
  toAddress: "marie@pilae.ch",
  entityId: "c1",
  ...over,
});
const deal = (over: Partial<OpenerTodo> = {}): OpenerTodo => ({
  kind: "deal_risk",
  title: "Acme Corp",
  subtitle: "Proposal",
  why: "Silent 12d",
  stakes: "CHF 40k",
  toAddress: null,
  entityId: "d1",
  ...over,
});
const meeting = (over: Partial<OpenerTodo> = {}): OpenerTodo => ({
  kind: "meeting",
  title: "Demo with Datakit",
  subtitle: null,
  why: "Today",
  stakes: "14:00",
  toAddress: null,
  entityId: "m1",
  ...over,
});
const task = (): OpenerTodo => ({
  kind: "task",
  title: "Send the deck",
  subtitle: null,
  why: "Overdue",
  stakes: null,
  toAddress: null,
  entityId: "t1",
});

const base = (over: Partial<OpenerInputs> = {}): OpenerInputs => ({
  todos: [],
  draftsPending: 0,
  lastThread: null,
  ...over,
});

describe("parseSilentDays", () => {
  it("recovers days from buildNeedsYou's why label", () => {
    expect(parseSilentDays("Silent 12d")).toBe(12);
    expect(parseSilentDays("silent 3 d")).toBe(3);
  });
  it("returns null on anything else", () => {
    expect(parseSilentDays("Replied")).toBeNull();
    expect(parseSilentDays("")).toBeNull();
  });
});

describe("parseFromHeader", () => {
  it("extracts quoted display name and bare address from an RFC header", () => {
    expect(parseFromHeader('"Paul Madelénat" <paul.madelenat@pilae.ch>')).toEqual({
      name: "Paul Madelénat",
      address: "paul.madelenat@pilae.ch",
    });
  });
  it("handles unquoted display names", () => {
    expect(parseFromHeader("Paul M <p@x.ch>")).toEqual({ name: "Paul M", address: "p@x.ch" });
  });
  it("angle-only header yields a null name", () => {
    expect(parseFromHeader("<p@x.ch>")).toEqual({ name: null, address: "p@x.ch" });
  });
  it("bare address passes through", () => {
    expect(parseFromHeader("marie@pilae.ch")).toEqual({ name: null, address: "marie@pilae.ch" });
  });
});

describe("buildOpener text", () => {
  it("raw RFC From headers surface as the display name (live-verified defect)", () => {
    const raw = '"Paul Madelénat" <paul.madelenat@pilae.ch>';
    const out = buildOpener(
      base({ todos: [reply({ title: raw, toAddress: raw, subtitle: "Re: YC" })] }),
    );
    expect(out.text).toBe("A reply from Paul Madelénat is waiting on you.");
    expect(out.chips[0].label).toBe('Reply to Paul Madelénat: "Re: YC"');
    expect(out.chips[0].send).toBe('Draft a reply to paul.madelenat@pilae.ch about "Re: YC"');
  });

  it("full house: replies, drafts, deal in priority order, capped at 3 sentences", () => {
    const out = buildOpener(
      base({
        todos: [reply(), reply({ title: "j@x.com" }), reply({ title: "k@y.com" }), deal(), meeting()],
        draftsPending: 4,
      }),
    );
    expect(out.text).toBe(
      "3 replies are waiting on you, the latest from marie@pilae.ch. " +
        "I prepared 4 outreach drafts for your review. " +
        "Acme Corp has been silent for 12 days.",
    );
    expect(out.hasWork).toBe(true);
    expect(out.counts).toEqual({ replies: 3, drafts: 4, deals: 1, meetings: 1 });
  });

  it("singular copy for one reply and one draft", () => {
    const out = buildOpener(base({ todos: [reply()], draftsPending: 1 }));
    expect(out.text).toContain("A reply from marie@pilae.ch is waiting on you.");
    expect(out.text).toContain("I prepared 1 outreach draft for your review.");
  });

  it("meeting sentence appears when higher lanes leave room", () => {
    const out = buildOpener(base({ todos: [meeting()] }));
    expect(out.text).toBe("Demo with Datakit is on your calendar at 14:00.");
  });

  it("deal without a parsable silence label degrades to needs-attention", () => {
    const out = buildOpener(base({ todos: [deal({ why: "Stalled" })] }));
    expect(out.text).toBe("Acme Corp needs attention.");
  });

  it("all clear when nothing is waiting", () => {
    const out = buildOpener(base());
    expect(out.text).toBe(OPENER_ALL_CLEAR);
    expect(out.hasWork).toBe(false);
  });

  it("task todos contribute neither text nor chips in v1", () => {
    const out = buildOpener(base({ todos: [task()] }));
    expect(out.text).toBe(OPENER_ALL_CLEAR);
    expect(out.chips.every((c) => c.kind === "recipe")).toBe(true);
  });
});

describe("buildOpener chips", () => {
  it("work chips in priority order reply > drafts > deal > meeting, capped at 4", () => {
    const out = buildOpener(
      base({ todos: [reply(), deal(), meeting()], draftsPending: 2, lastThread: { id: "th1", title: "x", updatedAt: null } }),
    );
    expect(out.chips.map((c) => c.kind)).toEqual(["reply", "drafts", "deal_risk", "meeting"]);
    expect(out.chips).toHaveLength(OPENER_MAX_CHIPS);
  });

  it("reply chip embeds address and truncated subject; send carries the full subject", () => {
    const long = "Re: the very long subject line that goes on and on forever";
    const out = buildOpener(base({ todos: [reply({ subtitle: long })] }));
    const chip = out.chips[0];
    expect(chip.label).toBe(`Reply to marie@pilae.ch: "${long.slice(0, 39).trimEnd()}…"`);
    expect(chip.send).toBe(`Draft a reply to marie@pilae.ch about "${long}"`);
  });

  it("reply chip without subject omits the subject clause", () => {
    const out = buildOpener(base({ todos: [reply({ subtitle: null })] }));
    expect(out.chips[0].label).toBe("Reply to marie@pilae.ch");
    expect(out.chips[0].send).toBe("Draft a reply to marie@pilae.ch");
  });

  it("long addresses fall back to the local part in the label only", () => {
    const addr = "first.last.commercial@very-long-company-domain.example.com";
    const out = buildOpener(base({ todos: [reply({ title: addr, toAddress: addr, subtitle: null })] }));
    expect(out.chips[0].label).toBe("Reply to first.last.commercial");
    expect(out.chips[0].send).toBe(`Draft a reply to ${addr}`);
  });

  it("drafts chip navigates to the review page instead of the agent loop", () => {
    const out = buildOpener(base({ draftsPending: 3 }));
    const chip = out.chips.find((c) => c.kind === "drafts");
    expect(chip?.href).toBe("/sequences/review");
    expect(chip?.send).toBeUndefined();
    expect(chip?.label).toBe("Review 3 pending drafts");
  });

  it("deal chip carries the silence context into the coaching ask", () => {
    const out = buildOpener(base({ todos: [deal()] }));
    const chip = out.chips.find((c) => c.kind === "deal_risk");
    expect(chip?.send).toBe(
      'Coach me on the "Acme Corp" deal. It has been silent for 12 days. What is my next move?',
    );
  });

  it("recipes fill up to 3 chips when work is scarce", () => {
    const out = buildOpener(base({ todos: [reply()] }));
    expect(out.chips.map((c) => c.kind)).toEqual(["reply", "recipe", "recipe"]);
  });

  it("empty tenant gets exactly the 3 recipe chips", () => {
    const out = buildOpener(base());
    expect(out.chips.map((c) => c.id)).toEqual([
      "recipe:call-list",
      "recipe:inbound-recap",
      "recipe:deals-at-risk",
    ]);
  });

  it("resume chip is appended last when a slot remains", () => {
    const out = buildOpener(
      base({ todos: [reply()], lastThread: { id: "th9", title: "Pipeline digging", updatedAt: null } }),
    );
    const last = out.chips[out.chips.length - 1];
    expect(last.kind).toBe("resume");
    expect(last.resumeThreadId).toBe("th9");
    expect(last.label).toBe("Continue: Pipeline digging");
  });

  it("resume chip is dropped when work already fills all 4 slots", () => {
    const out = buildOpener(
      base({
        todos: [reply(), deal(), meeting()],
        draftsPending: 1,
        lastThread: { id: "th9", title: "x", updatedAt: null },
      }),
    );
    expect(out.chips.some((c) => c.kind === "resume")).toBe(false);
  });

  it("untitled last thread gets the generic continue label", () => {
    const out = buildOpener(base({ lastThread: { id: "th2", title: null, updatedAt: null } }));
    const resume = out.chips.find((c) => c.kind === "resume");
    expect(resume?.label).toBe("Continue: last conversation");
  });

  it("negative draft count is treated as zero", () => {
    const out = buildOpener(base({ draftsPending: -2 }));
    expect(out.counts.drafts).toBe(0);
    expect(out.chips.some((c) => c.kind === "drafts")).toBe(false);
  });
});
