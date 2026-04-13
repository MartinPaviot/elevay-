# Étape 10 — Meetings — Exigences pixel-level

**Date :** 2026-04-13
**Scope :** `/meetings/page.tsx` (list), `/meetings/[id]/page.tsx` (detail, 579 lignes), endpoints `/api/meetings/*`, Recall.ai integration, Inngest `cronCalendarSync`, `autoMeetingPrep`, `generateMeetingPrep`, `processTranscriptFromBot`.
**Méthode :** audit-deep `04-meetings-opportunities.md` (section MEETINGS, ~400 lignes) + capture Lightfield `meetings-empty.png`.

---

## 0. État actuel — rappel compressé

Infrastructure mature (intégration Recall.ai complète, pipeline IA, Whisper fallback). Voir audit-04 pour détail.

### 0.1 Gaps audit-04 encore présents
- **Microsoft Calendar pas exposé** côté `/api/meetings` (seulement Google). `fetchMicrosoftMeetings` existe dans cron.
- **Pas de conflict detection** sur booking.
- **Pas d'édition notes** (read-only).
- **Prep caching client-only**, pas serveur.
- **Cache `extractionCache` Map in-memory** sans timeout.
- **`partialTranscript` truncated 5000 chars** = perte du début sur longs meetings.
- **Follow-up email draft pas auto-envoyé** (user copie/colle).
- **Pas de vue calendrier** (mois/semaine).
- **Pas d'intégration Fireflies/Otter/Read.ai.**
- **Pas de deletion bot** si meeting canceled.

---

## 1. Exigences pixel-level

### 1.1 List page
- **Vue calendrier** alternative (toggle List/Week/Month). Default = List.
- **Pagination** + virtualisation.
- **Filters :**
  - Date range (past 7j / 30j / 90j / custom).
  - Attendee externe only vs internal.
  - With transcript / With notes / With follow-up sent.
  - Stage deal associé (si applicable).
- **Sort :** date DESC/ASC, duration, attendee count.
- **Bulk actions :** mark-done, add-to-sequence (based on attendees), generate-follow-ups.
- **Badge Recall bot actif** : "🔴 Recording" sur upcoming meeting dont bot scheduled.
- **Meeting detail preview on hover** (popover avec key info + icon CTAs).

### 1.2 Detail page — core UI
- **Sections** (en tabs ou accordion collapsible) :
  - **Summary** — structured notes (summary, keyPoints, action items, decisions)
  - **Buying Signals** — budget, timeline, competitors, pain points, objections + sentiment (color-coded)
  - **Attendees** — list avec role (host/external), contact linked, company linked
  - **Transcript** — full text, search bar, timestamps clickables (seek audio if recording)
  - **Recording** — embedded player (si recordingUrl dispo)
  - **Follow-up** — draft email prêt à envoyer (pas juste à copier)
  - **Tasks** — tasks créées automatiquement, check/uncheck inline
  - **Deal** — si linké, affiche stage + value + next steps + editable CTAs
  - **Chat coaching** — scoped chat sur le meeting context

### 1.3 Edit notes
- **Exigence critique :** rendre toutes les sections éditables.
  - Summary : textarea multiline.
  - Action items : checklist éditable (add/remove/edit/assign).
  - Key points : liste éditable.
  - Decisions : liste éditable.
  - Buying signals : chaque signal éditable.
- **Save inline** sur blur / Enter. Revert button si erreur.
- Audit log des edits (qui a changé quoi, quand) → utile pour équipe.

### 1.4 Auto-send follow-up
- Actuel : draft généré mais user doit copier.
- **Exigences :**
  - CTA "Send follow-up" dans la section Follow-up → ouvre EmailComposer prefilled.
  - CTA "Send as draft" → envoie via mailbox utilisateur (Gmail/Microsoft API) avec 1 click.
  - Toggle "Auto-send 1h post-meeting" setting (default off — user approve d'abord).
  - Tracking : quand envoyé, log dans activity timeline.

### 1.5 Upload transcript improvements
- **Streaming upload** pour gros fichiers (> 10 MB).
- **Progress bar** avec étapes : uploading → transcribing → extracting notes → done.
- **Batch upload** : multiple meetings à la fois.
- **Conversion format auto** : .mov / .mkv → mp3 côté serveur (FFmpeg).
- **Support Zoom cloud recording URL** (fetch direct depuis Zoom API).

### 1.6 Meeting prep UX
- Actuel : client cache, re-fetch à chaque ouverture.
- **Exigences :**
  - Cache serveur 24h (prep doesn't change often).
  - **Refresh button** pour force regenerate.
  - **Edit prep** (user can add their own notes before meeting).
  - **Share prep** : generate public link (expires 24h post-meeting) pour envoyer aux attendees.
  - **Print/PDF export** pour print avant meeting.

### 1.7 Live meeting mode (amélioration `extractionCache`)
- **Actuel :** polling on `/api/meetings/[id]/live`, in-memory cache, truncated 5000 chars.
- **Exigences :**
  - **WebSocket / SSE streaming** au lieu de polling.
  - **Redis cache** avec TTL 1h (multi-instance-safe, survit restart).
  - **Garder le transcript complet** (pas de truncate) ou stream par chunks de 1000 chars.
  - **Live signals updates** : si nouveau signal détecté, animer avec toast "Budget range mentioned: $50-100k".
  - **Real-time note-taking** : user peut ajouter ses propres notes pendant live, marked as "manual".

### 1.8 Microsoft Calendar parity
- **Exigence critique :** exposer `fetchMicrosoftMeetings` dans `/api/meetings`. Même data model que Google.
- Dédup si meeting apparaît dans les deux calendriers (même titre + heure ± 5 min).
- UI : badge "Google" / "Microsoft" par meeting pour transparence.

### 1.9 Conflict detection
- Si on génère un meeting request avec date/heure → check conflict user's calendar avant de suggérer le slot.
- UI : red highlight sur les créneaux conflictuels dans suggested times.

### 1.10 Bot management
- **UI admin** `/settings/recording` (existe déjà — à vérifier).
  - Par mailbox : toggle "Auto-record meetings with video link".
  - Whitelist / blacklist domaines (ne pas recorder si attendee est de `competitor.com`).
  - Max concurrent bots (Recall a des limits).
- **Auto-cancel bot** si meeting canceled/rescheduled dans le calendar.

### 1.11 Transcript search + analytics
- Page `/meetings/search` — search full-text sur tous les transcripts du tenant.
- Highlight matches + link to meeting.
- **Analytics cross-meetings :**
  - Top mentioned competitors (last 30 days).
  - Top pain points (clustered by embedding similarity).
  - Sentiment trend over time.
  - "What are prospects asking about?" (topic extraction).

### 1.12 Integration with other tools (v2)
- Fireflies, Otter, Read.ai, Gong, Chorus imports.
- Zoom cloud recording direct pull.
- Dialpad / Aircall voice calls (non-meeting conversations).

### 1.13 Empty state (Lightfield parité)
- Capture Lightfield : "No meetings. Lightfield automatically syncs meetings from your calendar activity." + "Go to settings →".
- **Elevay exigence :**
  - Si 0 meetings : "No meetings yet. Elevay auto-joins your meetings with a bot — just connect your calendar." + CTA "Connect calendar" (if not connected) OR "Waiting for your next meeting..." (if connected).
  - Pendant que cron sync tourne : skeleton.

### 1.14 Buying signals — visual
- Actuel : texte.
- **Exigence :** visual cards par signal type :
  - Budget (dollar icon, range extracted)
  - Timeline (calendar icon, "Q2 2026" extracted)
  - Competitors (swords icon, names listed with their logos)
  - Pain points (thumbs-down icon, list)
  - Objections (alert icon, list with suggested rebuttal)
- Each card clickable → surface le passage exact du transcript où c'était mentionné.

### 1.15 Auto-update deal stage
- **Exigence :** si meeting transcript indicates stage progression (e.g., "let's schedule a follow-up demo", "send me the proposal"), suggest stage update inline.
- Banner : "Based on this meeting, move deal to 'Demo scheduled'? [Yes] [No]".

### 1.16 Attendee auto-link
- Post-meeting, si attendee email `john@newcompany.com` **not found** in contacts → propose "Create contact for John (newcompany.com)".
- 1-click create, prefilled with email + name + company (auto-created or matched).

### 1.17 Recording privacy
- **Exigence GDPR :** afficher consent banner au début du meeting si bot joined (ex: via Recall's `bot_message` config).
- Tenant setting : "Ask consent before recording" on/off.
- Opt-out per attendee : if attendee declines, bot leaves automatically.

### 1.18 Analytics PostHog
- `meeting_viewed` (has_transcript, has_notes, source)
- `meeting_prep_generated` / `prep_refreshed`
- `meeting_transcript_uploaded` (source_type, size_kb, duration_s)
- `meeting_notes_edited` (section, is_first_edit)
- `meeting_followup_sent` (method = auto | manual)
- `meeting_task_created_from_action_item`
- `meeting_deal_stage_suggested` (accepted)
- `meeting_buying_signal_clicked` (signal_type)
- `meeting_search_performed` (query_length, results_count)

### 1.19 Keyboard + A11y
- `↑↓` navigate list, `Enter` open.
- `P` open prep, `T` open transcript.
- Transcript : search `/` focus, `Ctrl+F` native.
- Full text expandable sections with `aria-expanded`.

### 1.20 Mobile
- List → cards vertical.
- Detail → tabs (Summary / Transcript / Attendees / Tasks).
- Recording : native video player.

---

## 2. Comparaison concurrents

### 2.1 Lightfield (`meetings-empty.png`)
**Forces :**
- Empty state propre : "No meetings. Lightfield automatically syncs meetings from your calendar activity. [Go to settings →]"
- Filter preset "Meeting date after 1 day ago" avec close X.
- Sidebar + top nav cohérents avec le reste de l'app.
- Pas de Recall bot visible dans la capture (peut-être pas intégré chez Lightfield).

**Ce qu'on copie :**
- Empty state avec CTA clair.
- Filter preset visible et removable.

### 2.2 Monaco
- Pas de capture meetings disponible.

### 2.3 Gap synthèse
| Dimension | Elevay | Lightfield | Gap |
|---|---|---|---|
| Recall.ai bot auto-join | ✅ | ❌ (probable) | **+ Elevay** |
| Transcript extraction LLM | ✅ structured | ❌ | **+ Elevay** |
| Edit notes | ❌ read-only | ? | **CRITIQUE** |
| Auto-send follow-up | ❌ copy/paste | ? | **CRITIQUE** |
| Microsoft Calendar | ❌ | ✅ (probable) | **HAUTE** |
| Live meeting signals streaming | ⚠️ polling | ❌ | HAUTE |
| Calendar view (week/month) | ❌ | ❌ (probable) | MOYENNE |
| Transcript search cross-meetings | ❌ | ? | MOYENNE |
| Attendee auto-link | ⚠️ partiel | ✅ | MOYENNE |
| Consent privacy banner | ❌ | ❌ | HAUTE (GDPR) |
| Conflict detection | ❌ | ❌ | BASSE |
| Recording player embed | ⚠️ URL only | ? | MOYENNE |

---

## 3. Gaps priorisés

| # | Gap | Criticité | Effort (h) |
|---|---|---|---|
| M1 | Edit notes (all sections inline) | **CRITIQUE** | 6 |
| M2 | Auto-send follow-up (CTA + Gmail/MSGraph send) | **CRITIQUE** | 4 |
| M3 | Microsoft Calendar exposé `/api/meetings` | **CRITIQUE** | 3 |
| M4 | Consent privacy banner GDPR | HAUTE | 4 |
| M5 | Live streaming WS/SSE + Redis cache + full transcript | HAUTE | 10 |
| M6 | Attendee auto-link propose create contact | HAUTE | 3 |
| M7 | Auto-update deal stage suggestion banner | HAUTE | 4 |
| M8 | Vue calendrier (week/month toggle) | HAUTE | 6 |
| M9 | Prep cache serveur + refresh button + share link | HAUTE | 5 |
| M10 | Buying signals visual cards | HAUTE | 4 |
| M11 | Bot auto-cancel si meeting canceled | HAUTE | 2 |
| M12 | Transcript search cross-meetings | MOYENNE | 5 |
| M13 | Meeting analytics cross (competitors, pain points clusters) | MOYENNE | 8 |
| M14 | Upload : batch + progress + format conversion | MOYENNE | 5 |
| M15 | Embedded recording player | MOYENNE | 3 |
| M16 | Bulk actions list (follow-ups, tasks) | MOYENNE | 4 |
| M17 | Conflict detection on booking | MOYENNE | 3 |
| M18 | Keyboard shortcuts + A11y | MOYENNE | 3 |
| M19 | Mobile tabs detail | MOYENNE | 5 |
| M20 | Analytics PostHog (10 events) | BASSE | 3 |
| M21 | Integrations Fireflies/Otter/Read.ai (v2) | BASSE | 16 |

**Total v1 (M1-M11) :** ~51h · **v2 :** ~55h

---

## 4. Décisions à prendre

1. **Auto-send follow-up : toujours draft ou toggle auto-send 1h ?** → **Draft par défaut**, toggle auto-send opt-in setting.
2. **Live streaming : WS ou SSE ?** → SSE (simpler, works through proxies).
3. **Consent banner : bot message dans meeting ou email préalable ?** → Bot message via Recall `bot_message` config.
4. **Edit notes audit log : visible UI ou admin-only ?** → Admin-only.
5. **Transcripts cross-search : auth scope tenant-wide ou user-scoped ?** → Tenant-wide, role member+.
6. **Stage suggestion : auto-apply ou always confirm ?** → Always confirm (stage is high-value).

---

## 5. Prochaines actions
1. Martin : décisions §4.
2. Sprint critique : M1+M2+M3 (13h).
3. Sprint haute : M4+M5+M6+M7+M10+M11 (27h).
4. Sprint : M8+M9+M12+M13+M14+M15 (36h).
5. v2 : M16-M21.
