/**
 * Handler for email/auto-pipeline-draft events.
 *
 * When the autonomous pipeline decides to send a follow-up, it fires
 * this event with the email draft. This handler creates the outbound
 * email row (status: "queued") so the email-send-worker picks it up
 * on its next 2-minute cron cycle.
 *
 * Without this handler, the autonomous pipeline's email decisions
 * disappeared into the Inngest void — the event was sent but nobody
 * listened.
 */

import { inngest } from "./client";
import { db } from "@/db";
import { outboundEmails, contacts, connectedMailboxes } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const handleAutoPipelineDraft = inngest.createFunction(
  {
    id: "auto-pipeline-email-handler",
    retries: 1,
    triggers: [{ event: "email/auto-pipeline-draft" }],
  },
  async ({ event }: {
    event: {
      data: {
        tenantId: string;
        dealId: string;
        contactId?: string;
        subject: string;
        body: string;
        action: string;
        confidence: number;
      };
    };
  }) => {
    const { tenantId, dealId, contactId, subject, body, action, confidence } = event.data;

    if (!contactId) {
      return { error: "No contactId — cannot send email without a recipient" };
    }

    // Look up the contact's email
    const [contact] = await db
      .select({ email: contacts.email, firstName: contacts.firstName })
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
      .limit(1);

    if (!contact?.email) {
      return { error: "Contact has no email address" };
    }

    // Find an active mailbox for this tenant (or use fallback)
    const [mailbox] = await db
      .select({ id: connectedMailboxes.id, emailAddress: connectedMailboxes.emailAddress })
      .from(connectedMailboxes)
      .where(
        and(
          eq(connectedMailboxes.tenantId, tenantId),
          eq(connectedMailboxes.status, "active"),
        ),
      )
      .limit(1);

    // Create the outbound email row as "queued" — the email-send-worker
    // will pick it up on its next cron cycle (every 2 minutes).
    const [created] = await db
      .insert(outboundEmails)
      .values({
        tenantId,
        contactId,
        campaignId: dealId,
        mailboxId: mailbox?.id || null,
        fromAddress: mailbox?.emailAddress || "Elevay <outbound@resend.dev>",
        toAddress: contact.email,
        subject,
        bodyHtml: `<p>${body.replace(/\n/g, "</p><p>")}</p>`,
        bodyText: body,
        status: "queued",
        queuedAt: new Date(),
      })
      .returning({ id: outboundEmails.id });

    return {
      emailId: created?.id,
      to: contact.email,
      subject,
      action,
      confidence,
      mailbox: mailbox?.emailAddress || "fallback",
    };
  },
);
