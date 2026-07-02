/**
 * Spec 26 (AC2/AC5) — reply classification via the spec-04 agent, eval-gated.
 * A failed eval or a low-confidence answer becomes `needsReview` so it routes to
 * a human, never to an automatic opt-out or hot-lead. Abstention beats a guess.
 */

import type { ReplyEvent } from "./ingest";

export type Sentiment = "positive" | "neutral" | "negative";
// M8-R1 (T10) — "objection" is a FIRST-LEVEL intent: a clear pushback is the
// highest-value reply to route precisely (it feeds the objection knowledge
// path), not a flavor of "not_now".
export type Intent = "interested" | "objection" | "not_now" | "referral" | "opt_out" | "ooo";

export const SENTIMENTS: ReadonlySet<string> = new Set<Sentiment>(["positive", "neutral", "negative"]);
export const INTENTS: ReadonlySet<string> = new Set<Intent>(["interested", "objection", "not_now", "referral", "opt_out", "ooo"]);

export interface ReplyClassification {
  sentiment: Sentiment;
  intent: Intent;
  confidence: number;
  needsReview: boolean;
  rationale?: string;
}

export interface ClassifyAgentResult {
  evalPassed: boolean;
  value?: { sentiment: string; intent: string; confidence: number; rationale: string };
  reason?: string;
}

export type RunClassifyAgent = (input: { kind: "reply-classification"; reply: ReplyEvent }) => Promise<ClassifyAgentResult>;

export interface ClassifyDeps {
  runAgent: RunClassifyAgent;
  /** Confidence floor below which the reply goes to review. Default 0.6. */
  minConfidence?: number;
}

/** Exported (T10): the LIVE classifier (inngest processReply) shares this
 *  floor so "below confidence -> review queue" has ONE source of truth. */
export const DEFAULT_MIN_CONFIDENCE = 0.6;

const REVIEW: ReplyClassification = { sentiment: "neutral", intent: "not_now", confidence: 0, needsReview: true };

/** Rationale must reference a token from the reply text (grounding guard). */
function grounded(rationale: string, reply: ReplyEvent): boolean {
  const r = rationale.toLowerCase();
  if (!r.trim()) return false;
  const tokens = reply.text.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
  return tokens.length === 0 || tokens.some((w) => r.includes(w));
}

/**
 * Classify a reply. Returns `needsReview` (no auto-action) on any of: agent
 * error, failed eval, invalid enum, low confidence, or an ungrounded rationale.
 */
export async function classifyReply(reply: ReplyEvent, deps: ClassifyDeps): Promise<ReplyClassification> {
  const floor = deps.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  let result: ClassifyAgentResult;
  try {
    result = await deps.runAgent({ kind: "reply-classification", reply });
  } catch {
    return { ...REVIEW, rationale: "agent error" };
  }

  const v = result.value;
  if (!result.evalPassed || !v || !SENTIMENTS.has(v.sentiment) || !INTENTS.has(v.intent)) {
    return { ...REVIEW, rationale: v?.rationale ?? result.reason ?? "eval failed / invalid enum" };
  }
  if (v.confidence < floor || !grounded(v.rationale, reply)) {
    // Keep the predicted labels for the reviewer, but do not let them auto-act.
    return { sentiment: v.sentiment as Sentiment, intent: v.intent as Intent, confidence: v.confidence, needsReview: true, rationale: v.rationale };
  }
  return { sentiment: v.sentiment as Sentiment, intent: v.intent as Intent, confidence: v.confidence, needsReview: false, rationale: v.rationale };
}
