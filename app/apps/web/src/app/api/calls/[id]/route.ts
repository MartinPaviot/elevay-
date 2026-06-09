/**
 * GET /api/calls/[id]
 *
 * Full call detail for the post-call page — transcript, recording URL
 * (proxied), summary, signals, action items. Tenant-scoped read.
 */

import { withAuthRLS } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { calls, contacts, activities } from "@/db/schema";
import { and, eq, sql, desc } from "drizzle-orm";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withAuthRLS(async (authCtx) => {
    const { id } = await ctx.params;
    const [row] = await db
      .select({
        call: calls,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
        contactTitle: contacts.title,
      })
      .from(calls)
      .leftJoin(contacts, eq(contacts.id, calls.contactId))
      .where(and(eq(calls.id, id), eq(calls.tenantId, authCtx.tenantId)))
      .limit(1);
    if (!row) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Post-call debrief lives on the call_completed activity's metadata,
    // written by the async post-processor. Null until processing is done —
    // the ended view polls processingState and shows it when it lands.
    const [act] = await db
      .select({ metadata: activities.metadata })
      .from(activities)
      .where(
        and(
          eq(activities.tenantId, authCtx.tenantId),
          sql`${activities.metadata}->>'callId' = ${id}`,
        ),
      )
      .orderBy(desc(activities.occurredAt))
      .limit(1);
    const debrief =
      (act?.metadata as Record<string, unknown> | null | undefined)?.debrief ?? null;

    return Response.json({
      ...row.call,
      debrief,
      contactName:
        `${row.contactFirstName ?? ""} ${row.contactLastName ?? ""}`.trim() ||
        "Unknown",
      contactTitle: row.contactTitle,
      // The raw Twilio recording URL requires basic auth — never expose
      // it directly. The dashboard player must go through
      // /api/calls/[id]/recording (Phase 1.5 proxy, can wait).
      recordingUrl: row.call.recordingUrl ? `/api/calls/${id}/recording` : null,
    });
  });
}
