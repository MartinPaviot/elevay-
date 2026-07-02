import { getAuthContext } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { sequenceDrafts, replyReviewQueue, agentActions } from "@/db/schema";
import { and, count, eq, inArray, isNull } from "drizzle-orm";

/**
 * The agent_action types whose approval is CONSEQUENTIAL to the founder —
 * prospect-facing moves the agent wants to make (a send, an enrolment, a deal
 * stage change). The cockpit's "actions to approve" counts ONLY these.
 *
 * WHY the allowlist (verify finding 2026-07-02): agent-reactor.ts:509 marks
 * EVERY deferred decision `awaitingApproval:true` regardless of type, so
 * low-stakes internal actions — especially `create_task` — accumulate as
 * scheduled+null-exec rows. On the live Pilae tenant this produced 940
 * "actions to approve" (all create_task), an overwhelming, meaningless number
 * that no founder acts on. Scoping to prospect-facing types keeps the count
 * honest: what genuinely needs a human OK before it reaches a prospect.
 * (Excluded internal/benign: create_task, create_deal, research_company,
 * enrich_contact, alert_founder, hold.)
 */
const APPROVAL_RELEVANT_ACTION_TYPES = [
  "send_followup",
  "draft_reply",
  "enroll_sequence",
  "advance_deal",
] as const;

/**
 * GET /api/home/ready-for-you — the cockpit "Ready for you" aggregate
 * (outreach-autopilot T11b). One tenant-scoped fetch → three counts of what
 * genuinely needs the founder, sourced from the THREE tables that exist today:
 *
 *   drafts  — sequence_drafts awaiting the founder (status = 'pending_approval',
 *             served by the `sequence_drafts_tenant_status_idx` probe).
 *   replies — reply_review_queue rows whose live classification landed below the
 *             confidence floor (state = 'pending', reply-review.ts:37/:46).
 *   actions — agent_actions the agent DECIDED but is HOLDING for approval:
 *             `status = 'scheduled'` with NO `scheduledExecutionAt`, not
 *             reversed (recordAgentAction's awaitingApproval shape,
 *             lib/agents/agent-actions.ts:59-70), AND of a prospect-facing
 *             type (see APPROVAL_RELEVANT_ACTION_TYPES — the type scope keeps
 *             internal create_task rows from flooding the count).
 *
 * Read-only; no migration. `linkedin_action_queue` (T13) and `gifting_tasks`
 * (T22) do NOT exist yet — deliberately not referenced here.
 */
export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [drafts, replies, actions] = await Promise.all([
    db
      .select({ n: count() })
      .from(sequenceDrafts)
      .where(
        and(
          eq(sequenceDrafts.tenantId, authCtx.tenantId),
          eq(sequenceDrafts.status, "pending_approval"),
        ),
      ),
    db
      .select({ n: count() })
      .from(replyReviewQueue)
      .where(
        and(
          eq(replyReviewQueue.tenantId, authCtx.tenantId),
          eq(replyReviewQueue.state, "pending"),
        ),
      ),
    db
      .select({ n: count() })
      .from(agentActions)
      .where(
        and(
          eq(agentActions.tenantId, authCtx.tenantId),
          eq(agentActions.status, "scheduled"),
          isNull(agentActions.scheduledExecutionAt),
          isNull(agentActions.reversedAt),
          inArray(agentActions.actionType, [...APPROVAL_RELEVANT_ACTION_TYPES]),
        ),
      ),
  ]);

  return Response.json({
    drafts: Number(drafts[0]?.n ?? 0),
    replies: Number(replies[0]?.n ?? 0),
    actions: Number(actions[0]?.n ?? 0),
  });
}
