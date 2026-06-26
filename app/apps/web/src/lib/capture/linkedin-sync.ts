/**
 * LINKEDIN-INBOUND (T10) — pull inbound LinkedIn messages for a connected seat and
 * capture them. The source side of the pipe: lists the seat's chats with new
 * activity (`unread_count > 0`), reads their recent messages, and captures each
 * inbound one (`is_sender === 0`) via captureInboundLinkedIn. Idempotent: dedup on
 * the Unipile message id makes re-runs harmless. The cron (inngest/linkedin-inbox-sync.ts)
 * calls this per connected seat behind LINKEDIN_INBOUND_ENABLED.
 */
import {
  readUnipileConfig,
  listChats,
  listChatMessages,
  type UnipileConfig,
} from "@/lib/providers/unipile/http";
import { toInboundLinkedInMessage, captureInboundLinkedIn } from "@/lib/capture/linkedin-capture";

export interface LinkedInSyncSummary {
  chatsScanned: number;
  captured: number;
  skipped: number;
}

export async function syncLinkedInInboxForAccount(args: {
  tenantId: string;
  /** our linkedin_account.id — recorded on the captured row. */
  linkedinAccountId: string;
  /** the Unipile account_id — the API target. */
  unipileAccountId: string;
  /** injectable for tests; defaults to readUnipileConfig(). */
  cfg?: UnipileConfig | null;
  chatLimit?: number;
  messageLimit?: number;
}): Promise<LinkedInSyncSummary> {
  const cfg = args.cfg ?? readUnipileConfig();
  const empty: LinkedInSyncSummary = { chatsScanned: 0, captured: 0, skipped: 0 };
  if (!cfg) return empty; // not provisioned

  const chats = await listChats(cfg, args.unipileAccountId, { limit: args.chatLimit ?? 20 });
  let chatsScanned = 0;
  let captured = 0;
  let skipped = 0;

  for (const chat of chats.items ?? []) {
    // Only chats with new activity — a fresh reply marks the chat unread. Bounds
    // the message reads; the dedup makes widening this later safe.
    if ((chat.unread_count ?? 0) <= 0) continue;
    chatsScanned++;
    const msgs = await listChatMessages(cfg, chat.id, { limit: args.messageLimit ?? 10 });
    for (const msg of msgs.items ?? []) {
      const inbound = toInboundLinkedInMessage(chat, msg);
      if (!inbound) {
        skipped++;
        continue;
      }
      const r = await captureInboundLinkedIn({
        tenantId: args.tenantId,
        linkedinAccountId: args.linkedinAccountId,
        ...inbound,
      });
      if (r.captured) captured++;
      else skipped++;
    }
  }

  return { chatsScanned, captured, skipped };
}
