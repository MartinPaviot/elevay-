# S24 — settings-inbox-autonomy (`/settings/inbox-autonomy`) — audit d'hydratation

**Verdict global : H2 (partiel).** A genuinely well-wired settings page. The autonomy dial catalog and the viewer's persisted choices both come from GET /api/inbox/autonomy, which reads owner-scoped user_preferences JSONB (resource "inbox"/key "autonomy") via getAutonomySettings(userId). Each radio group reflects the stored value through effective()/resolveFeatureAutonomy with proper ceiling clamping, and Save PUTs through saveAutonomySettings (clamp + upsert) then re-sets state so the save reflects back. Loading shows a spinner; the only real gaps are silent error handling — a failed GET swallows the error and renders a blank catalog, and a failed save is fail-soft with no user-visible message.

Entrée : `app/apps/web/src/app/(dashboard)/settings/inbox-autonomy/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Per-feature autonomy radio groups (Off/Suggest/Auto for summarize, classify, capture, nudge, voice_of_customer, draft, send) | app/apps/web/src/app/(dashboard)/settings/inbox-autonomy/page.tsx:111-151 | GET /api/inbox/autonomy -> getAutonomySettings(authCtx.userId) reading user_preferences JSONB (autonomy-hub.ts:77-91); PUT -> saveAutonomySettings clamp+upsert (autonomy-hub.ts:93-103); value resolved via effective() page.tsx:59-63 | H1 | n/a | spinner | n/a | silent | once | Value loaded from real per-user persisted config, defaults to feature.default when unset (legitimate), save round-trips and reflects back. User-scoped (userId) by design — tighter than tenant, no leak. Controls themselves are H1; page-level error handling drops it to H2. |
| Save button + 'Saved.' confirmation | app/apps/web/src/app/(dashboard)/settings/inbox-autonomy/page.tsx:154-164 | PUT /api/inbox/autonomy (page.tsx:70-89) -> saveAutonomySettings (autonomy-hub.ts:93-103) | H2 | n/a | spinner | n/a | silent | n/a | Persists and confirms on success, but the catch block (page.tsx:84-85) is fail-soft: a failed save shows no error and the 'Saved.' indicator simply never appears — user gets no failure signal. |
| Header title + help/description copy ('Decide how much each feature can do...') | app/apps/web/src/app/(dashboard)/settings/inbox-autonomy/page.tsx:101-108 | static | H0 | n/a | n/a | n/a | n/a | static | Pure help text — correctly hardcoded chrome. |

## Pires défauts

1. GET load failure is swallowed by .catch(() => {}) (page.tsx:50), so a 500/network error renders a blank catalog with no error state and no retry — looks like an empty page rather than a failure.
2. Save failure is fail-soft with no user-visible error (page.tsx:84-85): on a failed PUT the 'Saved.' confirmation simply never shows, leaving the user unsure whether their dial persisted.
3. Settings are scoped per-user (userId) not per-tenant (autonomy-hub.ts:81-87); correct by design for a personal dial, but means the control does not represent any tenant-shared inbox policy.
