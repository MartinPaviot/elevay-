/**
 * P1-15 — the priority brain of the "Outbound du jour" cockpit. Merges the three
 * things a founder works through each day into one ordered queue:
 *   1. replies (a prospect answered — most time-sensitive)
 *   2. reminders (tasks; overdue before upcoming)
 *   3. drafts to approve (by qualityScore desc, signal-freshness tie-break)
 *
 * Pure + deterministic (now passed in). The endpoint/page render this order; the
 * immersive 3-column UI (modeled on call-mode) and the qualityScore column are
 * the follow-up build.
 */

export type QueueItemKind = "reply" | "reminder" | "draft";

export interface QueueItem {
  kind: QueueItemKind;
  id: string;
  /** drafts — null/undefined → neutral 0.5 sentinel (unscored). */
  qualityScore?: number | null;
  /** drafts — age of the signal the draft leans on; fresher ranks higher. */
  signalFreshnessDays?: number | null;
  /** reminders/replies — ISO due/arrival time. */
  dueAt?: string | null;
}

/** Unscored sentinel — an unscored draft sits at the middle of the draft band. */
export const QUALITY_SENTINEL = 0.5;

export function itemPriority(item: QueueItem, now: Date): number {
  switch (item.kind) {
    case "reply":
      return 1000; // a human replied — always first
    case "reminder": {
      const due = item.dueAt ? new Date(item.dueAt).getTime() : Number.POSITIVE_INFINITY;
      return due <= now.getTime() ? 800 : 600; // overdue before upcoming
    }
    case "draft": {
      const q = item.qualityScore ?? QUALITY_SENTINEL;
      const fresh = item.signalFreshnessDays != null ? Math.max(0, 10 - item.signalFreshnessDays) : 0;
      return 100 + q * 100 + fresh; // 100..210 band, under reminders/replies
    }
    default:
      return 0;
  }
}

/** Order the day's queue: replies → overdue reminders → upcoming reminders →
 *  drafts by quality (fresh signals tie-break). Stable for equal priority. */
export function buildOutboundQueue(items: QueueItem[], now: Date): QueueItem[] {
  return items
    .map((item, idx) => ({ item, idx, p: itemPriority(item, now) }))
    .sort((a, b) => b.p - a.p || a.idx - b.idx)
    .map((x) => x.item);
}
