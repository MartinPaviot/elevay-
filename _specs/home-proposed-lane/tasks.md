# Tasks — home-proposed-lane

Each task: code → test → verify → commit (CLAUDE.md).

- [ ] **T1 schema+migration** — `homeSequenceProposals` in db/schema/outbound.ts
      (+ status enum) + drizzle/0116_home_sequence_proposals.sql. Verify: tsc;
      migration applies on localdev + prod via db:migrate:apply.
- [ ] **T2 pure core** — lib/home/sequence-proposals.ts (FAMILY_TO_TEMPLATE,
      computeProposalCandidates, titleFor, cadenceSummary, cohortHash). Tests:
      alias bridge, freshness, per-company dedupe (BTG×2→1), excluded dropped,
      unmapped family skipped, MIN_COHORT, contactable≥1, ranking, cap, hash
      stability. Verify: vitest.
- [ ] **T3 cron** — inngest/home-proposals-cron.ts (reconcile + insert,
      draftProposalsForTenant export) + register in api/inngest/route.ts.
      Tests: reconcile expiry/staleness (pure parts). Verify: vitest + tsc.
- [ ] **T4 API GET/dismiss** — api/home/proposals/route.ts +
      [id]/dismiss/route.ts. Verify: tsc (route shape mirrors mold).
- [ ] **T5 launch route** — [id]/launch/route.ts (instantiate-or-find, list,
      gates, enroll, flip). Tests: pure eligibility composition where
      extractable. Verify: tsc + live call.
- [ ] **T6 card** — components/proposed-by-elevay-card.tsx + mount in
      home/page.tsx. Verify: live screenshot.
- [ ] **T7 live verify** — run draftProposalsForTenant against Pilae (writes
      real proposal rows), dev server 3003, login Martin, screenshot card;
      Launch on the funding proposal → screenshot /sequences/[id] draft +
      enrollments; confirm NOTHING sent (sequence draft, 0 outbound rows).
- [ ] **T8 PR** — full CI green → squash-merge → main CI → memory update.
