/**
 * Bounded body excerpt for a brain activity.
 *
 * The brains historically surfaced only an activity's `summary` into the LLM —
 * and for an email `summary` IS the subject line (email-capture.ts), so the body
 * (rawContent), where the client's actual "go" / objection / next step lives,
 * never reached the model. The deal read reasoned on subject lines.
 *
 * This exposes a hard-capped head of that body. The cap is the prompt-budget
 * guard: the chat brain tool targets ~3K tokens (see lib/chat/tools/brain.ts),
 * so a body excerpt has to stay small — 160 chars carries the decision signal
 * ("Yes, we're good to go, send the contract by Friday") without ballooning the
 * activity list. Callers fetch only `left(rawContent, 300)` from Postgres so a
 * 500k body is never pulled into memory just to be trimmed here.
 *
 * Returns null for bodyless activities (stage changes, meeting rows, …) so the
 * consumer can omit the key entirely and spend zero tokens on them.
 */
export const ACTIVITY_EXCERPT_MAX = 160;

export function activityExcerpt(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  return collapsed.length > ACTIVITY_EXCERPT_MAX
    ? collapsed.slice(0, ACTIVITY_EXCERPT_MAX) + "…"
    : collapsed;
}
