# chat-opener v2 — Recipe catalog

Extends v1 (see requirements.md/design.md). Founder ask 2026-07-02:
capability-showcase chips ("draft a cold sequence", "find me a list for
call mode", "bilan des mails") with personalization pushed further than
onboarding-static suggestions.

## Design

`lib/chat/recipes.ts` — 8 recipes, each `{id, priority, gate, label, send}`:

| Recipe | Gate (data-readiness) | Slot-filled label |
|---|---|---|
| define-icp | 0 ICPs AND ≥50 companies | "Define my ICP from my {n} accounts" |
| call-list | ≥10 contacts with phone | "Build today's call list ({n} callable)" |
| cold-sequence | KB >0 AND ≥20 contacts | "Draft a cold sequence for \"{biggest list}\"" |
| inbound-recap | inbound email 7d >0 | "Recap the {n} emails received this week" |
| deals-at-risk | open deals >0 (skipped if deal work chip) | "Check my {n} open deals for risk" |
| enroll-list | list ≥10 members AND ≥1 sequence | "Enroll \"{list}\" ({n} accounts) in a campaign" |
| signals-scan | ≥50 companies | "Scan my {n} accounts for buying signals" |
| sequence-performance | ≥1 sequence with enrollments | "How are my campaigns performing?" |

Rules:
1. **Gate** — a recipe only shows when the demo lands (cold-sequence gated
   on the KB: empty asset blocks produce empty copy, eval 2026-06-26).
2. **Slots** — labels carry the tenant's real counts/names; the chip
   itself proves the agent knows the workspace.
3. **Rotation** — eligible sorted by priority, start offset = UTC epoch-day
   % eligible.length, circular pick. Every eligible recipe surfaces within
   eligible.length days; stable within a day. No storage, no inference.
4. **Redundancy** — a work chip suppresses its recipe twin (deal_risk work
   chip → no deals-at-risk recipe).
5. All sends are draft-only / HITL-gated ("do not enroll or send").

Chip assembly change (opener.ts): work chips cap at 3 (was 4) so one
capability-discovery slot is guaranteed on busy tenants; recipes fill to
3, take slot 4 after 3 work chips; resume takes the last free slot.

Route: `loadTenantSignals(tenantId)` — 8 parallel cheap counts
(contacts+phone, companies, KB, open deals, ICPs, inbound 7d, biggest
list, sequences+enrollments), each fail-soft to zero → a broken source
disables its recipes, never the opener.

## Deferred (named)

- Click/impression-based ranking (needs an impression store; PostHog
  events chat_opener_chip_clicked already collect the data) — v3.
- Time-of-day recipes (morning recap, pre-meeting prep) — meeting prep
  already covered by the work lane.
- LLM-written labels — recompute-cost precedent (VOC).

## Acceptance

1. GIVEN a tenant with data (companies, phones, KB, lists) WHEN the opener
   renders THEN recipe chips carry that tenant's real counts/names.
2. GIVEN 3+ work chips THEN slot 4 is a recipe (never zero discovery).
3. GIVEN a gate unmet (e.g. KB empty) THEN that recipe never appears.
4. GIVEN two consecutive days with >slots eligible THEN the recipe set
   differs (rotation) but is stable within a day.
5. GIVEN every count query failing THEN the opener still renders (work
   chips + resume only).
