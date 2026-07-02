import { getAuthContext } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { sequenceDrafts, replyReviewQueue, agentActions } from "@/db/schema";
import { and, count, eq, isNull } from "drizzle-orm";

/**
 * GET /api/home/ready-for-you — the cockpit "Ready for you" aggregate
 * (outreach-autopilot T11b). One tenant-scoped fetch → three counts of what
 * genuinely needs the founder, sourced from the THREE tables that exist today:
 *
 *   drafts  — sequence_drafts awaiting the founder (status = 'pending_approval',
 *             served by the `sequence_drafts_tenant_status_idx` probe).
 *   replies — reply_review_queue rows whose live classification landed below the
 *             confidence floor (state = 'pending', reply-review.ts:37/:46).
 *   actions — agent_actions the agent DECIDED but is HOLDING for approval. That
 *             shape is `status = 'scheduled'` with NO `scheduledExecutionAt` and
 *             not reversed — exactly what recordAgentAction writes for
 *             `awaitingApproval` (lib/agents/agent-actions.ts:59-70); the
 *             dispatcher's `lte(scheduledExecutionAt, now())` predicate skips
 *             these until approveAgentAction stamps the time, so they are the
 *             ones truly waiting on a human (grace-window auto-sends carry a
 *             time and are excluded).
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
        ),
      ),
  ]);

  return Response.json({
    drafts: Number(drafts[0]?.n ?? 0),
    replies: Number(replies[0]?.n ?? 0),
    actions: Number(actions[0]?.n ?? 0),
  });
}
