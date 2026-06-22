/**
 * Spec 26 (AC3/AC4/AC5) — deterministic action routing for a classified reply.
 * opt-out suppresses + halts; OOO reschedules; a real reply halts and, when
 * positive/interested, emits a hot-lead. Idempotent per provider message id: a
 * "stop" reply can never result in a further send, and a duplicate webhook never
 * re-acts.
 */

import type { ReplyEvent } from "./ingest";
import type { ReplyClassification } from "./classify";

export type ReplyAction = "review" | "opt_out" | "reschedule" | "hot_lead" | "halted";

export interface ReplyOutcome {
  action: ReplyAction;
  suppressed: boolean;
  halted: boolean;
  rescheduled: boolean;
  hotLead: boolean;
  deduped?: boolean;
}

export interface ReplyIdempotencyStore {
  get(providerMessageId: string): Promise<ReplyOutcome | null>;
  set(providerMessageId: string, outcome: ReplyOutcome): Promise<void>;
}

export interface RouteDeps {
  /** spec-22 — add an opt-out suppression for the replier. */
  addSuppression: (reply: ReplyEvent) => void | Promise<void>;
  /** spec-25 — halt the contact's sequence (releases the lock). */
  haltSequence: (reply: ReplyEvent, reason: string) => void | Promise<void>;
  /** Reschedule the sequence (OOO) without halting. */
  reschedule: (reply: ReplyEvent) => void | Promise<void>;
  /** spec-28 — emit a hot-lead event for CRM/Slack. */
  emitHotLead: (reply: ReplyEvent, classification: ReplyClassification) => void | Promise<void>;
  idempotency: ReplyIdempotencyStore;
}

/**
 * Route a classified reply to its side effects. A `needsReview` classification
 * takes no automatic action. Idempotent on `reply.providerMessageId`.
 */
export async function routeReply(reply: ReplyEvent, classification: ReplyClassification, deps: RouteDeps): Promise<ReplyOutcome> {
  // AC5 — idempotency: a duplicate webhook returns the prior outcome, no re-action.
  const prior = await deps.idempotency.get(reply.providerMessageId);
  if (prior) return { ...prior, deduped: true };

  let outcome: ReplyOutcome;

  if (classification.needsReview) {
    // AC5 — low-confidence / failed eval: human review, never an auto-action.
    outcome = { action: "review", suppressed: false, halted: false, rescheduled: false, hotLead: false };
  } else if (classification.intent === "opt_out") {
    // AC3 — opt-out: suppress immediately and halt.
    await deps.addSuppression(reply);
    await deps.haltSequence(reply, "opt_out");
    outcome = { action: "opt_out", suppressed: true, halted: true, rescheduled: false, hotLead: false };
  } else if (classification.intent === "ooo") {
    // AC3 — out-of-office: reschedule, do not halt.
    await deps.reschedule(reply);
    outcome = { action: "reschedule", suppressed: false, halted: false, rescheduled: true, hotLead: false };
  } else {
    // A genuine human reply halts the automated sequence (spec 25).
    await deps.haltSequence(reply, "replied");
    const hot = classification.sentiment === "positive" || classification.intent === "interested";
    if (hot) await deps.emitHotLead(reply, classification); // AC4
    outcome = { action: hot ? "hot_lead" : "halted", suppressed: false, halted: true, rescheduled: false, hotLead: hot };
  }

  await deps.idempotency.set(reply.providerMessageId, outcome);
  return outcome;
}
