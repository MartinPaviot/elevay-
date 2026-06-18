# CLE-13 — tracked follow-ups (post-implementation)

CLE-13 shipped (tighten-only, adversarially reviewed, no Critical): the orphaned
`enforceSendingIdentity` is wired at all 5 send chokepoints via one shared
`evaluateSend` gate; `signalAutoEnroll` routes through `decideAction`
(sequence-enrollment is outbound+confirm:always → always defers); the opt-out gap
on the SMTP cron + meeting-follow-up is closed (`isSuppressed` queries
`email_optouts`, tenant-scoped, covers hard bounces); the send-window check is now
computed in the tenant timezone (was UTC). No migration. tsc 0; 54 tests.

The following are deliberate, tracked deferrals — not oversights.

## 1. Approving a deferred sequence-enrollment is a dead-end (follow-up)
When `signalAutoEnroll` defers, it records an `awaitingApproval` agent action with
`actionType:"sequence-enrollment"`. The action-executor dispatcher
(`lib/agents/action-executors.ts`) has **no handler** for that actionType, so if a
founder approves the deferred row it is marked `failed` and the contact is never
enrolled. This is **tighten-safe** (no autonomous or approved send ever leaks — the
failure mode is "does nothing", never "sends unapproved"), and the design accepted
"skip-and-notify" for M2. But the approve button on a deferred enrollment is
currently inert. Follow-up: add a `sequence-enrollment` executor that performs the
enrollment when the founder approves. Low urgency while there are no active
sequences + autonomy enabled.

## 2. Auto-enroll "always defers" rests on a code-trace guarantee, not a behavioral test
`signal-auto-enroll.approval.test.ts` mocks `enforceAgentApprovalMode` for the
auto-high-confidence / execute cases. The always-defers guarantee is real (verified
by trace: `GUARDED_ACTION_METADATA["sequence-enrollment"]` is `outbound:true,
confirm:"always"` → `decideAction` returns confirm/queue under every mode), but a
future change to that metadata wouldn't be caught by a behavioral test here. Consider
an end-to-end test driving the real authority.

## 3. Operator note: SMTP-custom tenants must set sendingMailboxMode explicitly
With DEFAULTS now applied (`primary-with-caps`, cold-blocked), an SMTP-custom tenant
who never set `sendingMailboxMode` will have cold SMTP sends blocked that previously
went out. This is the intended tightening, but operators must set
`external-connected` explicitly for those tenants or cold SMTP outreach silently
fails (lands as `failed` with an identity-block reason).

## 4. Minor: dead fail-open branch in sending-gate.ts
`evaluateSend` carries a `settings === null → fail open (send)` branch that is
unreachable in prod (`getTenantSettings` always merges DEFAULTS; no caller passes
null). Verified safe/unreachable. Consider deleting the branch so the gate has no
fail-open path at all.
