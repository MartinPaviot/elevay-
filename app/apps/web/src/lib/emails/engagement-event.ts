/**
 * Cadence event branching (gap #2 — Monaco's "branch on real delivery events"). The
 * track routes write an open/click; this turns a TRACKED engagement on a SEQUENCED
 * email into an `email/opened` / `email/clicked` Inngest event, which the (already
 * built + registered, but starved) decision engine consumes: bridgeTrackingEvents →
 * campaign-engine/event-occurred → campaignDecisionEngine branches the cadence (send a
 * contextual follow-up / wait / stop) instead of the linear delayDays loop.
 *
 * Behind `CADENCE_BRANCHING_ENABLED` (default OFF): autonomous engagement-driven
 * follow-ups (the decision engine queues a real send through evaluateSend) only fire
 * once the founder opts in. Only sequenced sends qualify — an `enrollmentId` is
 * required (the decision-engine bridge bails without it), so one-off/manual sends with
 * no enrollment never trigger branching.
 */

export function isCadenceBranchingEnabled(): boolean {
  const v = process.env.CADENCE_BRANCHING_ENABLED;
  return v === "1" || v === "true";
}

export interface EngagementRow {
  enrollmentId: string | null;
  tenantId: string;
  contactId: string | null;
}

export interface EngagementEvent {
  name: "email/opened" | "email/clicked";
  data: { enrollmentId: string; tenantId: string; contactId: string };
}

/** Build the decision-engine event for a tracked engagement, or null when it can't branch. */
export function buildEngagementEvent(kind: "opened" | "clicked", row: EngagementRow): EngagementEvent | null {
  if (!row.enrollmentId) return null;
  return {
    name: kind === "opened" ? "email/opened" : "email/clicked",
    data: { enrollmentId: row.enrollmentId, tenantId: row.tenantId, contactId: row.contactId ?? "" },
  };
}
