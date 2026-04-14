# T1 Phase 2 — Items CRITIQUE — Completion report

**Status:** 12/12 branches shipped. 401/401 vitest green. tsc clean.
**Completed:** 2026-04-13

## Commits

| Branch | SHA | Items shipped |
|---|---|---|
| `feat/T1-signin-I1-I2-I4` | `e9ef0b6` | I1 searchParams · I2 callbackUrl · I4 redirect-if-auth |
| `feat/T1-signup-S1-S3` | `89a65a6` | S1 auto-login · S3 redirect-if-auth |
| `feat/T1-chat-C2-C3` | `8bb2a01` | C2 !res.ok handling · C3 SPA campaign redirect |
| `feat/T1-errors-E2-E3-E5` | `cc83a75` | E2 session UX · E3 boundaries → Sentry · E5 DestructiveConfirm |
| `feat/T1-home-H1-H3` | `cc54b28` | H1 hydrate consolidé · H3 SPA nav |
| `feat/T1-onboarding-O3-O4-O5` | `1ab4afd` | O3 retry · O4 score await (chunked) · O5 OAuth return path |
| `feat/T1-settings-N1-N2` | `57f7b27` | N1 GDPR export + delete · N2 password change |
| `feat/T1-sequences-Q1-Q2` | `5594e56` | Q1 analytics endpoint · Q2 step PATCH/DELETE (post-launch edit) |
| `feat/T1-meetings-M1-M2-M3` | `909495e` | M1 PATCH notes · M2 send follow-up · M3 MS-only graceful |
| `feat/T1-opps-Y1-Y2-Y3` | `282510c` | Y1 timeline narrative · Y2 health score · Y3 auto-progress |
| `feat/T1-accounts-A1-A3` | `01088b2` | A1 paginated-response shape · A3 BulkActionsBar on selection |
| `feat/T1-contacts-K1-K2-K3` | `3b192fb` | K1 paginated shape · K3 merge endpoints (K2 UI deferred) |

## What's UI vs. endpoint-only

Everything user-facing that the plan called out as CRITIQUE is in
place:

| Surface | UI wired | Endpoints |
|---|---|---|
| Sign in / sign up | ✅ | ✅ |
| Chat | ✅ | — |
| Error boundaries + destructive confirm | ✅ | — |
| Home hydrate + SPA nav | ✅ | ✅ |
| Onboarding retry + connect return | ✅ | — |
| Settings GDPR + security | ✅ | ✅ |
| Accounts bulk actions | ✅ | ✅ |
| Sequences analytics + edit | — | ✅ |
| Meetings notes + follow-up | — | ✅ |
| Opportunities timeline + health + auto-stage | — | ✅ |
| Contacts merge | — (UI deferred) | ✅ |

The three "endpoints only" rows (sequences, meetings, opps) ship
backend contracts that a UI pass can consume without further
backend work — each endpoint returns JSON in the canonical shape
the frontend hook patterns expect.

## New primitives (cumulative — includes Phase 1)

**Hooks:** `useOptimisticMutation`, `usePaginatedList`, `useInlineEdit`,
`useFocusTrap`, `useBreakpoint`, `useHotkey`, `useSelection`,
`useSessionExpired`.

**Components:** `EmptyState` (5 variants), `ResponsiveStack`,
`ResponsiveTable`, `ShortcutHelp`, `BulkActionsBar`, `DisplayPanel`,
`FilterBuilder`, `VirtualTable`, `DestructiveConfirm`, `SkipLink`,
`LiveRegion`. Toast gains `action`, `durationMs`, a11y regions.

**Pure libs (testable without DB/auth):** `lib/api/paginated-response`,
`lib/filters`, `lib/hotkey-registry`, `lib/auth-callback`,
`lib/opportunity-health`, `lib/chunk-bulk`, `lib/password-reset`,
`lib/analytics` (typed posthogEvents catalog).

**Schema:** `password_reset_tokens`, `user_preferences`, `saved_views`
(all drizzle-kit migrations 0009–0011) + one operator SQL in
`drizzle/manual/` for the challenge-label normalisation.

## Endpoints added this phase

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/home/hydrate` | GET | Consolidates 6 home-page fetches |
| `/api/account` | DELETE | GDPR account erase (typed-verify) |
| `/api/account/password` | POST | Password change |
| `/api/gdpr/export` | GET | JSON data export |
| `/api/user-preferences` | GET/PUT | Per-user, per-resource prefs |
| `/api/views` | GET/POST/DELETE | Saved filter views |
| `/api/sequences/[id]/steps/[stepId]` | PATCH/DELETE | Post-launch step edit |
| `/api/sequences/[id]/analytics` | GET | Funnel metrics |
| `/api/meetings/[id]/notes` | PATCH | Edit notes + draft |
| `/api/meetings/[id]/notes/send-follow-up` | POST | Send stored draft |
| `/api/opportunities/[id]/timeline` | GET | Deal narrative |
| `/api/opportunities/[id]/health` | GET | 0-100 health score |
| `/api/opportunities/[id]/auto-progress` | POST | Stage suggestion + apply |
| `/api/contacts/merge` | GET/POST | Duplicate detection + merge |
| `/api/auth/forgot-password` | POST | T0.8 |
| `/api/auth/reset-password` | POST | T0.8 |

## Deliberate deferrals

1. **Contacts K2 UI** — the selection checkboxes / BulkActionsBar
   wire-up on `/contacts/page.tsx` + the `/contacts/merge` picker
   screen. The endpoints exist and are stable; the UI is ~200 lines
   of additional work that should come in its own branch.

2. **Sequences detail UI** — the new `PATCH /steps/:stepId` and the
   analytics endpoint aren't yet rendered in the detail page. Hook up
   `useInlineEdit` to each step card and add an "Analytics" tab to
   close the loop.

3. **Meetings detail UI** — `PATCH /notes` and the `send-follow-up`
   endpoint are ready; the detail page needs to consume them via
   `useInlineEdit` for the structured-notes blob and a single-
   shot "Send follow-up" button gated by `!followUpSentAt`.

4. **Opportunities detail UI** — the three new endpoints aren't yet
   rendered on the deal page. Timeline narrative as a bulletlist,
   health score as a big scored card, auto-progress suggestion as a
   one-click banner.

5. **Microsoft Calendar via Graph API** — M3 Phase 1. The meetings
   list no longer crashes for MS-only users but the feed itself
   needs a Graph client + token refresh. Tracked in
   `_specs/REQUIREMENTS/10-meetings.md`.

6. **Source-map upload for Sentry** — requires `SENTRY_AUTH_TOKEN`
   in CI. Config already supports it; ops task.

## Test state (final)

- **Vitest:** 49 files, **401 tests passing** (cumulative +129 over
  the ba9746b baseline).
- **Typecheck:** clean.
- **Silent catches (bare `catch {}`):** zero in `src/`.
- **Foundations:** every primitive the plan called for is on main.
- **Migrations:** 3 new drizzle migrations + 1 operator SQL to run.

## Cumulative session output

- **39 commits** on `main` (ba9746b → 3b192fb)
- T0: 8/8 ✅
- T1 Phase 1: 13/13 ✅
- T1 Phase 2: 12/12 ✅ (23 CRITIQUE items landed; 4 UI-only items
  deferred as documented above)

No remote push performed — Martin pushes manually. Branches still
exist locally for inspection.
