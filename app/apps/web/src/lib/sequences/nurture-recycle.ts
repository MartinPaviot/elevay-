/**
 * Nurture recycle — pure decision helper (B6, _specs/pilae-machine/spec-v2.md R5.6).
 *
 * After a contact finishes a sequence without replying, we don't drop
 * the relationship — we let them cool down then re-enroll into a
 * tenant-level "Nurture" sequence at J+30. Three things matter:
 *
 *   1. Only `completed` enrollments are eligible. `replied`/`bounced`/
 *      `unsubscribed` end the relationship explicitly; `active`/`paused`
 *      are still in flight; recycling either is a guardrail violation.
 *   2. The 30-day cooldown is from `lastStepAt`, not enrolledAt — the
 *      contact may have ridden a 10-step cadence over weeks and the
 *      "freshness clock" starts when the last touch landed.
 *   3. Without `lastStepAt`, we can't measure the cooldown, so we
 *      don't recycle. (An enrollment that never sent anything has
 *      nothing to recycle from.)
 *
 * The Inngest cron `nurture-recycle-d30.ts` reads this helper and
 * inserts a fresh row into `sequenceEnrollments` pointing at the
 * tenant's nurture sequence, with `status='active'` and step 1.
 *
 * Pure function: no DB, no `Date.now()` — `now` is passed in so
 * tests are deterministic.
 */

import type { EnrollmentStatus } from "../scoring/priority-score";

export const DEFAULT_NURTURE_WINDOW_DAYS = 30;

export type RecycleInputs = {
  status: EnrollmentStatus;
  lastStepAt: Date | null;
  now: Date;
  windowDays?: number;
};

export type RecycleDecision =
  | { recycle: true }
  | {
      recycle: false;
      reason:
        | "status_not_completed"
        | "no_last_step"
        | "still_in_cooldown";
    };

export function shouldRecycleEnrollment(
  i: RecycleInputs,
): RecycleDecision {
  if (i.status !== "completed") {
    return { recycle: false, reason: "status_not_completed" };
  }
  if (!i.lastStepAt) {
    return { recycle: false, reason: "no_last_step" };
  }
  const windowDays = i.windowDays ?? DEFAULT_NURTURE_WINDOW_DAYS;
  const cooldownMs = windowDays * 24 * 60 * 60 * 1000;
  const age = i.now.getTime() - i.lastStepAt.getTime();
  if (age < cooldownMs) {
    return { recycle: false, reason: "still_in_cooldown" };
  }
  return { recycle: true };
}

/**
 * The nurture sequence is identified by name convention: any sequence
 * whose name starts with "nurture" (case-insensitive). Keeping the
 * match loose so tenants can have "Nurture FR", "Nurture US", etc.
 * without per-channel config columns.
 */
export function isNurtureSequenceName(name: string): boolean {
  return name.trim().toLowerCase().startsWith("nurture");
}
