# S22 — settings-inbox-voice (`/settings/inbox-voice`) — audit d'hydratation

**Verdict global : H2 (partiel).** A genuinely well-wired settings page. Both controls load their current values from real owner-scoped persisted config (user_preferences JSONB, scoped by eq(userId)) via GET /api/inbox/voice and GET /api/inbox/auto-draft, and both persist via PUT on Save. The tone radios and guidance textarea fully round-trip (server-clamped value written back into state). Defects are minor: the auto-draft toggle persists but its save response is never read back (client-local only after save), and both GET loaders silently swallow fetch errors with no error UI.

Entrée : `app/apps/web/src/app/(dashboard)/settings/inbox-voice/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Tone preset radios (neutral/warm/direct/formal/concise) | app/apps/web/src/app/(dashboard)/settings/inbox-voice/page.tsx:114-145 | GET /api/inbox/voice -> getVoicePrefs(authCtx.userId) reads user_preferences resource='inbox' key='voice' (voice-prefs.ts:72-87); persists via PUT -> saveVoicePrefs (voice-prefs.ts:89-99); reflected back via setVoice(data.voice) (page.tsx:85-87) | H1 | yes | spinner | handled | silent | once | faithful - value loaded from real owner-scoped config, save upserts and round-trips clamped value |
| Extra guidance textarea (custom voice guidance, 300 char max) | app/apps/web/src/app/(dashboard)/settings/inbox-voice/page.tsx:152-167 | same as tone: GET/PUT /api/inbox/voice -> getVoicePrefs/saveVoicePrefs (voice-prefs.ts:52-99, clampVoice trims+slices to 300); reflected back at page.tsx:85-87 | H1 | yes | spinner | handled | silent | once | faithful - value loaded from persisted config, save round-trips clamped value |
| Pre-draft replies on open toggle (auto-draft) | app/apps/web/src/app/(dashboard)/settings/inbox-voice/page.tsx:179-196 | GET /api/inbox/auto-draft -> getAutoDraft(authCtx.userId) reads user_preferences resource='inbox' key='auto_draft' (auto-draft-prefs.ts:28-43); persists via PUT -> saveAutoDraft (auto-draft-prefs.ts:45-55) | H2 | yes | none | handled | silent | once | real owner-scoped load + persist, but save() never reads the auto-draft PUT response - only the voice response 'r' is consumed (page.tsx:72,84-88), so the toggle is not reconfirmed from server after Save (client-local only); load error swallowed |
| Header title + description + Save status copy | app/apps/web/src/app/(dashboard)/settings/inbox-voice/page.tsx:106-111,203-207 | static (hardcoded help/label copy) | H0 | n/a | n/a | n/a | n/a | static | faithful - pure chrome/help text, no data source expected |

## Pires défauts

1. Auto-draft toggle save does not reflect back: save() only consumes the voice PUT response ('r') and ignores the auto-draft PUT response, so the toggle value is never reconfirmed from the server after Save - client-local only (app/apps/web/src/app/(dashboard)/settings/inbox-voice/page.tsx:72,78-83,84-88)
2. Voice GET loader silently swallows all errors with no error UI: a failed fetch leaves defaults shown with no indication the load failed (app/apps/web/src/app/(dashboard)/settings/inbox-voice/page.tsx:46)
3. Auto-draft GET loader likewise swallows errors and has no loading state of its own - the toggle renders its default 'off' during/after a failed load indistinguishable from a real stored 'off' (app/apps/web/src/app/(dashboard)/settings/inbox-voice/page.tsx:57-62)
