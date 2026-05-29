/**
 * Playbook extractor prompt + response schema (B4 LLM, _specs/pilae-machine R11.2).
 *
 * Pure module: builds the prompt fed to Claude for objection / accroche
 * / question extraction from a completed call, meeting, or reply, and
 * declares the Zod schema the LLM must satisfy. The Inngest fn in
 * `playbook-extract-from-activity.ts` calls Claude with this prompt
 * and routes the typed result through the validator before emission.
 *
 * Why this lives separate from the Inngest module:
 *   - The prompt is the contract with the model; keeping it pure
 *     means a regression there is testable without hitting the API.
 *   - The schema is reused by validators and (eventually) by a
 *     Claude-API-side `response_format` config when the SDK supports
 *     it.
 *
 * The prompt deliberately constrains output to ≤ 6 entries per
 * interaction (a 30-minute call rarely produces more genuine
 * learnings; padding past 6 reliably means the model is filling).
 */

import { z } from "zod";
import {
  MAX_CONTENT_LENGTH,
  MIN_CONTENT_LENGTH,
  PLAYBOOK_ENTRY_TYPES,
} from "./capture";

export const MAX_ENTRIES_PER_INTERACTION = 6;

export const extractionResponseSchema = z.object({
  entries: z
    .array(
      z.object({
        type: z.enum(PLAYBOOK_ENTRY_TYPES),
        content: z.string().min(MIN_CONTENT_LENGTH).max(MAX_CONTENT_LENGTH),
        outcomeLabel: z.string().nullable().optional(),
        perfScore: z.number().min(0).max(1).nullable().optional(),
      }),
    )
    .max(MAX_ENTRIES_PER_INTERACTION),
});

export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;

export type ExtractorContext = {
  interactionType: string;
  direction: "inbound" | "outbound" | "internal" | "unknown";
  dealStage?: string | null;
  contactTitle?: string | null;
  content: string;
};

const MAX_CONTENT_FOR_PROMPT = 4000;

/**
 * Build the extraction prompt. The structure mirrors the existing
 * coaching/scoreInteraction prompt (lib/coaching/interaction-scorer.ts)
 * so both fan-out consumers of `coaching/post-interaction` see a
 * consistent context shape — easier to debug, easier to swap models.
 *
 * Content is truncated to `MAX_CONTENT_FOR_PROMPT` chars because
 * objections / accroches / questions cluster near the front and end
 * of a transcript; longer body usually doesn't add new entries and
 * just inflates input tokens.
 */
export function buildExtractionPrompt(ctx: ExtractorContext): string {
  const truncated = ctx.content.length > MAX_CONTENT_FOR_PROMPT;
  const body = truncated
    ? ctx.content.slice(0, MAX_CONTENT_FOR_PROMPT) +
      "\n\n[... transcript truncated ...]"
    : ctx.content;

  return `You are distilling a sales conversation into reusable playbook entries.

## Interaction
Type: ${ctx.interactionType}
Direction: ${ctx.direction}
${ctx.dealStage ? `Deal stage: ${ctx.dealStage}\n` : ""}${ctx.contactTitle ? `Contact title: ${ctx.contactTitle}\n` : ""}
## Content
${body}

## Task
Extract up to ${MAX_ENTRIES_PER_INTERACTION} entries that would help the team in future conversations. Each entry is ONE of:
  - "objection"   — a real concern the prospect raised (price, timeline, fit, alternative vendor, internal blocker)
  - "accroche"    — a hook or framing that landed (resonated with the prospect, opened up the conversation)
  - "question"    — a discovery question worth asking next time (the founder asked it OR wishes they had)

## Rules
- Quote the substance, not the literal transcript. Each entry's content must be a self-contained learning a teammate can apply without re-reading the transcript.
- ${MIN_CONTENT_LENGTH}-${MAX_CONTENT_LENGTH} characters. Fragments below ${MIN_CONTENT_LENGTH} chars are too short; transcript dumps above ${MAX_CONTENT_LENGTH} are too long.
- Do NOT invent entries. If the conversation produced nothing reusable, return an empty array.
- outcomeLabel is optional — only set when the transcript explicitly shows the outcome (e.g. "led to deep-dive", "stalled deal").
- perfScore is optional and ONLY set 0..1 when the founder explicitly judged the entry as effective/ineffective in the conversation. Default null.

## Output shape
Return JSON matching:
{ "entries": Array<{ type, content, outcomeLabel?, perfScore? }> }`;
}
