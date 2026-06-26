/**
 * LINKEDIN-INBOUND (T10) — capture one inbound LinkedIn message as a first-class
 * activity, mirroring captureInboundEmail through the same recordCapturedActivity
 * seam (so the timeline, approval gate, and dedup all stay channel-agnostic).
 *
 * Attribution follows the CRM-graph rule: resolve the contact via the chat's
 * attendee provider_id (linkedin_provider_identity). LinkedIn has no domain, so
 * we never auto-create a company/contact — an unknown sender is captured as
 * `unassigned` (visible, pollutes neither pipeline nor accounts).
 *
 * Wire shapes are VERIFIED LIVE (see lib/providers/unipile/http.ts).
 */
import { db } from "@/db";
import { activities, linkedinProviderIdentity } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { recordCapturedActivity, getCaptureApprovalMode } from "@/lib/capture/approval";
import { getTenantSettings } from "@/lib/config/tenant-settings";
import type { UnipileChat, UnipileMessage } from "@/lib/providers/unipile/http";

export interface InboundLinkedInMessage {
  providerMessageId: string;
  chatId: string;
  text: string;
  /** the other party's member id (chat.attendee_provider_id) — the attribution key. */
  senderProviderId: string | null;
  senderName: string | null;
  occurredAt: Date;
}

export interface LinkedInCaptureInput extends InboundLinkedInMessage {
  tenantId: string;
  /** our linkedin_account.id (or the Unipile account id) — recorded on the row. */
  linkedinAccountId: string;
}

export interface LinkedInCaptureResult {
  captured: boolean;
  reason?: "duplicate" | "queued_for_review";
  activityId?: string;
  contactId?: string | null;
}

/**
 * PURE. Map a Unipile chat+message to our inbound shape, or null when it is not a
 * capturable inbound human message: our own echo (`is_sender===1`), a system event
 * (`is_event===1`), empty text, or a bad timestamp.
 */
export function toInboundLinkedInMessage(
  chat: UnipileChat,
  msg: UnipileMessage,
): InboundLinkedInMessage | null {
  if (msg.is_sender === 1) return null; // our own sent message (echo)
  if (msg.is_event === 1) return null; // system event, not a message
  const text = (msg.text ?? "").trim();
  if (!text) return null;
  const ts = msg.timestamp ? new Date(msg.timestamp) : null;
  if (!ts || Number.isNaN(ts.getTime())) return null;
  return {
    providerMessageId: msg.id,
    chatId: msg.chat_id || chat.id,
    text,
    senderProviderId: chat.attendee_provider_id ?? null,
    senderName: chat.name ?? null,
    occurredAt: ts,
  };
}

export async function captureInboundLinkedIn(
  input: LinkedInCaptureInput,
): Promise<LinkedInCaptureResult> {
  const { tenantId, providerMessageId, chatId, text, senderProviderId } = input;

  // Idempotency: skip if this Unipile message id is already captured.
  const [dup] = await db
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.tenantId, tenantId),
        eq(activities.channel, "linkedin"),
        sql`(${activities.metadata} ->> 'providerMessageId') = ${providerMessageId}`,
      ),
    )
    .limit(1);
  if (dup) return { captured: false, reason: "duplicate", activityId: dup.id };

  // Attribution: resolve the contact via the sender's member id. Unknown → unassigned.
  let contactId: string | null = null;
  if (senderProviderId) {
    const [c] = await db
      .select({ id: linkedinProviderIdentity.contactId })
      .from(linkedinProviderIdentity)
      .where(
        and(
          eq(linkedinProviderIdentity.tenantId, tenantId),
          eq(linkedinProviderIdentity.providerId, senderProviderId),
        ),
      )
      .limit(1);
    if (c?.id) contactId = c.id;
  }
  const entityType: "contact" | "unassigned" = contactId ? "contact" : "unassigned";

  const settings = await getTenantSettings(tenantId);
  const mode = getCaptureApprovalMode(settings as Record<string, unknown>);

  const res = await recordCapturedActivity({
    tenantId,
    mode,
    kind: "linkedin",
    sourceRef: providerMessageId,
    activity: {
      tenantId,
      actorType: "contact",
      actorId: contactId,
      entityType,
      // entityId is NOT NULL; unassigned uses "" (the email-capture convention).
      entityId: contactId ?? "",
      activityType: "linkedin_message_received",
      channel: "linkedin",
      direction: "inbound",
      occurredAt: input.occurredAt,
      summary: text.slice(0, 200),
      rawContent: text,
      threadId: chatId,
      metadata: {
        channel: "linkedin",
        providerMessageId,
        chatId,
        providerId: senderProviderId,
        from: input.senderName ?? senderProviderId ?? "LinkedIn",
        senderName: input.senderName ?? null,
        linkedinAccountId: input.linkedinAccountId,
        snippet: text.slice(0, 200),
      },
    },
    summary: text.slice(0, 200),
  });

  // Best-effort: remember the chat on the contact's provider identity so a later
  // reply rides the same chat. Never fails the capture.
  if (contactId && senderProviderId) {
    try {
      await db
        .update(linkedinProviderIdentity)
        .set({ chatId })
        .where(
          and(
            eq(linkedinProviderIdentity.tenantId, tenantId),
            eq(linkedinProviderIdentity.providerId, senderProviderId),
          ),
        );
    } catch {
      /* non-fatal */
    }
  }

  return {
    captured: res.applied,
    reason: res.applied ? undefined : "queued_for_review",
    activityId: res.activityId,
    contactId,
  };
}
