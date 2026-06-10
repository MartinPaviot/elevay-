# Up Next redesign — Tasks

1. [x] Pure module `src/lib/home/up-next.ts` — buildNeedsYou / buildLedger /
   buildEngineLine / ledgerSentence / isTestLabel + types.
   Verify: `src/__tests__/up-next.test.ts` (17 cases) — green.
2. [x] API `src/app/api/home/up-next/route.ts` — wire lanes (inbox guarded import,
   approvals query, summary reuse, reactions) → pure builders.
   Verify: 200 with `{hero, items, ledger, engine}` on tenant 47dca783.
3. [x] View `src/components/up-next/up-next-view.tsx` — Hero + queue + ledger +
   engine, optimistic actions, collapse motion, EmailComposerPanel.
   Verify: live render (empty + mocked-populated), Approve collapses card (5→4).
4. [x] Wire page `src/app/(dashboard)/home/page.tsx` — replace AgentFeed + legacy
   blocks with <UpNextView/>; keep onboarding + Hot widgets; drop double date.
5. [x] Gate — `tsc --noEmit` clean (exit 0); up-next tests 17/17.
6. [x] Live verify on tenant 47dca783 (mint session): empty state + populated
   mock + AC2 approvals + AC5 collapse. Screenshots in _audit/.
7. [ ] Commit my files (stacked on the uncommitted inbox-triage work). Do NOT
   push to main (prod auto-deploys).

## Follow-ups (not this slice)
- Reconcile reactions.actionsDeferred → real approvable `agent_actions` rows so
  the 31 "awaiting approval" become an actionable approval lane (today they have
  no scheduled rows, so the queue correctly shows none).
- Keyboard layer (j/k/e/a/s) + bulk actions.
- Fold Hot inbounds/visitors into the queue as a "fresh intent" lane.
