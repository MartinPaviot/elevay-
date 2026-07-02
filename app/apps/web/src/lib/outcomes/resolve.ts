import { db } from "@/db";
import {
  actionOutcomes,
  outboundEmails,
  outreachDecisions,
  activities,
  tasks,
} from "@/db/schema";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { inngest } from "@/inngest/client";

// Ordering invariant (outcome hierarchy): meeting_held > meeting_booked >
// replied_positive, and every reply-flywheel-promotable outcome stays >= 0.8
// (reply-flywheel.ts). `email_opened` is deliberately ABSENT: Apple Mail
// Privacy Protection auto-opens every message, so opens are deliverability
// diagnostics, never a learning signal — they must not resolve a watcher
// (a phantom open would consume it before the real reply arrives).
export const POSITIVITY: Record<string, number> = {
  meeting_held: 1.0,
  meeting_booked: 0.95,
  replied_positive: 0.9,
  deal_advanced: 0.8,
  replied_neutral: 0.4,
  email_clicked: 0.3,
  no_response: 0.0,
  replied_negative: -0.3,
  unsubscribed: -0.6,
  bounced: -0.8,
  deal_lost: -1.0,
};

export async function resolveOutcome(
  outcomeId: string,
  outcomeType: string,
): Promise<void> {
  const [outcome] = await db
    .select()
    .from(actionOutcomes)
    .where(eq(actionOutcomes.id, outcomeId))
    .limit(1);

  if (!outcome || outcome.status !== "watching") return;

  const positivity = POSITIVITY[outcomeType] ?? 0.0;
  const timeToOutcomeHours =
    (Date.now() - outcome.watchingSince.getTime()) / (1000 * 60 * 60);

  await db
    .update(actionOutcomes)
    .set({
      status: "resolved",
      outcomeType,
      positivity,
      timeToOutcomeHours: Math.round(timeToOutcomeHours * 10) / 10,
      resolvedAt: new Date(),
    })
    .where(eq(actionOutcomes.id, outcomeId));

  // T8 — decision↔outcome join. EVERY resolution flows through this seam
  // (real events via checkEmailOutcomes/checkDealOutcomes AND the expiry path
  // in inngest/outcome-detector.ts — a no_response IS a learning outcome,
  // positivity 0.0, and must backfill too).
  await backfillOutreachDecision(
    outcome.entitySnapshot as Record<string, unknown> | null,
    outcomeId,
  );

  await inngest.send({
    name: "outcome/resolved",
    data: {
      tenantId: outcome.tenantId,
      outcomeId: outcome.id,
      actionId: outcome.actionId,
      actionType: outcome.actionType,
      outcomeType,
      positivity,
      triggerType: outcome.triggerType,
      timeToOutcomeHours,
    },
  }).catch(() => {});
}

/**
 * T8 (outreach-autopilot) — fill outreach_decisions.outcome_id from a resolved
 * watcher whose entitySnapshot carries a decisionId (written by
 * lib/outreach/decision-record.ts). Best-effort by contract: a backfill
 * failure must never break outcome resolution.
 *
 * T7 amendment — phantom-send exclusion, as a POSITIVE list: the outbound
 * row must prove the send left (sent/delivered/bounced, or a sentAt stamp)
 * before the decision may join an outcome. 'failed' AND stuck-queued rows
 * are both excluded — a never-sent email must not be read as "sent, no
 * response" (T9 would learn from a phantom). A bounce is NOT excluded: it
 * is a real send whose bounced outcome (positivity -0.8) is honest learning.
 */
async function backfillOutreachDecision(
  entitySnapshot: Record<string, unknown> | null,
  outcomeId: string,
): Promise<void> {
  try {
    const snapshot = entitySnapshot ?? {};
    const decisionId =
      typeof snapshot.decisionId === "string" && snapshot.decisionId
        ? snapshot.decisionId
        : null;
    if (!decisionId) return; // not an outreach-send watcher — nothing to join

    // Read the decision's outbound key from the ROW (authoritative), not the
    // snapshot: the snapshot is a convenience copy that could drift.
    const [decision] = await db
      .select({ outboundEmailId: outreachDecisions.outboundEmailId })
      .from(outreachDecisions)
      .where(eq(outreachDecisions.id, decisionId))
      .limit(1);
    if (!decision) return;

    if (decision.outboundEmailId) {
      const [outbound] = await db
        .select({
          status: outboundEmails.status,
          sentAt: outboundEmails.sentAt,
        })
        .from(outboundEmails)
        .where(eq(outboundEmails.id, decision.outboundEmailId))
        .limit(1);
      // POSITIVE-LIST predicate (review fix): the row must prove the send
      // actually LEFT — sent/delivered, a bounce (a real send whose bounced
      // outcome at -0.8 is legitimate learning), or a sentAt stamp. This
      // covers every phantom class at once: 'failed', but also rows STUCK
      // queued/held at resolution (e.g. a send path that returned before
      // transport without flipping the status).
      const left =
        !!outbound &&
        (outbound.status === "sent" ||
          outbound.status === "delivered" ||
          outbound.status === "bounced" ||
          outbound.sentAt != null);
      if (!left) return; // phantom send — leave outcome_id NULL
    }

    // Idempotent: `outcome_id IS NULL` makes a duplicate resolution pass a
    // no-op — the FIRST resolution wins the join, exactly once.
    await db
      .update(outreachDecisions)
      .set({ outcomeId })
      .where(
        and(
          eq(outreachDecisions.id, decisionId),
          isNull(outreachDecisions.outcomeId),
        ),
      );
  } catch {
    // Best-effort: losing the join must never break resolution.
  }
}

export async function checkEmailOutcomes(
  tenantId: string,
  contactId: string,
  eventType: "opened" | "clicked" | "replied_positive" | "replied_negative" | "bounced",
): Promise<void> {
  // Opens never resolve an outcome: MPP fires them for unread mail, and
  // resolving here would consume the watcher before a real reply/bounce.
  // The watcher either resolves on a real event or times out to
  // no_response (inngest/outcome-detector.ts).
  if (eventType === "opened") return;

  const watchingOutcomes = await db
    .select()
    .from(actionOutcomes)
    .where(
      and(
        eq(actionOutcomes.tenantId, tenantId),
        eq(actionOutcomes.entityId, contactId),
        eq(actionOutcomes.status, "watching"),
      ),
    )
    .limit(10);

  const outcomeType =
    eventType === "clicked" ? "email_clicked" :
    eventType === "bounced" ? "bounced" :
    eventType;

  for (const outcome of watchingOutcomes) {
    if (EMAIL_FAMILY_ACTION_TYPES.has(outcome.actionType)) {
      await resolveOutcome(outcome.id, outcomeType);
    }
  }
}

/** The action types whose watchers resolve on email-thread events — shared
 *  by the email checker above and the meeting checker below (a meeting is
 *  the OUTCOME of the outreach that produced the thread). Includes T8's
 *  outreach-send (lib/outreach/decision-record.ts). */
const EMAIL_FAMILY_ACTION_TYPES: ReadonlySet<string> = new Set([
  "send_followup",
  "draft_reply",
  "enroll_sequence",
  "email-send",
  "email-reply",
  "outreach-send",
]);

/**
 * T12 (outreach-autopilot) — meeting outcome producer. Meetings NEVER
 * resolved a watcher before this: every outreach that led to a booked or
 * held meeting either expired to no_response (0.0) or was consumed by a
 * weaker reply event (0.9 max) — a structural bias in the learning data
 * against exactly the outcomes the POSITIVITY hierarchy values MOST
 * (meeting_held 1.0 > meeting_booked 0.95, #609). Called from the booking
 * route (meeting_booked), the attendance mark + the recall webhook
 * (meeting_held), and swept by the outcome-detector cron as catch-up. The
 * decision join is automatic: resolveOutcome backfills
 * outreach_decisions.outcome_id via the watcher snapshot.
 */
export async function checkMeetingOutcomes(
  tenantId: string,
  contactId: string,
  eventType: "meeting_booked" | "meeting_held",
): Promise<void> {
  const watchingOutcomes = await db
    .select()
    .from(actionOutcomes)
    .where(
      and(
        eq(actionOutcomes.tenantId, tenantId),
        eq(actionOutcomes.entityId, contactId),
        eq(actionOutcomes.status, "watching"),
      ),
    )
    .limit(10);

  for (const outcome of watchingOutcomes) {
    if (EMAIL_FAMILY_ACTION_TYPES.has(outcome.actionType)) {
      await resolveOutcome(outcome.id, eventType);
    }
  }
}

export async function checkDealOutcomes(
  tenantId: string,
  dealId: string,
  eventType: "deal_advanced" | "deal_lost",
): Promise<void> {
  const watchingOutcomes = await db
    .select()
    .from(actionOutcomes)
    .where(
      and(
        eq(actionOutcomes.tenantId, tenantId),
        eq(actionOutcomes.entityId, dealId),
        eq(actionOutcomes.status, "watching"),
      ),
    )
    .limit(10);

  for (const outcome of watchingOutcomes) {
    await resolveOutcome(outcome.id, eventType);
  }
}
