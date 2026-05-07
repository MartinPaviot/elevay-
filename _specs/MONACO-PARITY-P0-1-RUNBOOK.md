# MONACO-PARITY P0-1 — Sequence Drafts Queue RUNBOOK

Operational manual for the sequence-drafts review pipeline. Linked
from the `/sequences/review` UI footer and from the alerting
dashboard description fields.

## What the system does

Every sequence step that would have sent automatically now generates
a `sequence_drafts` row in `pending_approval` status (for tenants on
`manual` mode). The founder reviews via `/sequences/review` and
either approves (queues for send), edits (revision), or rejects (kills
the draft + pauses the enrollment + feeds the rejection learner). Drafts
expire after 72h pending without review.

## Core invariants

- A draft never sends without an explicit `approve` transition.
- An approved draft cannot be un-approved (terminal lifecycle going
  forward — only `sent` follows).
- The version stamp on every mutation route prevents two reviewers
  from racing to opposite outcomes (one approves, one rejects within
  the same second). The DB-level `UPDATE WHERE version=N` is the
  ultimate guard.
- Rejected enrollments default to `paused` to prevent the next step
  firing on a contact whose touch was just rejected.

## Data flow

```
sequence cron (every 2 min)
        │
        ▼
sequence/step-due event ──┐
        │                 │
        ▼                 │
routeSequenceStepToDraft  │
   (manual mode)          │
        │                 │
        ▼                 │
sequence_drafts row       │
   pending_approval       │
        │                 │
        ▼                 │
/sequences/review UI      │
        │                 │
   ┌────┴────┐            │
   ▼         ▼            ▼
approve    reject     sendSequenceStep
   │         │       (auto mode only)
   │         ▼
   │     draft.rejected event
   │         │
   │         ▼
   │     draftRejectionLearner
   │         │
   │         ▼
   │     sequences.campaignConfig.rejectionInsights
   │
   ▼
email.send.queued event
   │
   ▼
existing email-send-worker
   │
   ▼
draft status → sent
```

## Key files

| Concern | File |
|---|---|
| State machine | `lib/sequence-drafts/state-machine.ts` |
| Router pure logic | `lib/sequence-drafts/router.ts` |
| Expiry pure logic | `lib/sequence-drafts/expiry.ts` |
| Rejection classifier | `lib/sequence-drafts/rejection-classifier.ts` |
| Inngest router | `inngest/sequence-draft-router.ts` |
| Inngest expiry cron | `inngest/sequence-draft-expiry.ts` |
| Inngest learner | `inngest/sequence-draft-rejection-learner.ts` |
| API routes | `app/api/sequences/drafts/...` |
| UI page | `app/(dashboard)/sequences/review/page.tsx` |
| UI components | `components/sequence-draft-{list,preview,reject-modal}.tsx` |
| Migration | `drizzle/0045_sequence_drafts.sql`, `drizzle/0046_tenant_approval_mode_default.sql` |

## Tenant approval mode

Stored as `tenants.settings.approvalMode` (`"manual"` | `"auto"`).

Read via `decideRouteMode(settings)` — defaults to `"manual"` when
absent or unrecognised. Migration 0046 backfills `"manual"` for every
existing tenant that didn't have the key.

Switching a tenant to auto :
```sql
UPDATE tenants
SET settings = jsonb_set(settings, '{approvalMode}', '"auto"'),
    updated_at = NOW()
WHERE id = 'tenant-xyz';
```

The next `sequence/step-due` event for that tenant takes the direct-
send path.

Switching back to manual : same statement with `'"manual"'`. Effects
the next event ; in-flight drafts already in `pending_approval` stay
where they are.

Audit who's on what mode :
```sql
SELECT * FROM tenant_approval_modes;
-- approval_mode | tenant_count | last_change_at
-- manual        |           47 | 2026-05-07 ...
-- auto          |            3 | 2026-04-22 ...
```

## Per-tenant draft expiry hours

`tenants.settings.draftExpiryHours` — default 72, clamped [1, 720].

Override for a specific tenant :
```sql
UPDATE tenants
SET settings = jsonb_set(settings, '{draftExpiryHours}', '24'::jsonb)
WHERE id = 'tenant-xyz';
```

## Alarms & on-call playbook

### Pending queue depth > 50 (per tenant, sustained 1h)

Founder isn't reviewing fast enough. UI nudges via the home page
ribbon, but if the queue keeps growing, autopilot is generating more
drafts than the human can process.

**Investigate**
1. Check `/sequences/review` — is there a single sequence dominating ?
2. Pull the dominant sequence's `campaignConfig.rejectionInsights` —
   maybe it's auto-rejecting via the learner because the same flaw
   keeps recurring, but new drafts keep landing.

**Fix path**
- Pause the dominant sequence : `UPDATE sequences SET status='paused' WHERE id='...'`.
- Or batch-reject the older pendings through the API (loop calling
  `/api/sequences/drafts/[id]/reject`).

### Approve → send latency > 5 min

`email.send.queued` event drains slowly. Check Inngest worker health
for `email-send-worker` — usually a SMTP rate-limit or mailbox-
connection issue.

### Rejection rate > 30% over 7d (per sequence)

Sequence is mis-targeted or poorly written.

**Investigate**
1. Open the sequence in `/sequences/[id]` — read
   `campaignConfig.rejectionInsights.dominantInsight`. The category
   tells you what's wrong (tone / timing / personalization / trigger /
   content).
2. Sample 5 rejected drafts — read the founder's actual reason.

**Fix path**
- Tone : edit the step's `bodyTemplate` to be softer. If the
  personaliser is the culprit, lower its temperature.
- Timing : add a "do not send during X" guard in the sequence
  trigger config.
- Personalization : check `agent_traces` for the personaliser — has
  the prompt changed recently ?
- Trigger : the upstream signal source is off. Disable the sequence
  trigger temporarily.

### Expire rate spiking (per tenant)

Founder is letting drafts age out without reviewing — usually
because the queue is overwhelming.

**Fix path** : same as "queue depth" alarm. The product solution is
to reduce sequence enrollment velocity until review throughput
catches up.

### Draft-router DLQ (Inngest dead letter)

`route-sequence-step-to-draft.dead_letter` — typically means the
personaliser threw or the DB was unreachable. Check the trace, fix
the underlying cause, then Inngest will retry from the queue.

## Manual operations

### Approve a draft via API
```bash
curl -X POST -H 'Cookie: ...' -H 'Content-Type: application/json' \
  https://app.elevay.io/api/sequences/drafts/{id}/approve \
  -d '{"version":1}'
```

### Bulk-reject all pending drafts for a sequence (sql, not via API)
```sql
UPDATE sequence_drafts
SET status = 'rejected',
    review_reason = 'Bulk rejected by ops — sequence paused',
    reviewed_at = NOW(),
    reviewed_by = 'system',
    version = version + 1
WHERE sequence_id = '...'
  AND status = 'pending_approval';
```

The rejection learner doesn't fire for ops-driven rejections (the
`draft.rejected` event isn't emitted). That's intentional — the
learner only learns from founder-driven rejections.

### Reset an enrollment after a rejection
The reject route auto-pauses ; to unpause :
```sql
UPDATE sequence_enrollments
SET status = 'active',
    next_step_at = NOW() + interval '1 day'
WHERE id = '...';
```

## Test coverage map

| Concern | Test |
|---|---|
| State machine (5 actions × 5 states) | `__tests__/sequence-drafts-state-machine.test.ts` |
| Router pure logic | `__tests__/sequence-drafts-router.test.ts` |
| Expiry pure logic | `__tests__/sequence-drafts-expiry.test.ts` |
| Rejection classifier | `__tests__/sequence-drafts-rejection-classifier.test.ts` |
| Lifecycle integration + races | `__tests__/sequence-drafts-flow-integration.test.ts` |
| UI components | `components/__tests__/sequence-draft-list.test.tsx`, `sequence-draft-reject-modal.test.tsx` |

Total : 99 tests covering this feature.

## Open issues / future work

- E2E Playwright tests (task 1.8) — would exercise the UI end-to-end
  against a running Postgres. Scoped to a follow-up since we don't
  have an E2E harness today.
- Refactor existing autopilot UI to point at the new flow (task 1.9)
  — the legacy "review queue" inside `/sequences/[id]/review` overlaps
  with `/sequences/review` and should redirect / be removed.
- Promote `approvalMode` from `tenants.settings` jsonb to a dedicated
  column (P1).
- LLM-graded rejection classifier — current heuristic gets ~90% of
  reasons right ; the long tail (mixed signals, unusual phrasings)
  needs an embedding-based ranker.
- Personaliser counter-prompt : the `dominantInsight` exists but the
  prompt that consumes it (in `lib/agents/sequence-generator.ts`)
  doesn't yet read it. Adding `if (insight) prompt += "Avoid X..."`
  is the next learner-loop closure.

_Last updated_ : 2026-05-07
