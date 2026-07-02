/**
 * T10 — the ONE list of live reply classifications. Shared by the classifier
 * (inngest processReply's schema), the review-queue correction API (input
 * validation), and the inbox display maps, so the vocabulary cannot drift.
 * "objection" is FIRST-LEVEL (M8-R1): a clear pushback that fits none of the
 * specific sub-types.
 */
export const REPLY_CLASSIFICATIONS = [
  "interested",
  "meeting_request",
  "objection",
  "objection_price",
  "objection_timing",
  "objection_competitor",
  "objection_authority",
  "ooo",
  "unsubscribe",
] as const;

export type ReplyClassificationLabel = (typeof REPLY_CLASSIFICATIONS)[number];

export function isReplyClassification(v: unknown): v is ReplyClassificationLabel {
  return typeof v === "string" && (REPLY_CLASSIFICATIONS as readonly string[]).includes(v);
}
