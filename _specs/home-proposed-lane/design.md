# Design — home-proposed-lane

Mold = FollowUpsReadyCard #574 (table + status enum + daily cron + pure decision
core + fail-soft GET + self-hiding card + versioned action routes). Every piece
below names its #574 counterpart.

## Data

Table `home_sequence_proposals` (migration 0116, mirrors 0108):

| column | type | notes |
|---|---|---|
| id | text pk | uuid |
| tenant_id | text notnull | |
| signal_family | text notnull | canonical (funding, hiring, leadership_change, …) |
| template_id | text notnull | proven-template id (post-funding, hiring-signal, …) |
| title | text notnull | "Recent funding — 7 accounts" |
| company_ids | jsonb notnull | string[] (cohort, deduped) |
| company_names | jsonb notnull | string[] sample ≤6 for render |
| company_count | integer notnull | |
| contactable_count | integer notnull | contacts w/ email or linkedin |
| freshest_at | timestamptz notnull | newest signal in cohort |
| cohort_hash | text notnull | sha1 of sorted company_ids — dedupe + staleness |
| status | enum home_sequence_proposal_status | pending_review / launched / dismissed / expired |
| generated_at / reviewed_at / launched_at / dismissed_at / expires_at | timestamptz | expires = generated + 7d |
| launched_sequence_id / launched_list_id | text null | set on launch |
| version | integer notnull default 1 | optimistic concurrency (mold) |
| created_at / updated_at | timestamptz | |

Indexes: `hsp_dedupe_idx` UNIQUE (tenant_id, signal_family, cohort_hash) —
unconditional, mold ifn_dedupe_idx; `hsp_tenant_status_idx` (tenant_id, status).

## Pure core — `lib/home/sequence-proposals.ts`

- `FAMILY_TO_TEMPLATE: Record<string,string>` — THE taxonomy bridge (nothing
  bridges canonical→trigger today; pickSequenceForSignal matches raw types):
  funding→post-funding, hiring→hiring-signal, leadership_change→leadership-change,
  tech_stack_change→tech-stack-change, website_visit→website-visit,
  exec_engagement→exec-engagement, review_left→review-left,
  competitor_mention→competitor-mention, product_launch→product-launch.
  (acquisition, warm_connection, positive_reply, investor_overlap … absent → skipped.)
- `computeProposalCandidates(input)` — pure. Input: rows
  `{companyId, name, excludedReason, deletedAt, signals: SignalEntry[]}`,
  `contactsByCompany: Map<companyId,{hasEmail,hasLinkedin}[]>`, multipliers,
  now. Steps: alias→canonical per entry (`SIGNAL_CANONICAL_ALIAS[type] ?? type`),
  `isSignalFresh` filter, dedupe freshest-per-(company,family), drop
  excluded/deleted, group by family, keep families in FAMILY_TO_TEMPLATE with
  count ≥ MIN_COHORT(2) and contactable ≥ 1, rank by multiplier×count, cap
  PROPOSALS_MAX(3). Output: candidate rows incl. cohortHash (sha1 sorted ids).
- `titleFor(family, count)` — EN copy table ("Recent funding — N accounts").
- `cadenceSummary(template)` — "3 steps · email → LinkedIn → email".

## Cron — `inngest/home-proposals-cron.ts` (mold followup-nudge-cron)

`home-proposals-daily`, cron `0 8 * * *`, retries 1. Per tenant (distinct
tenant_id from companies): reconcile (pending rows whose recomputed hash ∉
current hashes, or past expires_at → expired), then insert new candidates with
`.onConflictDoNothing()` on hsp_dedupe_idx. Scan cost = same class as
signal-score-daily (full tenant properties scan, 816 rows on Pilae).
Registered in api/inngest/route.ts. Exported helper
`draftProposalsForTenant(tenantId, now)` so a script/live-verify can invoke
without waiting for 8am.

## API

- `GET /api/home/proposals` (mold followups/ready): tenant-scoped
  `status='pending_review'` ordered rank desc (store rank? — order by
  contactable_count desc, company_count desc), returns `{proposals: Row[]}`,
  `{proposals: []}` on any error.
- `POST /api/home/proposals/[id]/dismiss` (mold dismiss): 409 unless
  pending_review + version match; flips dismissed, bumps version.
- `POST /api/home/proposals/[id]/launch`: 409 unless pending_review + version
  match. Transactionally-ish (each step idempotent):
  1. sequence = find by `campaign_config->>'templateId'` (templates/route.ts
     POST dedup query) else `instantiateTemplate(..., {status:"draft"})`.
  2. list = `createAccountListWithMembers(tenant, "Signal · <title> · <MMM d>",
     userId, companyIds)`; on name conflict retry with time suffix.
  3. contacts = for cohort companies: email present, not soft-deleted; gate
     stack: `checkContactEligibility` + `loadSuppressedEmails` +
     already-enrolled set + `guardEnrollment`; insert enrollments
     `.onConflictDoNothing()`. LinkedIn-only contacts enroll too (steps gate
     channel downstream).
  4. update row → launched, store launched_sequence_id/list_id, bump version.
  Returns `{ok, sequenceId, listId, enrolled, skipped}`.

## Card — `components/proposed-by-elevay-card.tsx`

Client, mold FollowUpsReadyCard.tsx: fetch on mount, self-hide on
loading/empty. Per proposal: gradient chip (TrendingUp/Users/… per family —
reuse the ACT_GRADIENT hue families from up-next-view #634), title, why-now
line ("Signal: recent funding · freshest Jun 30 · 5 contactable"), company
names (≤3 + "+N"), cadence line, buttons Launch (accent) / Dismiss (muted).
After launch: toast + row swaps to a success line with "Review sequence →"
link (/sequences/[id]) so the founder lands on activation. Mount in
home/page.tsx right before `<FollowUpsReadyCard />` (page.tsx:217 area),
guarded by `!showOnboarding` only (no flag — mold).

## Invariants honored

- INV-2: proposal row IS the signal record; launch enrolls only cohort of the
  fresh family. INV-7: opens absent from priors/ranking. INV-10: no new send
  path — draft sequence + existing gates; activation is a separate human act.
- i18n: EN strings (#563). No emoji. Header ≤28px controls (44px invariant).

## Trade-offs

- Table+cron over compute-on-read: +1 migration, but dismissal memory,
  stability, and the #574 ops story (reconcile/expire) come free. Chosen.
- Direct enroll on Launch (vs agent-action queue): Launch is a human click —
  same trust level as the chat enrollInSequence tool (enrolls directly,
  action.ts:662). The DRAFT status already forces a second human review at the
  copy level. Queueing would demand a third click for zero added safety.
- MIN_COHORT=2 keeps 1-company families out ("funding" alone on Pilae merges
  into canonical funding with funding_recent — same family, so it counts).
