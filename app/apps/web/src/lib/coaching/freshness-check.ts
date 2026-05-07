/**
 * Transcript freshness checker (P0-4 follow-up).
 *
 * The coaching surface is only as good as the chunks it retrieves.
 * When Recall.ai silently fails to attach (token expired, host
 * declined the bot, network outage during the call), meetings
 * complete but no chunks land. Without an alert, the founder
 * notices weeks later when they ask "what did Sarah say last week?"
 * and the LLM refuses every question.
 *
 * Pure helpers — the cron in `inngest/transcript-freshness-alert.ts`
 * pulls per-tenant data and feeds it through these functions to
 * decide what to alert on. Tests cover every threshold + edge case
 * deterministically.
 */

export interface MeetingFreshnessInput {
  tenantId: string;
  /** Number of `meeting_completed` activities in the lookback window. */
  completedMeetingsLastNdays: number;
  /** Number of `transcript_chunks` rows in the same window. */
  chunksLastNdays: number;
  /** Days back the counts cover. The cron typically passes 7. */
  windowDays: number;
}

export interface FreshnessVerdict {
  tenantId: string;
  status: "healthy" | "degraded" | "silent" | "no_meetings";
  reason: string;
  /** Severity 0..2 for the alert prioritisation : 0 informational,
   *  1 warning (degraded), 2 alarm (silent). */
  severity: 0 | 1 | 2;
  /** Coverage = chunks / meetings. Useful for the dashboard. */
  coverageRatio: number | null;
}

/**
 * Decide a tenant's freshness status :
 *  - "no_meetings"  → 0 completed meetings in window (no signal,
 *                     not a defect — informational).
 *  - "silent"       → ≥3 meetings completed, 0 chunks. Bot is
 *                     definitely broken.
 *  - "degraded"     → meetings completed but coverage <33%
 *                     (chunks/meetings ratio). Some calls are
 *                     getting transcribed, others aren't.
 *  - "healthy"      → coverage ≥ 33%. Most meetings produce
 *                     chunks. Below 100% is normal — not every
 *                     meeting is a sales call worth indexing.
 *
 * Pure : tests pin every threshold + boundary case.
 */
export function evaluateFreshness(
  input: MeetingFreshnessInput,
): FreshnessVerdict {
  const meetings = Math.max(0, Math.floor(input.completedMeetingsLastNdays));
  const chunks = Math.max(0, Math.floor(input.chunksLastNdays));

  if (meetings === 0) {
    return {
      tenantId: input.tenantId,
      status: "no_meetings",
      reason: `No completed meetings in the last ${input.windowDays} days.`,
      severity: 0,
      coverageRatio: null,
    };
  }

  // Silent : at least 3 meetings → bot SHOULD have attached at
  // least once. Zero chunks is a hard alarm.
  if (chunks === 0 && meetings >= 3) {
    return {
      tenantId: input.tenantId,
      status: "silent",
      reason: `${meetings} meetings completed in the last ${input.windowDays} days but zero transcript chunks indexed. Likely Recall.ai bot failure or revoked OAuth token.`,
      severity: 2,
      coverageRatio: 0,
    };
  }

  // Coverage ratio — chunks per meeting. A typical 30-min meeting
  // yields 30-60 chunks at our current chunking ; we use a soft
  // threshold of "at least one chunk per meeting" (ratio >= 1) for
  // healthy. Below that signals partial-attachment.
  const ratio = chunks / meetings;

  if (ratio >= 1) {
    return {
      tenantId: input.tenantId,
      status: "healthy",
      reason: `${meetings} meetings, ${chunks} chunks indexed (${ratio.toFixed(1)} chunks per meeting).`,
      severity: 0,
      coverageRatio: ratio,
    };
  }

  // Degraded : some chunks but not enough. Warning.
  return {
    tenantId: input.tenantId,
    status: "degraded",
    reason: `${meetings} meetings, only ${chunks} transcript chunks indexed (${ratio.toFixed(2)} per meeting — expected ≥1). Some calls likely missed by the bot.`,
    severity: 1,
    coverageRatio: ratio,
  };
}

/**
 * Notification copy for the founder. Severity-2 → email + in-app
 * notification ; severity-1 → in-app only ; severity-0 → silent
 * (dashboard tile only).
 */
export function freshnessNotificationCopy(verdict: FreshnessVerdict): {
  title: string;
  body: string;
  cta: string | null;
} | null {
  if (verdict.severity === 0) return null;
  if (verdict.status === "silent") {
    return {
      title: "Transcript indexing stopped",
      body: verdict.reason,
      cta: "Re-connect Recall.ai",
    };
  }
  if (verdict.status === "degraded") {
    return {
      title: "Transcript coverage below normal",
      body: verdict.reason,
      cta: "Check Recall.ai status",
    };
  }
  return null;
}

/**
 * Aggregate per-tenant verdicts into a single dashboard summary.
 * The admin dashboard reads this to render the "tenants with stale
 * transcripts" tile.
 */
export function aggregateFreshness(verdicts: FreshnessVerdict[]): {
  total: number;
  healthy: number;
  degraded: number;
  silent: number;
  noMeetings: number;
} {
  const out = {
    total: verdicts.length,
    healthy: 0,
    degraded: 0,
    silent: 0,
    noMeetings: 0,
  };
  for (const v of verdicts) {
    if (v.status === "healthy") out.healthy++;
    else if (v.status === "degraded") out.degraded++;
    else if (v.status === "silent") out.silent++;
    else if (v.status === "no_meetings") out.noMeetings++;
  }
  return out;
}
