/**
 * Hot-to-call scoring — pure functions.
 *
 * Combines email opens + email clicks + identified web visits into a
 * single "hotness" score per callable contact, so the founder picks
 * up the phone in the right order. Two dimensions:
 *
 *   signal weight   — clicks > visits > opens. A click is the
 *                     strongest declared interest (user took an
 *                     action on a CTA); a visit means they're on
 *                     your site right now; an open is "they looked
 *                     at the inbox preview".
 *   recency factor  — Monaco's speed-to-lead window: a signal in
 *                     the last 5 minutes is worth 5× one from 24h
 *                     ago. Decays exponentially after the speed window.
 *
 * Score = sum over signals of (signalWeight × recencyFactor).
 *
 * Pure: no I/O. The endpoint resolves contacts + their signals from
 * the DB, then routes the raw list through these helpers. Keeping the
 * scoring logic out of SQL means we can change the curve without a
 * migration AND test boundary behaviour exhaustively.
 */

export type HotSignalKind = "click" | "visit" | "open";

export type HotSignal = {
  kind: HotSignalKind;
  at: Date;
  detail?: string;
};

export const SIGNAL_WEIGHT: Record<HotSignalKind, number> = {
  click: 10,
  visit: 6,
  open: 3,
};

/** 5-minute speed-to-lead window — the "drop everything and call now" zone. */
export const SPEED_WINDOW_MS = 5 * 60 * 1000;

/**
 * Recency multiplier as a function of signal age:
 *   0-5min   : 5.0  (speed window)
 *   5-60min  : 3.0  (warm)
 *   1-6h     : 1.5
 *   6-24h    : 1.0
 *   24h-7d   : 0.3  (cool — still surface, but not urgent)
 *   > 7d     : 0    (drops off; the endpoint filters by window anyway)
 *
 * Step function not curve so the bands are legible from the score
 * (e.g. score 50.0 == click in speed window; score 30.0 == click in
 * 5-60min; score 18.0 == visit in speed window; etc.).
 */
export function recencyFactor(ageMs: number): number {
  if (ageMs < 0) return 5; // future-dated signal (clock skew) treated as fresh
  if (ageMs < SPEED_WINDOW_MS) return 5;
  if (ageMs < 60 * 60 * 1000) return 3;
  if (ageMs < 6 * 60 * 60 * 1000) return 1.5;
  if (ageMs < 24 * 60 * 60 * 1000) return 1;
  if (ageMs < 7 * 24 * 60 * 60 * 1000) return 0.3;
  return 0;
}

export function scoreSignal(signal: HotSignal, now: Date): number {
  const age = now.getTime() - signal.at.getTime();
  return SIGNAL_WEIGHT[signal.kind] * recencyFactor(age);
}

export function computeHotness(signals: HotSignal[], now: Date): number {
  let total = 0;
  for (const s of signals) total += scoreSignal(s, now);
  return total;
}

/**
 * Pick the most-impactful signal to display as the "last signal" header
 * on a card. Ties broken by recency (newer wins) since two equal
 * scores in the same band should surface the more recent one.
 */
export function pickHeadlineSignal(
  signals: HotSignal[],
  now: Date,
): HotSignal | null {
  if (signals.length === 0) return null;
  let best = signals[0];
  let bestScore = scoreSignal(best, now);
  for (let i = 1; i < signals.length; i++) {
    const s = signals[i];
    const score = scoreSignal(s, now);
    if (
      score > bestScore ||
      (score === bestScore && s.at.getTime() > best.at.getTime())
    ) {
      best = s;
      bestScore = score;
    }
  }
  return best;
}

export function minutesAgo(at: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000));
}

export function isInSpeedWindow(at: Date, now: Date): boolean {
  return now.getTime() - at.getTime() < SPEED_WINDOW_MS;
}

/**
 * Sort a list of (contact, hotness) descending. Used by the endpoint
 * after the per-contact aggregation. Ties broken by the most-recent
 * signal so a contact who just clicked beats one whose last signal
 * was a visit 4 minutes ago.
 */
export type ScoredContact = {
  contactId: string;
  hotness: number;
  mostRecentSignalAt: Date;
};

export function rankContacts<T extends ScoredContact>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.hotness !== b.hotness) return b.hotness - a.hotness;
    return b.mostRecentSignalAt.getTime() - a.mostRecentSignalAt.getTime();
  });
}
