import { db } from "@/db";
import { outboundEmails, connectedMailboxes, emailOptouts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { inngest } from "@/inngest/client";

export async function POST(req: Request) {
  const event = await req.json();

  switch (event.event) {
    case "messageNew": {
      const { account, from, to, subject, text, messageId, threadId } = event.data || {};

      // Check if this is a reply to an outbound email
      if (threadId) {
        const [outbound] = await db
          .select()
          .from(outboundEmails)
          .where(eq(outboundEmails.threadId, threadId))
          .limit(1);

        if (outbound) {
          // Update outbound email with reply data
          await db
            .update(outboundEmails)
            .set({
              repliedAt: new Date(),
              replySnippet: (text || "").substring(0, 200),
              updatedAt: new Date(),
            })
            .where(eq(outboundEmails.id, outbound.id));

          // Trigger reply classification via Inngest
          if (outbound.enrollmentId) {
            await inngest.send({
              name: "email/reply-received",
              data: {
                enrollmentId: outbound.enrollmentId,
                replyContent: (text || "").substring(0, 1000),
                outboundEmailId: outbound.id,
                replyFrom: from,
              },
            });
          }
        }
      }

      break;
    }

    case "messageBounce": {
      const { account, messageId, bounceMessage } = event.data || {};

      // Find the outbound email by message ID
      if (messageId) {
        const [outbound] = await db
          .select()
          .from(outboundEmails)
          .where(eq(outboundEmails.messageId, messageId))
          .limit(1);

        if (outbound) {
          const isHardBounce = bounceMessage?.includes("550") || bounceMessage?.includes("User unknown");
          const bounceType = isHardBounce ? "hard" : "soft";

          await db
            .update(outboundEmails)
            .set({
              status: "bounced",
              bouncedAt: new Date(),
              bounceType,
              errorMessage: bounceMessage,
              updatedAt: new Date(),
            })
            .where(eq(outboundEmails.id, outbound.id));

          // Hard bounce → opt-out
          if (isHardBounce) {
            await db
              .insert(emailOptouts)
              .values({
                tenantId: outbound.tenantId,
                emailAddress: outbound.toAddress,
                reason: "bounce_hard",
              })
              .onConflictDoNothing();
          }

          // Increment bounce count on mailbox
          if (outbound.mailboxId) {
            await db
              .update(connectedMailboxes)
              .set({
                bounceCount7d: sql`bounce_count_7d + 1`,
                updatedAt: new Date(),
              })
              .where(eq(connectedMailboxes.id, outbound.mailboxId));
          }
        }
      }

      break;
    }
  }

  return Response.json({ ok: true });
}
