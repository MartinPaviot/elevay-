/**
 * M12-R1 (outreach-autopilot T7) — message_features v1: cheap deterministic
 * features of the outbound copy, captured on the outreach_decisions learning
 * record at transport time (lib/outreach/decision-record.ts).
 *
 * v1 is deliberately small: a whitespace word count + a pattern-detected CTA
 * type. `tone` needs a model call and is not knowable at transport — null v1.
 * gradeEmail (email-quality-grader) scores dimensions but has no discrete
 * cta_type extractor, hence this helper. Pure, no I/O — unit-tested.
 */

export type CtaType = "meeting-ask" | "link-click" | "question" | "none";

export interface MessageFeatures {
  /** Whitespace-split word count of the plain-text body (0 for empty/null). */
  length_words: number;
  /** Dominant call-to-action. Precedence when several patterns match:
   *  meeting-ask > link-click > question > none — a "15 minutes next week?"
   *  is a meeting ask, not a generic question. */
  cta_type: CtaType;
  /** Null v1 — tone extraction needs a model, not knowable at transport. */
  tone: null;
}

/** Meeting-ask vocabulary (EN + the FR forms the Pilae copy uses).
 *  Unicode-aware boundaries instead of \b: accented letters are not \w in JS,
 *  so a leading \b can never match before "é" — "échanger" (the common Pilae
 *  phrasing) would silently fall through. */
const MEETING_ASK =
  /(?:^|[^\p{L}\p{N}])(call|meet|meeting|chat|calendar|schedule|book(?:ing)?|demo|catch up|hop on|connect for|15 ?min(?:ute)?s?|30 ?min(?:ute)?s?|disponibilit[\p{L}]*|rendez-vous|cr[ée]neau|[ée]change(?:r)?)(?![\p{L}\p{N}])/iu;

/** Link-click asks: a literal URL or click-through phrasing. */
const LINK_CLICK =
  /https?:\/\/|\b(click|check out|take a look|have a look|see the link|voir le lien)\b/i;

export function extractMessageFeatures(
  body: string | null | undefined,
): MessageFeatures {
  const text = (body ?? "").trim();
  const length_words = text.length === 0 ? 0 : text.split(/\s+/).length;

  let cta_type: CtaType = "none";
  if (MEETING_ASK.test(text)) cta_type = "meeting-ask";
  else if (LINK_CLICK.test(text)) cta_type = "link-click";
  else if (text.includes("?")) cta_type = "question";

  return { length_words, cta_type, tone: null };
}
