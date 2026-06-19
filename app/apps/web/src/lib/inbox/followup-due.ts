/**
 * Follow-up timing (B7) — the pure, deterministic core.
 *
 * Given the instant of OUR last outbound on a thread that owes us no inbound,
 * `computeFollowupDue` returns when a gentle follow-up becomes due, on an
 * escalating business-day ladder ([3, 5, 8] business days, the last repeating).
 * Pure: no DB, no network, no LLM, no ambient clock unless `opts.now` is omitted
 * (then `Date.now()` is read exactly once). Reuses the weekend-skipping,
 * UTC, time-of-day-preserving arithmetic in lib/util/business-days.
 *
 * It classifies and computes only — it never sends, schedules, or persists.
 */

import { addBusinessDays, rollToBusinessDay } from "@/lib/util/business-days";

/** Default escalating ladder: 1st nudge +3, 2nd +5, 3rd+ +8 business days. */
export const DEFAULT_BACKOFF_BUSINESS_DAYS = [3, 5, 8] as const;

const DAY_MS = 86_400_000;

export interface FollowupDue {
  /** Epoch ms the follow-up is due, or null when no follow-up applies. */
  dueAt: number | null;
  /** 1-based nudge number this `dueAt` is for (0 on the non-due sentinel). */
  stage: number;
  overdue: boolean;
  /** Whole calendar days from now's date to the due date (0 = due today). */
  daysUntilDue: number;
  /** Whole business days the due date is past (>= 0; 0 when not overdue). */
  businessDaysOverdue: number;
}

export interface FollowupDueOpts {
  /** Injected clock (epoch ms). Omitted -> Date.now() read once at entry. */
  now?: number;
  /** Follow-up nudges WE already sent since lastOutboundAt (default 0). */
  priorNudgeCount?: number;
  /** Tenant override of the ladder; empty/absent -> the default. [CFG-ready] */
  backoffBusinessDays?: number[];
}

const SENTINEL: FollowupDue = {
  dueAt: null,
  stage: 0,
  overdue: false,
  daysUntilDue: 0,
  businessDaysOverdue: 0,
};

/** Midnight (UTC) of the date `ms` falls on — counts are date-granular. */
function utcMidnight(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Whole calendar days between two UTC-midnight instants (b - a), >= 0. */
function calendarDaysBetween(aMidnight: number, bMidnight: number): number {
  if (bMidnight <= aMidnight) return 0;
  return Math.round((bMidnight - aMidnight) / DAY_MS);
}

/**
 * Whole business days from date `a` to date `b` (weekend-excluding), >= 0.
 * Counts how many business-day hops advance `a`'s date to reach `b`'s date.
 */
export function businessDaysBetween(aMs: number, bMs: number): number {
  let cur = utcMidnight(aMs);
  const end = utcMidnight(bMs);
  if (end <= cur) return 0;
  let count = 0;
  while (cur < end) {
    cur = addBusinessDays(new Date(cur), 1).getTime();
    count++;
  }
  return count;
}

/**
 * Compute when a follow-up on `lastOutboundAt` (epoch ms) becomes due. Returns
 * the non-due sentinel for a null/NaN/future last-outbound (R1.7).
 */
export function computeFollowupDue(lastOutboundAt: number | null, opts: FollowupDueOpts = {}): FollowupDue {
  const now = opts.now ?? Date.now();

  if (lastOutboundAt == null || !Number.isFinite(lastOutboundAt) || lastOutboundAt > now) {
    return SENTINEL;
  }

  const ladder =
    opts.backoffBusinessDays && opts.backoffBusinessDays.length > 0
      ? opts.backoffBusinessDays
      : [...DEFAULT_BACKOFF_BUSINESS_DAYS];
  const priorNudges = Math.max(0, Math.floor(opts.priorNudgeCount ?? 0));
  const days = ladder[Math.min(priorNudges, ladder.length - 1)];
  const stage = priorNudges + 1;

  // Backoff over the last outbound, never landing on a weekend.
  const dueAtMs = rollToBusinessDay(addBusinessDays(new Date(lastOutboundAt), days)).getTime();

  const overdue = now >= dueAtMs;
  if (overdue) {
    return {
      dueAt: dueAtMs,
      stage,
      overdue: true,
      daysUntilDue: 0,
      businessDaysOverdue: businessDaysBetween(dueAtMs, now),
    };
  }
  return {
    dueAt: dueAtMs,
    stage,
    overdue: false,
    daysUntilDue: calendarDaysBetween(utcMidnight(now), utcMidnight(dueAtMs)),
    businessDaysOverdue: 0,
  };
}

/**
 * Human label for the follow-up indicator (B1.2). Null when there is no
 * follow-up. Reads cleanly across the four states: upcoming, due today, just
 * overdue (same day), and overdue by N business days.
 */
export function followupLabel(f: FollowupDue): string | null {
  if (f.dueAt == null) return null;
  if (f.overdue) {
    return f.businessDaysOverdue > 0 ? `Follow up overdue · ${f.businessDaysOverdue}d` : "Follow up overdue";
  }
  if (f.daysUntilDue === 0) return "Follow up due today";
  return `Follow up in ${f.daysUntilDue}d`;
}
