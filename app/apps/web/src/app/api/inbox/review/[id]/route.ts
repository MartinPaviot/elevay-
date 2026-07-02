import { getAuthContext } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { replyReviewQueue, outboundEmails } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { isReplyClassification } from "@/lib/reply/classifications";
import { recordFlywheelCandidate } from "@/lib/evals/flywheel";

/**
 * POST /api/inbox/review/[id] — the 1-click resolution of a queued
 * low-confidence classification (M8-R2/M11-R3, T10).
 *
 * Body: { action: "correct", classification: <label> } | { action: "confirm" }
 *
 * correct:
 *   1. queue row -> state 'corrected' + the corrected label (audit);
 *   2. outbound_emails.reply_classification overwritten (the column every
 *      inbox lane and the outcome detector read);
 *   3. `reply/classified` re-emitted with the corrected label so the reply
 *      RE-ROUTES through the existing dispatch (draft for objections,
 *      hot-lead path for interested, reply-agent for the extended set).
 *      The original routing may already have queued/drafted a reply — those
 *      drafts stay visible in the Drafts folder for the founder to discard;
 *      nothing auto-sends without the existing gates.
 *   4. the founder's label feeds learning (M11-R3): a flywheel candidate
 *      tagged user_edited (the strongest teaching signal).
 * confirm: state 'confirmed' + a user_approved candidate — "the AI got it
 * right" is also a label.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as
    | { action?: string; classification?: string }
    | null;
  if (!body || (body.action !== "correct" && body.action !== "confirm")) {
    return Response.json({ error: "action must be 'correct' or 'confirm'" }, { status: 400 });
  }
  if (body.action === "correct" && !isReplyClassification(body.classification)) {
    return Response.json({ error: "Unknown classification" }, { status: 400 });
  }

  const [item] = await db
    .select()
    .from(replyReviewQueue)
    .where(and(eq(replyReviewQueue.id, id), eq(replyReviewQueue.tenantId, authCtx.tenantId)))
    .limit(1);
  if (!item) return Response.json({ error: "Not found" }, { status: 404 });
  if (item.state !== "pending") {
    // Idempotent double-click: the first resolution stands.
    return Response.json({ ok: true, state: item.state, alreadyResolved: true });
  }

  const [email] = await db
    .select({ replySnippet: outboundEmails.replySnippet })
    .from(outboundEmails)
    .where(
      and(
        eq(outboundEmails.id, item.outboundEmailId),
        eq(outboundEmails.tenantId, authCtx.tenantId),
      ),
    )
    .limit(1);
  const replySnippet = email?.replySnippet ?? "";

  const original =
    typeof item.classification === "object" && item.classification
      ? (item.classification as Record<string, unknown>)
      : {};
  const now = new Date();

  if (body.action === "confirm") {
    await db
      .update(replyReviewQueue)
      .set({ state: "confirmed", reviewedAt: now, reviewedBy: authCtx.appUserId ?? null })
      .where(eq(replyReviewQueue.id, item.id));
    // M11-R3 — "the AI was right" is a label too. Best-effort by design.
    await recordFlywheelCandidate(
      "process-reply",
      replySnippet,
      String(original.classification ?? ""),
      authCtx.tenantId,
      "user_approved",
    ).catch(() => null);
    return Response.json({ ok: true, state: "confirmed" });
  }

  const corrected = body.classification as string;
  await db
    .update(replyReviewQueue)
    .set({
      state: "corrected",
      corrected: { classification: corrected },
      reviewedAt: now,
      reviewedBy: authCtx.appUserId ?? null,
    })
    .where(eq(replyReviewQueue.id, item.id));

  await db
    .update(outboundEmails)
    .set({ replyClassification: corrected, updatedAt: now })
    .where(
      and(
        eq(outboundEmails.id, item.outboundEmailId),
        eq(outboundEmails.tenantId, authCtx.tenantId),
      ),
    );

  // Re-route through the SAME dispatch the original classification took.
  // Fail-soft: a re-route failure must not lose the correction itself.
  if (item.enrollmentId) {
    try {
      await inngest.send({
        name: "reply/classified",
        data: {
          enrollmentId: item.enrollmentId,
          classification: corrected,
          reason: "Founder correction from the review queue",
          nextAction: "re-routed after human correction",
          urgency: "medium",
          replyContent: replySnippet.slice(0, 1000),
        },
      });
    } catch {
      // The corrected label is persisted; routing can be retried by hand.
    }
  }

  // M11-R3 — the founder's corrected label is the strongest teaching signal.
  await recordFlywheelCandidate(
    "process-reply",
    replySnippet,
    corrected,
    authCtx.tenantId,
    "user_edited",
  ).catch(() => null);

  return Response.json({ ok: true, state: "corrected", reRouted: !!item.enrollmentId });
}
