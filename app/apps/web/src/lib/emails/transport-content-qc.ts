/**
 * M13-G5 (outreach-autopilot T3) — deterministic CONTENT checks at TRANSPORT,
 * run inside `evaluateSend` for outreach-class sends only (a founder's reply
 * to a correspondent is never content-gated here; G2-G4 own generation-time
 * quality). Composes the spec-20 primitives (checkSpamSignals, countLinks)
 * under a transport profile:
 *
 *   - spam heuristics on the STORED body (text, else tag-stripped html);
 *   - link count on the stored body — PRE-footer by construction: the send
 *     paths append the unsubscribe link AFTER the gate, so it never counts;
 *   - an unsubscribe MECHANISM must exist: either the path attaches one
 *     (RFC-8058 header / footer — `unsubscribeProvided`) or the body already
 *     carries an opt-out mention (M9-R2).
 *
 * Deliberately NOT here (generation-time rules, not transport rules): the
 * plain-text-only check (stored transport bodies are legitimately HTML), the
 * cold-outbound length window, brand/banned-words (G4), grounding (G2).
 *
 * Pure and synchronous — adds no I/O to the gate (<1 ms).
 */

import { checkSpamSignals } from "@/lib/emails/email-spam-check";
import { countLinks } from "@/lib/copy/variants/qc";

export interface TransportContentInput {
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  /** The send path attaches a working unsubscribe mechanism (header/footer). */
  unsubscribeProvided: boolean;
}

export interface TransportContentResult {
  passed: boolean;
  failures: string[];
}

/** Transport link budget. Generation (runQc) enforces 1; stored production
 *  bodies legitimately carry a signature or booking link on top — 3 pre-footer
 *  is the deliverability ceiling before "link-heavy" filtering risk. */
export const TRANSPORT_MAX_LINKS = 3;
/** Same medium threshold as the generation gate (runQc default). */
export const TRANSPORT_MAX_SPAM_SCORE = 50;

const UNSUB_MENTION = /unsubscrib|d[ée]sinscri|d[ée]sabonn|opt[ -]?out|se retirer de cette liste/i;

/** Minimal tag strip for spam/mention checks when only HTML is stored. */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function runTransportContentQc(
  input: TransportContentInput,
): TransportContentResult {
  const text =
    input.bodyText && input.bodyText.trim().length > 0
      ? input.bodyText
      : stripHtmlToText(input.bodyHtml ?? "");
  const failures: string[] = [];

  const spam = checkSpamSignals(input.subject ?? "", text);
  if (spam.score >= TRANSPORT_MAX_SPAM_SCORE) {
    failures.push(`spam:${spam.warnings.map((w) => w.code).join("|")}`);
  }

  // Count on the richer source: an HTML body hides anchors the text mirror lacks.
  const links = countLinks(input.bodyHtml ?? text);
  if (links > TRANSPORT_MAX_LINKS) {
    failures.push(`links:${links}>max${TRANSPORT_MAX_LINKS}`);
  }

  if (
    !input.unsubscribeProvided &&
    !UNSUB_MENTION.test(`${text} ${input.bodyHtml ?? ""}`)
  ) {
    failures.push("unsubscribe:missing");
  }

  return { passed: failures.length === 0, failures };
}
