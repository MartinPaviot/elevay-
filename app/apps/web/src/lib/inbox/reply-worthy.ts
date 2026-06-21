/**
 * Reply-worthy selectivity (INBOX B1 core). Pure + unit-tested.
 *
 * Decides whether an inbound conversation is worth offering an AI reply DRAFT
 * for. This is the selectivity gate in front of the (expensive, LLM-backed)
 * draft step: we only want to surface a "draft a reply" affordance on mail a
 * human would actually reply to — never on machine mail, newsletters, receipts
 * or notifications, where a suggested draft is noise and erodes trust.
 *
 * It does NOT classify anything itself. It COMPOSES signals Elevay already
 * computes upstream:
 *   - `isMachineSent` / `isBulk` from `classifyInboundSender`
 *     (src/lib/inbound/lead-classification.ts), surfaced per-conversation as
 *     `inboundIsAutomated` / `isBulk` in src/lib/inbox/conversations.ts.
 *   - `generalIntent` from `resolveGeneralIntent`
 *     (src/lib/inbox/general-intent.ts), a member of the real `GeneralIntent`
 *     taxonomy.
 *
 * Pure: no DB, no network, no LLM, no ambient clock. Deterministic.
 *
 * RECALL BIAS (the design's cardinal rule): a false "not reply-worthy" on real
 * human mail is the worst possible error — it silently hides a real reply
 * opportunity from the founder. A false "reply-worthy" on borderline mail only
 * costs a dismissible suggestion. So the default, whenever the sender is not
 * machine-sent and not bulk, is `true`.
 */

import type { GeneralIntent } from "./general-intent";

export interface ReplyWorthyInput {
  /** True when the sender is unambiguously system-generated (classifyInboundSender). */
  isMachineSent: boolean;
  /** Resolved general intent, or null when it could not be determined. */
  generalIntent: GeneralIntent | null;
  /** Mass/marketing mail (carries an unsubscribe affordance / list headers). */
  isBulk: boolean;
}

export interface ReplyWorthyResult {
  replyWorthy: boolean;
  /** Product-language reasons explaining the decision (observability / audit). */
  reasons: string[];
}

/**
 * Mapping onto the REAL `GeneralIntent` taxonomy (general-intent.ts):
 *   meeting_request, scheduling, question, request_action, fyi_update,
 *   notification, promotion_newsletter, invoice_billing, receipt_confirmation,
 *   security_account, support_request, personal, social, automated_no_reply,
 *   sales_reply.
 *
 * NO-REPLY intents — mail that, by its nature, no human replies to. The brief
 * named "automated/no-reply, promotion/newsletter, notification,
 * receipt/confirmation"; mapped to the real enum values below. We ALSO fold in
 * the two remaining transactional members that are no-reply by the same logic:
 *   - `invoice_billing`   — billing/receipt mail (same family as receipt_confirmation),
 *   - `security_account`  — OTP / account-security notices (e.g. the HubSpot OTP case),
 * because a suggested reply draft on a one-time-passcode or an invoice is
 * exactly the noise this gate exists to suppress. Documented as a deliberate
 * extension of the 4-step mapping.
 */
const NO_REPLY_INTENTS: ReadonlySet<GeneralIntent> = new Set<GeneralIntent>([
  "automated_no_reply",
  "promotion_newsletter",
  "notification",
  "receipt_confirmation",
  "invoice_billing",
  "security_account",
]);

/**
 * HUMAN-RESPONSE intents — mail a human would reply to. The brief named
 * "question, meeting/scheduling request, request-action, sales reply, support
 * request, personal"; `meeting/scheduling` maps to the real taxonomy's TWO
 * members `meeting_request` and `scheduling`.
 */
const HUMAN_RESPONSE_INTENTS: ReadonlySet<GeneralIntent> = new Set<GeneralIntent>([
  "question",
  "meeting_request",
  "scheduling",
  "request_action",
  "sales_reply",
  "support_request",
  "personal",
]);

/**
 * Decide whether an inbound conversation is worth offering an AI reply draft.
 * Pure, deterministic; composes existing signals with a recall bias.
 *
 * Decision order (first match wins):
 *   1. machine-sent          → not worthy.
 *   2. no-reply intent gate   → not worthy; OR bulk + not a human-response intent → not worthy.
 *   3. human-response intent  → worthy.
 *   4. default (ambiguous, not machine, not bulk) → worthy (recall bias).
 */
export function isReplyWorthy(input: ReplyWorthyInput): ReplyWorthyResult {
  // 1. Machine-sent senders never need a human reply.
  if (input.isMachineSent === true) {
    return { replyWorthy: false, reasons: ["machine-sent sender"] };
  }

  const intent = input.generalIntent;
  const isHumanResponseIntent = intent !== null && HUMAN_RESPONSE_INTENTS.has(intent);

  // 2. No-reply intent gate.
  if (intent !== null && NO_REPLY_INTENTS.has(intent)) {
    return { replyWorthy: false, reasons: ["no-reply intent", `intent: ${intent}`] };
  }
  // Bulk/marketing mail is not worth a draft UNLESS the intent is a genuine
  // human-response intent (a bulk-flagged but clearly human reply still counts).
  if (input.isBulk === true && !isHumanResponseIntent) {
    return { replyWorthy: false, reasons: ["bulk/marketing mail"] };
  }

  // 3. Clear human-response intent → worthy.
  if (isHumanResponseIntent) {
    return { replyWorthy: true, reasons: ["human-response intent", `intent: ${intent}`] };
  }

  // 4. Default: not machine, not bulk, no disqualifying intent → worthy.
  //    Recall bias — never hide a real reply opportunity on ambiguous human mail.
  return {
    replyWorthy: true,
    reasons: ["default human mail (recall bias)", `intent: ${intent ?? "unknown"}`],
  };
}
