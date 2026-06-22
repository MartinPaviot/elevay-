# RECONCILE.md — Spec 26 Reply Ingest, Sentiment and Opt-Out (T0)

> Read-only reconciliation. Inbox reading-pane triage exists; outbound sequence-reply ingest with halt/suppress/hot-lead routing does not. A misclassification keeps mailing someone who said stop — abstention beats a guess.

## Verdict summary

| AC | Requirement | Verdict | One-line |
|---|---|---|---|
| AC1 | Ingest replies from email (23) + LinkedIn (24) webhooks → canonical reply event | **missing** | `instantly-unibox` ingests inbound to activities; no canonical reply event for the sequence engine |
| AC2 | Classify sentiment + intent via agent (04); eval-gated before action | **partial** | `lib/inbox/classify-intent.ts` / `general-intent.ts` triage the reading pane, not the spec-26 sentiment+intent enums driving halt/suppress |
| AC3 | opt-out → suppress (22) + halt (25); OOO → reschedule | **missing** | No reply-driven suppression/halt/reschedule routing |
| AC4 | positive/interested → hot-lead event (28) | **missing** | No hot-lead emission from a reply |
| AC5 | Idempotent per provider message id; low-confidence → needs-review | **missing** | No reply idempotency / abstention gate |

## Reuse inventory (injected)
- spec-04 `runAgent` (classify), spec-22 `addSuppression`, spec-25 `haltSequence`, spec-28 hot-lead emit — injected so routing is deterministic and stub-tested.
- `lib/inbox/classify-intent.ts` — the inbox triage stays separate (reading pane); spec-26 is the outbound reply pipeline.

## Decisions (taken, full autonomy)
1. Build `lib/reply/*` (blast radius `reply/*`): `ingest.ts`, `classify.ts`, `route.ts`, `index.ts`, tests.
2. **AC1:** `ingestReply` normalizes email (Instantly) + LinkedIn (HeyReach) raw payloads → a canonical `ReplyEvent` (providerMessageId, source, contactId, enrollmentId?, text, receivedAt).
3. **AC2/AC5:** `classifyReply` via injected agent → `{sentiment, intent, confidence}`; an eval gate (valid enums + confidence floor + grounded rationale) sets `needsReview` on failure/low-confidence — never a guessed auto-action.
4. **AC3/AC4 routing (deterministic):** `routeReply` — `needsReview` → review; `opt_out` → suppress + halt; `ooo` → reschedule (no halt/suppress); otherwise halt (a human replied) and, when positive/interested, emit a hot-lead.
5. **AC5 idempotency:** dedupe per `providerMessageId` via an injected store — a duplicate returns the prior outcome, never re-suppressing/re-halting/re-emitting.
6. **No schema** (agent/suppression/halt/hot-lead/store injected) → mergeable off main.
