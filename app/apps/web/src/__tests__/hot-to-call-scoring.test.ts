import { describe, expect, it } from "vitest";
import {
  SIGNAL_WEIGHT,
  SPEED_WINDOW_MS,
  computeHotness,
  isInSpeedWindow,
  minutesAgo,
  pickHeadlineSignal,
  rankContacts,
  recencyFactor,
  scoreSignal,
} from "@/lib/hot-to-call/scoring";

const NOW = new Date("2026-05-29T12:00:00Z");

describe("recencyFactor", () => {
  it("returns 5.0 in the speed-to-lead window (< 5 min)", () => {
    expect(recencyFactor(0)).toBe(5);
    expect(recencyFactor(SPEED_WINDOW_MS - 1)).toBe(5);
  });

  it("returns 3.0 between 5min and 1h", () => {
    expect(recencyFactor(SPEED_WINDOW_MS)).toBe(3);
    expect(recencyFactor(60 * 60 * 1000 - 1)).toBe(3);
  });

  it("returns 1.5 between 1h and 6h", () => {
    expect(recencyFactor(60 * 60 * 1000)).toBe(1.5);
    expect(recencyFactor(6 * 60 * 60 * 1000 - 1)).toBe(1.5);
  });

  it("returns 1.0 between 6h and 24h", () => {
    expect(recencyFactor(6 * 60 * 60 * 1000)).toBe(1);
    expect(recencyFactor(24 * 60 * 60 * 1000 - 1)).toBe(1);
  });

  it("returns 0.3 between 24h and 7d (cool but surfaceable)", () => {
    expect(recencyFactor(24 * 60 * 60 * 1000)).toBe(0.3);
    expect(recencyFactor(7 * 24 * 60 * 60 * 1000 - 1)).toBe(0.3);
  });

  it("returns 0 beyond 7 days (endpoint filters anyway)", () => {
    expect(recencyFactor(7 * 24 * 60 * 60 * 1000)).toBe(0);
    expect(recencyFactor(30 * 24 * 60 * 60 * 1000)).toBe(0);
  });

  it("treats future-dated signals as fresh (clock skew defence)", () => {
    expect(recencyFactor(-1000)).toBe(5);
  });
});

describe("scoreSignal — composite of weight × recency", () => {
  it("a click in speed window scores 10 × 5 = 50", () => {
    expect(
      scoreSignal({ kind: "click", at: NOW }, NOW),
    ).toBe(50);
  });

  it("a visit in speed window scores 6 × 5 = 30", () => {
    expect(
      scoreSignal({ kind: "visit", at: NOW }, NOW),
    ).toBe(30);
  });

  it("an open scores 0 at ANY recency — the opens ban covers call prioritization (T8)", () => {
    expect(scoreSignal({ kind: "open", at: NOW }, NOW)).toBe(0);
    const dayOld = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    expect(scoreSignal({ kind: "open", at: dayOld }, NOW)).toBe(0);
  });

  it("orders correctly: click > visit > open (open pinned to ZERO — T8 opens ban)", () => {
    expect(SIGNAL_WEIGHT.click).toBeGreaterThan(SIGNAL_WEIGHT.visit);
    expect(SIGNAL_WEIGHT.visit).toBeGreaterThan(SIGNAL_WEIGHT.open);
    expect(SIGNAL_WEIGHT.open).toBe(0);
  });

  it("a 1-day-old click (recency 0.3) scores 3.0 — and STILL beats a fresh open (0)", () => {
    const oldClick = new Date(NOW.getTime() - 25 * 60 * 60 * 1000);
    const freshOpen = NOW;
    expect(
      scoreSignal({ kind: "click", at: oldClick }, NOW),
    ).toBe(3);
    expect(scoreSignal({ kind: "open", at: freshOpen }, NOW)).toBe(0);
  });

  it("a click at exactly 6h old scores 10 × 1.0 = 10", () => {
    const sixHours = new Date(NOW.getTime() - 6 * 60 * 60 * 1000);
    expect(scoreSignal({ kind: "click", at: sixHours }, NOW)).toBe(10);
  });
});

describe("computeHotness — sum across signals", () => {
  it("aggregates two clicks in speed window: 50 + 50 = 100", () => {
    expect(
      computeHotness(
        [
          { kind: "click", at: NOW },
          { kind: "click", at: NOW },
        ],
        NOW,
      ),
    ).toBe(100);
  });

  it("returns 0 for empty signal list", () => {
    expect(computeHotness([], NOW)).toBe(0);
  });

  it("returns 0 when all signals are > 7 days old (out of window)", () => {
    const tooOld = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(
      computeHotness(
        [
          { kind: "click", at: tooOld },
          { kind: "visit", at: tooOld },
        ],
        NOW,
      ),
    ).toBe(0);
  });

  it("mixed signals: fresh click + 24h-old visit + fresh open", () => {
    const twentyFourHr = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    // click: 50, visit at exactly 24h: 6 × 0.3 = 1.8, open: 0 (banned)
    expect(
      computeHotness(
        [
          { kind: "click", at: NOW },
          { kind: "visit", at: twentyFourHr },
          { kind: "open", at: NOW },
        ],
        NOW,
      ),
    ).toBeCloseTo(51.8, 5);
  });
});

describe("pickHeadlineSignal", () => {
  it("returns null on empty list", () => {
    expect(pickHeadlineSignal([], NOW)).toBeNull();
  });

  it("picks the highest-scoring signal — a fresh open (0) never headlines over real intent", () => {
    const old = new Date(NOW.getTime() - 60 * 60 * 1000);
    const result = pickHeadlineSignal(
      [
        { kind: "open", at: NOW },
        { kind: "click", at: old },
      ],
      NOW,
    );
    // click at 1h: 10 × 1.5 = 15 ; open at NOW: 0 × 5 = 0 → the click headlines.
    expect(result?.kind).toBe("click");
  });

  it("breaks ties by recency (newer wins)", () => {
    const older = new Date(NOW.getTime() - 60_000);
    const newer = NOW;
    const result = pickHeadlineSignal(
      [
        { kind: "click", at: older },
        { kind: "click", at: newer },
      ],
      NOW,
    );
    expect(result?.at.getTime()).toBe(newer.getTime());
  });

  it("picks a fresh click over a fresh visit (weight differs)", () => {
    expect(
      pickHeadlineSignal(
        [
          { kind: "visit", at: NOW },
          { kind: "click", at: NOW },
        ],
        NOW,
      )?.kind,
    ).toBe("click");
  });
});

describe("minutesAgo", () => {
  it("returns 0 for a signal at NOW", () => {
    expect(minutesAgo(NOW, NOW)).toBe(0);
  });

  it("returns a positive integer for past signals", () => {
    const fiveMin = new Date(NOW.getTime() - 5 * 60_000);
    expect(minutesAgo(fiveMin, NOW)).toBe(5);
  });

  it("clamps at 0 for future-dated signals (no negative)", () => {
    const future = new Date(NOW.getTime() + 60_000);
    expect(minutesAgo(future, NOW)).toBe(0);
  });
});

describe("isInSpeedWindow", () => {
  it("true within the speed window", () => {
    expect(isInSpeedWindow(NOW, NOW)).toBe(true);
    expect(
      isInSpeedWindow(new Date(NOW.getTime() - SPEED_WINDOW_MS + 1), NOW),
    ).toBe(true);
  });

  it("false exactly at the boundary (5min ago counts as out — drop-everything-mode ends)", () => {
    expect(isInSpeedWindow(new Date(NOW.getTime() - SPEED_WINDOW_MS), NOW)).toBe(
      false,
    );
  });
});

describe("rankContacts", () => {
  it("sorts by hotness descending", () => {
    const sorted = rankContacts([
      { contactId: "a", hotness: 10, mostRecentSignalAt: NOW },
      { contactId: "b", hotness: 50, mostRecentSignalAt: NOW },
      { contactId: "c", hotness: 30, mostRecentSignalAt: NOW },
    ]);
    expect(sorted.map((s) => s.contactId)).toEqual(["b", "c", "a"]);
  });

  it("breaks ties by recency (newer signal first)", () => {
    const older = new Date(NOW.getTime() - 60_000);
    const sorted = rankContacts([
      { contactId: "a", hotness: 20, mostRecentSignalAt: older },
      { contactId: "b", hotness: 20, mostRecentSignalAt: NOW },
    ]);
    expect(sorted.map((s) => s.contactId)).toEqual(["b", "a"]);
  });

  it("does not mutate the input list", () => {
    const input = [
      { contactId: "a", hotness: 10, mostRecentSignalAt: NOW },
      { contactId: "b", hotness: 50, mostRecentSignalAt: NOW },
    ];
    const before = [...input];
    rankContacts(input);
    expect(input).toEqual(before);
  });
});
