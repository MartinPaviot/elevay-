# Tasks — CONNECTION-GRAPH (dormant infra)

## Done this PR (infra only, nothing in prod)
1. [x] Schema `db/schema/connection-graph.ts` (linkedin_accounts, connection_edges, warm_paths) + barrel export.
2. [x] Manual migration `drizzle/manual/0002_connection_graph.sql` (additive, NOT applied).
3. [x] Domain types `lib/connection-graph/types.ts`.
4. [x] `network-distance.ts` — pure normaliser (verify: tests, fail-safe).
5. [x] `company-resolution.ts` — domain→name→null, reuses ICP `norm()` (verify: tests).
6. [x] `icp-overlay.ts` — first-degree × ICP ranked overlay (verify: tests).
7. [x] `warm-path.ts` — insider + intro_path + bestWarmPath (verify: tests, strength bounds).
8. [x] Provider port `provider/types.ts` + `mock.ts` + dormant `unipile.ts` + gated `index.ts` resolver.
9. [x] `config.ts` — `isConnectionGraphEnabled` / `configuredGraphProviderId`.
10. [x] `ingest.ts` — IO-injected drip orchestration (verify: ingest tests w/ mock).
11. [x] `inngest/connection-graph-sync.ts` — defined, NOT registered, flag-gated, throws-if-unwired.
12. [x] Tests: domain + ingest + gating — 26 cases across 3 files, all green.
13. [x] vitest green (26/26) + tsc clean for all new code (only pre-existing stale-.next noise on an unrelated removed route).
14. [x] Commit + push + PR — NOT merged (main = prod auto-deploy).

## Suite — built this round (still dormant: gated + job unregistered + unmerged)
15. [x] `warm-path-score.ts` — pure priority-score contribution (multiplier [1,1.5], insider>intro, boost-only). Ready to plug into `lib/scoring/priority-score.ts` at integration. Tested.
16. [x] `warm-angle.ts` — pure WarmPath → outreach guidance (first_degree / shared_connection); self-contained, no coupling to the shared methodology lib. Tested.
17. [x] `intro-paths.ts` — IO-injected per-target shared-connection orchestration, rate-limit budget + resume. Tested with a fake provider.
18. [x] `build-warm-paths.ts` — pure: group first-degree resolved edges → insider warm paths, strongest first. Tested.
19. [x] `repository.ts` — DB wrappers (load candidates, upsert edges, save cursor, load owner edges, ICP overlay via companies.score join, upsert warm paths). tsc-verified.
20. [x] `connection-graph-sync.ts` — FULLY WIRED (ingest drip → rebuild warm paths) but still flag-gated + NOT registered in the route + no cron + no live emitter.
21. [x] Gated API `GET /api/connection-graph/overlay` — 404 when disabled (prod posture), else returns the personal ICP-overlay.
22. [x] 37 tests green (domain + ingest + gating + suite); tsc clean for all new code.

## Still deferred (genuinely blocked or integration-time)
- [ ] **Spike (BLOCKED on a real Unipile account + key)**: relations payload shape vs per-profile rate-limit cost — the cost determinant. Needs Martin's credentials.
- [ ] Register the fn in `app/api/inngest/route.ts` + emit `linkedin/graph.sync.requested` from the connect flow + a daily drip cron (the live switch — held until Unipile-vs-OSS is decided + not-in-prod lifts).
- [ ] Plug `warmPathScoreContribution` into `priority-score.ts` and `warm-angle` into the sequence/call generator (touches live scoring/generation → gated wiring at integration).
- [ ] UI: ICP-overlay panel consuming `/api/connection-graph/overlay` + "connect Sales Navigator to unlock intro paths" graceful-degrade (UX depends on final provider).
- [ ] Connect-account OAuth/session flow (provider-specific).
- [ ] RGPD: lawful basis + minimisation + DPA before first real ingestion.
- [ ] Decision: Unipile vs self-hosted OSS (CloakBrowser+Playwright) — before any of the above goes live.
