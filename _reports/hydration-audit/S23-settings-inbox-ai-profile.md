# S23 — settings-inbox-ai-profile (`/settings/inbox-ai-profile`) — audit d'hydratation

**Verdict global : H1 (fidèle).** The single data-bearing control — the AI data-handling profile radio group (standard / zero_retention / off) — is faithfully hydrated: its current value is loaded from the viewer's real owner-scoped persisted config (user_preferences JSONB, resource "inbox"/key "ai_profile", scoped by userId) and a Save PUT round-trips and reflects the normalized value back into state. Loading is handled with a spinner; data is per-user scoped via getAuthContext().userId. The only gap is a silent fetch error path (.catch(()=>{}) leaves options=[] and renders a near-blank body with no written error state), but that affects only the hardcoded option chrome, not the integrity of the loaded/saved value.

Entrée : `app/apps/web/src/app/(dashboard)/settings/inbox-ai-profile/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Header title + subtitle ("AI data handling" / "Control how the assistant processes your inbox.") | app/apps/web/src/app/(dashboard)/settings/inbox-ai-profile/page.tsx:78-83 | static hardcoded copy | H0 | n/a | n/a | n/a | n/a | static | Pure chrome/help text — correctly static. |
| AI processing profile radio group (Standard / Zero retention / Off) — selected value | app/apps/web/src/app/(dashboard)/settings/inbox-ai-profile/page.tsx:86-117 | GET /api/inbox/ai-profile -> getAiProfile(userId) reading user_preferences (route.ts:16-20; lib/inbox/ai-profile.ts:50-64); persists via PUT -> saveAiProfile onConflictDoUpdate (route.ts:23-35; lib/inbox/ai-profile.ts:66-76); reflects back at page.tsx:57-58 | H1 | yes | spinner | n/a | silent | once | Current value loaded from real owner-scoped persisted config (user_preferences, eq(userId)+resource+key, FK to authUsers) and save round-trips + reflects back. Loading spinner handled. Minor: fetch error is swallowed (page.tsx:38) leaving options=[] -> near-blank render with no written error message. |
| Option labels & descriptions | app/apps/web/src/lib/inbox/ai-profile.ts:27-31 | static AI_PROFILE_OPTIONS constant, delivered via GET response | H0 | n/a | spinner | n/a | silent | static | Hardcoded option chrome (label/description) — correctly static; only the selected id is real data. |
| Save button + "Saved." confirmation | app/apps/web/src/app/(dashboard)/settings/inbox-ai-profile/page.tsx:120-130 | PUT /api/inbox/ai-profile (saveAiProfile persist + reflect-back) | H1 | yes | spinner | n/a | silent | once | Save persists to user_preferences and sets profile from the server-normalized response; saving/disabled state shown. PUT failure is fail-soft (no error surfaced to user). |

## Pires défauts

1. Fetch error on initial load is silently swallowed (page.tsx:38 .catch(()=>{})), leaving options=[] and rendering a near-blank page with no written error/empty state.
2. Save (PUT) failure is fail-soft with no user-visible error (page.tsx:61-62) — a failed save looks identical to no action.
3. No empty/error state distinct from the success path; both load and save errors degrade silently rather than to a written message.
