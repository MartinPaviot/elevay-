import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  sequences,
  sequenceEnrollments,
  outboundEmails,
} from "@/db/schema";
import { getAuthContext } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";

/**
 * GET /api/sequences/:id/analytics — funnel metrics for one sequence.
 *
 * v1 aggregate (all-time):
 *   - enrolled / active / paused / completed / replied (from enrollments)
 *   - drafts / sent / delivered / opened / clicked / bounced / replied
 *     (from outbound_emails tagged with sequenceId)
 *   - reply_rate (replied/sent), open_rate, click_rate, bounce_rate
 *
 * Returns zeros rather than null so the UI card doesn't have to branch.
 */

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const authCtx = await getAuthContext();
  if (!authCtx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const [sequence] = await db
      .select({ id: sequences.id })
      .from(sequences)
      .where(and(eq(sequences.id, id), eq(sequences.tenantId, authCtx.tenantId)))
      .limit(1);
    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }

    // Enrollment counts by status.
    const enrollmentRows = await db
      .select({
        status: sequenceEnrollments.status,
        count: sql<number>`count(*)`,
      })
      .from(sequenceEnrollments)
      .where(eq(sequenceEnrollments.sequenceId, id))
      .groupBy(sequenceEnrollments.status);

    const enrollment: Record<string, number> = {
      total: 0,
      active: 0,
      paused: 0,
      completed: 0,
      replied: 0,
    };
    for (const row of enrollmentRows) {
      const status = row.status ?? "unknown";
      enrollment[status] = Number(row.count) || 0;
      enrollment.total += enrollment[status];
    }

    // Outbound-email funnel counts by status. `outbound_emails` doesn't
    // store sequenceId directly — it references enrollmentId. Pull the
    // enrollment IDs for this sequence first, then aggregate emails that
    // belong to any of them. `IN (...)` is fine here because the
    // enrollment-per-sequence fan-out stays small in practice.
    const enrollmentIds = (
      await db
        .select({ id: sequenceEnrollments.id })
        .from(sequenceEnrollments)
        .where(eq(sequenceEnrollments.sequenceId, id))
    ).map((r) => r.id);

    const emailRows = enrollmentIds.length
      ? await db
          .select({
            status: outboundEmails.status,
            opened: sql<number>`count(*) filter (where ${outboundEmails.openedAt} is not null)`,
            clicked: sql<number>`count(*) filter (where ${outboundEmails.clickedAt} is not null)`,
            count: sql<number>`count(*)`,
          })
          .from(outboundEmails)
          .where(
            and(
              eq(outboundEmails.tenantId, authCtx.tenantId),
              inArray(outboundEmails.enrollmentId, enrollmentIds)
            )
          )
          .groupBy(outboundEmails.status)
      : [];

    const emails: Record<string, number> & {
      totalOpened: number;
      totalClicked: number;
    } = {
      draft: 0,
      queued: 0,
      sending: 0,
      sent: 0,
      delivered: 0,
      bounced: 0,
      failed: 0,
      complained: 0,
      totalOpened: 0,
      totalClicked: 0,
    };
    for (const row of emailRows) {
      const status = row.status ?? "unknown";
      emails[status] = Number(row.count) || 0;
      emails.totalOpened += Number(row.opened) || 0;
      emails.totalClicked += Number(row.clicked) || 0;
    }

    const sentOrLater =
      (emails.sent || 0) + (emails.delivered || 0) + (emails.bounced || 0);
    const rates = {
      openRate: sentOrLater > 0 ? emails.totalOpened / sentOrLater : 0,
      clickRate: sentOrLater > 0 ? emails.totalClicked / sentOrLater : 0,
      bounceRate: sentOrLater > 0 ? (emails.bounced || 0) / sentOrLater : 0,
      replyRate: sentOrLater > 0 ? (enrollment.replied || 0) / sentOrLater : 0,
    };

    return NextResponse.json({
      sequenceId: id,
      enrollment,
      emails,
      rates,
    });
  } catch (err) {
    logger.error("sequences: analytics failed", { err, sequenceId: id });
    return NextResponse.json({ error: "Failed to compute analytics" }, { status: 500 });
  }
}
