import { describe, it, expect } from "vitest";
import { buildOutboundQueue, itemPriority, QUALITY_SENTINEL, type QueueItem } from "../queue";

const now = new Date("2026-06-22T12:00:00Z");
const iso = (offsetH: number) => new Date(now.getTime() + offsetH * 3600_000).toISOString();

describe("buildOutboundQueue — priority order", () => {
  it("replies first, then overdue reminders, then upcoming, then drafts", () => {
    const items: QueueItem[] = [
      { kind: "draft", id: "d", qualityScore: 0.9 },
      { kind: "reminder", id: "r-upcoming", dueAt: iso(5) },
      { kind: "reply", id: "rep" },
      { kind: "reminder", id: "r-overdue", dueAt: iso(-5) },
    ];
    const out = buildOutboundQueue(items, now).map((i) => i.id);
    expect(out).toEqual(["rep", "r-overdue", "r-upcoming", "d"]);
  });

  it("drafts ordered by qualityScore desc; null uses the 0.5 sentinel", () => {
    const items: QueueItem[] = [
      { kind: "draft", id: "low", qualityScore: 0.2 },
      { kind: "draft", id: "unscored", qualityScore: null },
      { kind: "draft", id: "high", qualityScore: 0.95 },
    ];
    const out = buildOutboundQueue(items, now).map((i) => i.id);
    // high (0.95) > unscored (0.5) > low (0.2)
    expect(out).toEqual(["high", "unscored", "low"]);
  });

  it("signal freshness breaks ties between equal-quality drafts", () => {
    const items: QueueItem[] = [
      { kind: "draft", id: "stale", qualityScore: 0.8, signalFreshnessDays: 9 },
      { kind: "draft", id: "fresh", qualityScore: 0.8, signalFreshnessDays: 1 },
    ];
    const out = buildOutboundQueue(items, now).map((i) => i.id);
    expect(out).toEqual(["fresh", "stale"]);
  });

  it("itemPriority: reply > overdue reminder > upcoming reminder > any draft", () => {
    expect(itemPriority({ kind: "reply", id: "x" }, now)).toBeGreaterThan(
      itemPriority({ kind: "reminder", id: "x", dueAt: iso(-1) }, now),
    );
    expect(itemPriority({ kind: "reminder", id: "x", dueAt: iso(-1) }, now)).toBeGreaterThan(
      itemPriority({ kind: "reminder", id: "x", dueAt: iso(1) }, now),
    );
    expect(itemPriority({ kind: "reminder", id: "x", dueAt: iso(1) }, now)).toBeGreaterThan(
      itemPriority({ kind: "draft", id: "x", qualityScore: 1 }, now),
    );
    expect(QUALITY_SENTINEL).toBe(0.5);
  });

  it("empty queue -> []", () => {
    expect(buildOutboundQueue([], now)).toEqual([]);
  });
});
