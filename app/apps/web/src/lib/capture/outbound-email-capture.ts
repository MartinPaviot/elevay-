import { embedEntity } from "@/lib/ai/embeddings";
import { ingestEpisode } from "@/lib/ai/context-graph";

export interface OutboundEmailCaptureInput {
  tenantId: string;
  /** The contact the email was sent to, when known — the embedding is keyed to it. */
  contactId: string | null;
  subject: string | null;
  /** Plain-text body, WITHOUT the unsubscribe footer (the footer is send-only noise). */
  body: string | null;
  /** The provider message id of the SENT email — the unique dedupe key. */
  messageId: string | null;
}

/**
 * Capture a SENT email into the company brain — the outbound mirror of the
 * inbound seam in `lib/capture/email-capture.ts`.
 *
 * Without this, every email Elevay sends lands only in the email provider's
 * delivery tracking; the brain, chat/RAG, and the memory graph never see what
 * we already told a prospect — the richest continuity + learning signal we
 * produce. Inbound replies and meeting transcripts are already captured this
 * way; outbound was the asymmetry.
 *
 * Two effects, BOTH fire-and-forget + fail-soft by construction (every failure
 * is swallowed) so nothing here can ever block, slow, or fail a send:
 *   - embedEntity  → makes the body retrievable in chat/RAG, keyed to the
 *     contact. OPENAI_API_KEY-guarded and messageId-keyed, exactly like inbound.
 *   - ingestEpisode → feeds the body to the memory/context graph for entity
 *     extraction (what we pitched, which objection we answered, which competitor
 *     we positioned against).
 *
 * Thin orchestration over two already-proven, already-fail-soft primitives; the
 * single canonical place a sent email becomes brain-visible, so the three send
 * sites (sequence worker ×2, interactive composer) don't each drift their own
 * copy. Synchronous + returns void: callers `captureOutboundEmail(...)` and move
 * on, no await.
 */
export function captureOutboundEmail(input: OutboundEmailCaptureInput): void {
  const { tenantId, contactId, subject, body, messageId } = input;
  if (!tenantId || !body || !body.trim()) return;

  // Entity-keyed embedding — only when we can both anchor it (contactId) and
  // give it a unique, retry-stable key (messageId). Mirrors the inbound guard.
  if (process.env.OPENAI_API_KEY && contactId && messageId) {
    const toEmbed = `Email (sent): ${subject ?? ""}\n\n${body.slice(0, 5000)}`;
    void embedEntity(tenantId, "contact", `${contactId}-email-${messageId}`, toEmbed).catch(() => {});
  }

  // Episode into the memory graph — runs even unattributed/unkeyed (ingestEpisode
  // dedupes on the episode id; undefined is fine, same as the inbound path).
  void ingestEpisode(
    tenantId,
    `Outbound email${contactId ? ` to contact ${contactId}` : ""}:\nSubject: ${subject ?? ""}\n\n${body.slice(0, 3000)}`,
    "email",
    messageId ?? undefined,
  ).catch(() => {});
}
