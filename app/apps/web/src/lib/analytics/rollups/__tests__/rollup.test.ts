import { describe, it, expect } from "vitest";
import {
  computeRollups,
  getMetrics,
  getAttribution,
  compareMetric,
  DEFAULT_BENCHMARKS,
  type MetricEvent,
  type RollupOptions,
} from "../index";

let seq = 0;
const ev = (type: MetricEvent["type"], over: Partial<MetricEvent> = {}): MetricEvent => ({
  eventId: over.eventId ?? `e${++seq}`,
  type,
  campaignId: over.campaignId ?? "camp1",
  at: 1000,
  ...over,
});

const campaignScope: RollupOptions = { scope: { dimension: "campaign" } };

describe("computeRollups — AC1 metrics", () => {
  it("computes counts, rates, and cost metrics", () => {
    const events = [
      ...Array.from({ length: 100 }, () => ev("sent", { cost: 1 })),
      ...Array.from({ length: 97 }, () => ev("delivered")),
      ...Array.from({ length: 5 }, () => ev("reply")),
      ...Array.from({ length: 2 }, () => ev("positive_reply")),
      ev("meeting"),
      ...Array.from({ length: 2 }, () => ev("bounce")),
    ];
    const r = computeRollups(events, { ...campaignScope, qualifiedAccounts: { camp1: 25 } });
    const m = getMetrics(r, "camp1")!;
    expect(m.sent).toBe(100);
    expect(m.delivered).toBe(97);
    expect(m.replies).toBe(7); // 5 reply + 2 positive (positives count as replies)
    expect(m.positiveReplies).toBe(2);
    expect(m.deliveryRate).toBeCloseTo(0.97);
    expect(m.replyRate).toBeCloseTo(0.07);
    expect(m.bounceRate).toBeCloseTo(0.02);
    expect(m.costTotal).toBe(100);
    expect(m.costPerQualifiedAccount).toBeCloseTo(4); // 100 / 25
    expect(m.costPerPositiveReply).toBeCloseTo(50); // 100 / 2
  });

  it("cost-per metrics are null when the denominator is zero", () => {
    const r = computeRollups([ev("sent", { cost: 5 })], campaignScope);
    const m = getMetrics(r, "camp1")!;
    expect(m.costPerQualifiedAccount).toBeNull();
    expect(m.costPerPositiveReply).toBeNull();
  });
});

describe("computeRollups — AC3 idempotent reprocess", () => {
  it("dedupes by eventId: reprocessing the same events yields identical metrics", () => {
    const events = [ev("sent", { eventId: "s1" }), ev("reply", { eventId: "r1" })];
    const once = computeRollups(events, campaignScope);
    const twice = computeRollups([...events, ...events], campaignScope); // duplicated input
    expect(twice.processed).toBe(2); // not 4
    expect(getMetrics(twice, "camp1")).toEqual(getMetrics(once, "camp1"));
  });
});

describe("computeRollups — AC5 attribution", () => {
  it("attributes replies/positives to (variantId, stepId)", () => {
    const events = [
      ev("reply", { variantId: "vA", stepId: "s1" }),
      ev("positive_reply", { variantId: "vA", stepId: "s1" }),
      ev("reply", { variantId: "vB", stepId: "s2" }),
    ];
    const r = computeRollups(events, { scope: { dimension: "variant" } });
    const a = getAttribution(r, "vA");
    expect(a).toEqual([{ variantId: "vA", stepId: "s1", replies: 2, positiveReplies: 1 }]);
    expect(getAttribution(r, "vB")[0]).toMatchObject({ replies: 1, positiveReplies: 0 });
  });
});

describe("computeRollups — scope dimensions", () => {
  it("rolls up per segment when the dimension is segment", () => {
    const events = [
      ev("sent", { segmentId: "seg1" }),
      ev("sent", { segmentId: "seg1" }),
      ev("sent", { segmentId: "seg2" }),
    ];
    const r = computeRollups(events, { scope: { dimension: "segment" } });
    expect(getMetrics(r, "seg1")!.sent).toBe(2);
    expect(getMetrics(r, "seg2")!.sent).toBe(1);
  });

  it("events missing the scope dimension are excluded from byScope (but still counted/processed)", () => {
    const r = computeRollups([ev("sent", { segmentId: undefined })], { scope: { dimension: "segment" } });
    expect(Object.keys(r.byScope)).toHaveLength(0);
    expect(r.processed).toBe(1);
  });
});

describe("compareMetric — AC2 benchmark flagging", () => {
  it("flags reply rate above benchmark as healthy", () => {
    const c = compareMetric("replyRate", 0.08, DEFAULT_BENCHMARKS); // benchmark 0.05
    expect(c).toMatchObject({ flag: "above", healthy: true });
  });
  it("flags reply rate below benchmark as unhealthy", () => {
    expect(compareMetric("replyRate", 0.02)).toMatchObject({ flag: "below", healthy: false });
  });
  it("for bounce rate (a ceiling), below benchmark is healthy", () => {
    expect(compareMetric("bounceRate", 0.01)).toMatchObject({ flag: "below", healthy: true });
    expect(compareMetric("bounceRate", 0.05)).toMatchObject({ flag: "above", healthy: false });
  });
  it("computeRollups emits a benchmark comparison set per scope", () => {
    const r = computeRollups([ev("sent"), ev("reply")], campaignScope);
    expect(r.benchmarks.camp1.map((b) => b.metric)).toEqual(["deliveryRate", "replyRate", "positiveRate", "bounceRate", "spamRate"]);
  });
});
