import { getAuthContext } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { replyReviewQueue, outboundEmails, contacts } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

/**
 * GET /api/inbox/review — the "to classify" lane (M8-R2, T10): pending
 * low-confidence reply classifications, newest first, with just enough
 * context for a 1-click correction (who replied, the snippet, the AI's
 * guess + confidence). The queue is an OVERLAY: these replies were already
 * routed on the AI's guess; correcting re-routes them.
 */
export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: replyReviewQueue.id,
      outboundEmailId: replyReviewQueue.outboundEmailId,
      contactId: replyReviewQueue.contactId,
      classification: replyReviewQueue.classification,
      createdAt: replyReviewQueue.createdAt,
    })
    .from(replyReviewQueue)
    .where(
      and(
        eq(replyReviewQueue.tenantId, authCtx.tenantId),
        eq(replyReviewQueue.state, "pending"),
      ),
    )
    .orderBy(desc(replyReviewQueue.createdAt))
    .limit(50);

  if (rows.length === 0) return Response.json({ items: [], count: 0 });

  // One batched read per side table — snippet from the classified outbound
  // row, display name from the contact.
  const emailIds = rows.map((r) => r.outboundEmailId);
  const emails = await db
    .select({
      id: outboundEmails.id,
      subject: outboundEmails.subject,
      replySnippet: outboundEmails.replySnippet,
      toAddress: outboundEmails.toAddress,
    })
    .from(outboundEmails)
    .where(
      and(eq(outboundEmails.tenantId, authCtx.tenantId), inArray(outboundEmails.id, emailIds)),
    );
  const emailById = new Map(emails.map((e) => [e.id, e]));

  const contactIds = rows.map((r) => r.contactId).filter((c): c is string => !!c);
  const names = contactIds.length
    ? await db
        .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName })
        .from(contacts)
        .where(and(eq(contacts.tenantId, authCtx.tenantId), inArray(contacts.id, contactIds)))
    : [];
  const nameById = new Map(
    names.map((n) => [n.id, [n.firstName, n.lastName].filter(Boolean).join(" ")]),
  );

  return Response.json({
    items: rows.map((r) => {
      const email = emailById.get(r.outboundEmailId);
      return {
        id: r.id,
        outboundEmailId: r.outboundEmailId,
        contactId: r.contactId,
        contactName: (r.contactId && nameById.get(r.contactId)) || null,
        toAddress: email?.toAddress ?? null,
        subject: email?.subject ?? null,
        replySnippet: email?.replySnippet ?? null,
        classification: r.classification,
        createdAt: r.createdAt,
      };
    }),
    count: rows.length,
  });
}
