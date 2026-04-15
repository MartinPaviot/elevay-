# Next session — orientation

Read this first. Skip to **Start here** if you already know the context.

## Current state (as of 2026-04-15)

**Repo is on GitHub** (private): https://github.com/MartinPaviot/leads
First push used `git filter-repo` to strip ~700MB of `app/.turbo/` build
cache + `*.tsbuildinfo` from history (822MB → 129MB). See
`_specs/WS2-pricing-v2/notes.md` §7 for the full story. Pre-filter
bundle at `C:/Users/marti/leads-backups/pre-filter-*.bundle`.

### Shipped to main

| Commit | What |
|---|---|
| `2a2dd61` | WS-1 Recorder-as-Channel (branded notetaker attribution + referral ledger) |
| _preceding_ | Everything listed in `_specs/*/tasks.md` Kiro specs prior to WS-1 |

### Open PRs

| # | Title | Base ← Head | Purpose |
|---|---|---|---|
| [#1](https://github.com/MartinPaviot/leads/pull/1) | WS-2 Pricing v2 + WS-2.1 admin UI | `main` ← `feat/WS2-pricing-v2-clean` | Enforcement + banner + Stripe credits + admin quota editor |
| [#2](https://github.com/MartinPaviot/leads/pull/2) | fix(auth): bare `crypto` specifier | `feat/journey-audit-haute` ← `fix/auth-lockout-node-crypto` | Unblocks `next build` on `feat/journey-audit-haute` |

### Branches (7 total after 2026-04-15 cleanup; was 98)

- `main` — production
- `feat/WS2-pricing-v2-clean` — PR #1
- `fix/auth-lockout-node-crypto` — PR #2
- `feat/journey-audit-haute` — Martin's active HAUTE-batch WIP (auth I5-I8, onboarding O7-O10, home, accounts, contacts)
- `feat/homepage-3-adversaries` — recent Martin work
- `feat/security-hardening-2026-04-15` — recent Martin work
- `feat/WS2-pricing-v2` — old tangled ancestor, safe to delete after #1 merges

92 already-merged branches deleted from origin + local on 2026-04-15
(commits preserved on main).

### Known gaps

1. **No CI workflow on main.** `ci.yml` was stripped during filter-repo
   because my OAuth token lacked `workflow` scope. Saved content at
   `C:/Users/marti/leads-backups/ci.yml` (51 lines). Re-add via
   `gh auth refresh -s workflow` (one browser click) + copy file back +
   commit. Non-blocking for merges but means no automated test gating.

2. **Stashes on `feat/journey-audit-haute`.** 3 stashes from the
   filter-repo / branch-juggling of 2026-04-15. `git stash list` to
   see; probably `stash@{1}` ("pre-filter-stash") has the 2 tracked
   files Martin was editing (`meetings/[id]/page.tsx`,
   `tsconfig.tsbuildinfo`).

3. **Drizzle journal drift.** `drizzle/meta/_journal.json` stops at
   `0011`. Actual SQL migrations exist through `0019`. Regenerate
   snapshots via `pnpm drizzle-kit generate` at some point.

4. **`app/apps/admin` TypeScript errors.** Pre-existing, unrelated to
   any recent work. `apps/admin` isn't part of the tsc CI target so
   not urgent. `@web/*` path alias works at bundler time but not at
   tsc time (admin tsconfig doesn't include `apps/web/src`).

## Start here

Ask Martin **what he wants next**, but if he says "continue" without
context — default to this order:

1. **Merge PR #2** (trivial, unblocks `next build` on his active branch).
2. **Review + merge PR #1** (WS-2 + WS-2.1; the checklist in
   `_specs/WS2-pricing-v2/REVIEW.md` walks through what to verify).
3. **Re-add `ci.yml`** so future PRs get automated test gating. See
   gap #1 above.
4. **Continue the HAUTE-batch work** on `feat/journey-audit-haute` —
   the parcours-utilisateur #1→13 audit that predates this session.
   Look at `_reports/user-journey-audit.md` for the 13-step plan.
5. **Install Playwright + write E2E scaffolds** for the 7 BUGFIX-*
   specs that have pending T-tasks. Heavy install; consider whether
   the effort is better spent elsewhere first.

## Non-obvious operating constraints

- Martin gives full autonomy — execute, don't checkpoint. See
  `feedback_full-autonomy-execution.md` memory.
- Keep responses terse with pixel-level detail. See
  `feedback_detail-over-vision.md` memory.
- Always verify current code state before citing gaps. See
  `feedback_verify-current-state.md` memory.
- This is a one-person repo with a live GH remote, but Martin
  frequently checks out other branches mid-session. If you find
  yourself on a branch you didn't switch to, assume Martin switched
  and don't fight it — use `git worktree` for isolated work.

## Methods that worked well this session

- **Kiro specs** (`_specs/WS-N/{office-hours,requirements,design,tasks,notes,REVIEW}.md`)
  for every feature over ~1 day of work. Heavy upfront but clarifies
  scope and survives compaction.
- **context7** for verifying library specifics before writing
  (e.g. Stripe SDK idempotency key spelling, Next.js conventions).
- **`git filter-repo` + backup bundle** when GitHub rejects a push
  for blob-size reasons — safe if you bundle everything first.
- **Cherry-pick cleanup branches** to separate your work from parallel
  WIP when a branch gets tangled (`feat/WS2-pricing-v2` → `-clean`).

## Files worth reading in order

1. `CLAUDE.md` — mission statement + autonomy rules
2. `_specs/WS2-pricing-v2/REVIEW.md` — the PR #1 reviewer guide (also
   demonstrates the review-doc pattern for future features)
3. `_specs/WS2-pricing-v2/notes.md` — what was non-obvious during the
   last build, including why migration numbers shifted and the
   filter-repo story
4. Whatever `_specs/FEATURE_ID/tasks.md` is being worked on
