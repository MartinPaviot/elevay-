# Tasks — Inbound lead recognition

## Tranche 1 — deterministic gates + warm-leads semantics (this sprint)

- [ ] **T1. Pure classifier module** `lib/inbound/lead-classification.ts`
  - `classifyInboundSender(input): SenderClassification`
  - role set documented as protocol/addressing conventions
  - verify: unit truth table green
- [ ] **T2. Classifier unit tests** `__tests__/inbound-lead-classification.test.ts`
  - role local-part, List-Unsubscribe, Precedence, Auto-Submitted, clean
    human, header case-insensitivity, malformed from → unknown (no throw)
  - verify: `vitest run inbound-lead-classification`
- [ ] **T3. Capture gating** `lib/capture/email-capture.ts`
  - add `headers?` to `InboundEmailInput`
  - compute classification, write `metadata.leadClassification`
  - gate auto-creation on `!isMachineSent` (R7); known company → company-attach
  - verify: extend `__tests__/last-interaction-capture.test.ts` with a
    `noreply@` case (nothing created, no `contact/created`)
- [ ] **T4. Warm-leads floor** `lib/deals/warm-leads.ts`
  - add `outboundCount` to aggregate
  - exclude role addresses; require two-way OR ICP-fit for unsolicited
  - verify: update `__tests__/warm-leads.test.ts` (add `outboundCount`,
    add a `noreply@` exclusion case + an unsolicited-off-ICP exclusion case)
- [ ] **T5. Gate** — `tsc` clean + full `vitest run` green (no regression)

## Tranche 2 — LLM relationship classifier + ICP floor (next)

- [ ] LLM stage 2 in classifier (Haiku, ICP-aware, reuse `tracedGenerateObject`
      + `getModelForTask("lightweight")` like `email-intelligence.ts`); cache on
      activity metadata; only runs on human, non-tracked-reply mail.
- [ ] Wire RFC headers from EmailEngine payload + IMAP/Gmail/Outlook into
      `captureInboundEmail({ headers })`.
- [ ] `determinePriority` (`skills/scoring/inbound-lead-qualification`) requires
      `senderType==='human' && relationshipToUs==='prospect'` → else disqualified.
- [ ] Add `isInboundLead` to `leadClassification`; `rankWarmLeads` &
      `hot-inbounds` read it.

## Tranche 3 — correction loop + UI + backfill (next)

- [ ] "Not a lead" / "This is a lead" control on `HotInboundsWidget` &
      `WarmLeadPrompt`; the "why" reason line.
- [ ] Persist corrections; inject as few-shot into stage 2; per-domain
      short-circuit.
- [ ] One-time reclassify sweep over already-captured activities/contacts
      (script, like `_rolefix.mjs`).
