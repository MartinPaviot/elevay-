# Étape 9 — Sequences (outbound) — Exigences pixel-level

**Date :** 2026-04-13
**Scope :** `app/(dashboard)/sequences/page.tsx`, `/[id]/page.tsx`, `/[id]/review/page.tsx` + CampaignWizard + endpoints `/api/sequences`, `/api/campaigns/*`, `/api/outbound/*`, Inngest functions (`cron-trigger-sequence-steps`, `send-sequence-step`, `process-outbound-emails`).
**Méthode :** audit-deep `03a-sequences.md` (~500 lignes, exhaustif) + capture Monaco `3-execute-sequences.png`.

---

## 0. État actuel — rappel + updates

### 0.1 Blockers résolus depuis audit-03a
- **P1 audit-03a : "Aucun scheduler" → RÉSOLU par BUGFIX-04** (`cron-trigger-sequence-steps` toutes les 2 min fire `sequence/step-due`, `send-sequence-step` drafts next email, tenant-correct sends, idempotency, business-day delays, central pause). Voir commit `9ff3b79`.
- **P2 audit-03a : "Aucun webhook handler" → RÉSOLU par BUGFIX-07** (Resend webhook signed + verified, tracking pixel, click redirects, unsubscribe tokens). Voir commit `fdabaf4`.
- **P3 audit-03a : "Aucune analytics" → PARTIELLEMENT RÉSOLU** (engagement events stockés, mais dashboard analytics sequence pas encore complet — à vérifier).

### 0.2 Bugs encore présents
- **Limit 50 hardcoded** sur `/api/sequences` (ligne 47 audit).
- **N+4 queries** agrégation per-sequence.
- **Pas de pagination** sur enrolled table (détail sequence).
- **No ordering** sur enrollments → pagination chaotique.
- **No validation** sur PUT status (any string accepté).
- **Pas d'atomicité transaction** sur launch endpoint.

---

## 1. Exigences pixel-level

### 1.1 List page
- **Server-side pagination** (page=N&pageSize=25).
- **Search** par nom / description.
- **Filter** par status (draft/active/paused/archived).
- **Sort** par created_at / updated_at / enrollments_count / open_rate.
- **Bulk actions :** pause selected / archive selected / duplicate / export CSV.
- **Card enrichie** : name + desc + status badge + step count + enrolled + stats (sent/opened/clicked/replied pourcentages + trend ↑↓).
- **Empty state** : CTA "Create your first sequence" + "Use template" (3-5 templates built-in : cold outbound, follow-up, re-engagement, event invite, nurture).

### 1.2 Detail page
- **Analytics dashboard dédié** au-dessus du timeline :
  - Total enrolled / active / paused / completed / unsubscribed
  - Per-step performance : sent / open rate / click rate / reply rate / bounce rate
  - Heatmap time of day (quand les emails sont ouverts) → recommandation "Send step 2 at 10am for best open rate"
  - Funnel view : step 1 sent → opens → clicks → replies → meetings booked
  - Compare A/B steps si variantes
- **Timeline actions :**
  - Click step → side panel edit template (subject + body, variables `{first_name}`, `{company}`, etc.).
  - Add step between existing ones (+ icon).
  - Drag-drop to reorder.
  - Delete step (confirm + undo).
  - **Post-launch edit** : allow edit des steps pas encore envoyés, afficher "N enrollments haven't reached this step yet — your change applies to them".
- **Enrolled table :**
  - Pagination.
  - Sort par last_activity / current_step / status.
  - Filter par status (pending / active / paused / completed / replied / bounced).
  - Per-contact actions : pause / resume / unenroll / skip to step N / view thread.
  - Bulk : pause selected / unenroll selected / export.

### 1.3 Campaign wizard
Wizard en 4 steps (actuellement existant) : target → filter → AI draft → review → launch.

**Exigences améliorations :**
- **Target step :** 
  - TAM / Custom list / Upload CSV / All contacts segments.
  - Preview count "847 contacts match" + "[View sample]".
  - Filter builder chainable (industry, size, geo, score min, tag).
- **AI draft step :**
  - Streaming generation avec typing effect.
  - Multi-variant generation (3 variants per step) pour A/B test.
  - User can edit before approval, regenerate with feedback "Make it more casual".
  - Use tenant knowledge base (tenants.settings.knowledge) dans le prompt.
- **Review step :**
  - Table review déjà existe (`/[id]/review/page.tsx`).
  - **Exigence : preview rendu final** en HTML avec substitution des variables sur un contact exemple.
  - **Bulk approve par segment** ("Approve all drafts for industry = SaaS").
  - **Rate limit sur approvals** : si >500 approvals en 1 min → throttle (prévient clic-accidental on "Approve all").
- **Launch step :**
  - Schedule : "Now" / "Schedule for..." (date picker).
  - **Send pace :** max 50/h, 200/day (default = respect mailbox warmup).
  - Timezone awareness : "Send at 9am recipient local time" (requires contact timezone — fallback tenant timezone).
  - Deliverability check : warn si spam triggers dans template body (ALL CAPS, too many links, spammy phrases).

### 1.4 Template library
- **Exigence :** section `/sequences/templates` avec templates pré-fabriqués :
  - Cold outbound (5 steps : intro / value prop / case study / soft CTA / final ask)
  - Follow-up existing deals (3 steps : check-in / add value / decision time)
  - Re-engagement dormant (4 steps : "are you still interested?" / success story / easy win / walkaway)
  - Event invite (3 steps : save date / details / last call)
  - Nurture long-cycle (monthly over 6 months)
- Users can save own templates from existing sequences.

### 1.5 Physical gifting step type (Monaco parité)
- **Exigence différenciante :** ajouter step type `gift` (en plus de `email`, `wait`).
- Integration avec **Reachdesk / Sendoso / Alyce** API (ou vendor similaire). V1 : manuel (user enters address, gift picked manually).
- Template per gift type : champagne, coffee subscription, tech gadget, charity donation.
- Trigger : "After 3 business days" post-reply OR post-meeting.
- UI : step card avec image du gift + price + description (comme Monaco Veuve Clicquot card).

### 1.6 Meeting-booked automation
- Si un contact reply-then-book-meeting (detected via calendar sync), **auto-pause** la sequence et fire `meeting_booked` event pour CRM update.
- UI : badge "Meeting booked" sur la ligne contact dans enrolled table.

### 1.7 Reply intelligence
- Inngest `handle-reply-intelligently` existe (PROD_SETUP.md ligne 77).
- **Exigence UI :** dans le detail sequence, afficher les replies avec classification AI :
  - Categories : interested / not_interested / info_request / out_of_office / later / unsubscribe_request
  - Per-reply : auto-suggested action (draft reply, schedule meeting, mark stage, add to nurture).

### 1.8 Deliverability dashboard
- **Exigence :** page `/sequences/deliverability` (existe déjà cf audit) qui affiche :
  - Per-mailbox : warmup status, send quota, spam score, bounce rate, open rate.
  - Daily sent volume chart.
  - Alerts : "Mailbox X reached daily limit" / "Spam rate > 1% detected".

### 1.9 Unsubscribe management
- Page `/settings/opt-outs` (admin) listant tous les opted-out emails.
- Global suppression list.
- Import suppression list from CSV (e.g., legacy DND list).
- Audit log : quand et via quel email un contact s'est unsubscribed.

### 1.10 Export + reporting
- Export sequence as `.json` (pour template sharing across tenants).
- Export analytics as CSV (per-step performance).
- Schedule reports email weekly (aggregated analytics).

### 1.11 A/B test UI
- Per-step, allow 2-3 variants (A/B/C).
- Traffic split (e.g., 50/50 or 33/33/33).
- Winner detection auto : si variant A has 15%+ higher reply rate with n≥30 → auto-promote.
- UI : side-by-side variant editor, performance comparison.

### 1.12 Analytics PostHog
- `sequence_created` (from_template)
- `sequence_edited` (steps_changed, variants_added)
- `campaign_prepared` (companies_matched, contacts_found)
- `campaign_launched` (emails_queued)
- `sequence_paused` / `sequence_resumed` / `sequence_archived`
- `sequence_review_approved` (count, bulk)
- `sequence_reply_classified` (category)
- `sequence_step_performance` (daily rollup)

### 1.13 A11y + keyboard
- Timeline : `role="list"` + `aria-label="Sequence steps"`.
- Reorder : ARIA drag-drop with keyboard (`Space` to grab, `↑↓` move, `Space` drop).
- Review table : bulk select as accounts.

### 1.14 Mobile
- List → cards.
- Detail → tabs (Timeline / Enrolled / Analytics) stacked vertical.
- Review → stack vertical, inline edit.

---

## 2. Comparaison concurrents

### 2.1 Monaco (`3-execute-sequences.png`)
**Forces :**
- Step types multi-modaux : email + **physical gift** (Veuve Clicquot).
- Gift card riche (image + brand + description + size).
- Timeline ultra-propre (numbered circles + wait times + step names).
- Dark theme = mood premium.
- Per-step detail pane with recipient + subject + content + gift.

**Ce qu'on copie :**
- **Step type `gift`** (Monaco différenciant majeur).
- Timeline visuelle clean avec circles numérotés.
- Gift integration.

### 2.2 Lightfield
- Pas de capture sequences dans le dossier. Lightfield focus CRM + chat, pas outbound automation.

### 2.3 Gap synthèse
| Dimension | Elevay | Monaco | Gap |
|---|---|---|---|
| Scheduler backend | ✅ (BUGFIX-04) | ✅ | RESOLVED |
| Webhooks tracking | ✅ (BUGFIX-07) | ✅ | RESOLVED |
| Physical gift step | ❌ | ✅ | **HAUTE** |
| A/B test variants | ❌ | ? | HAUTE |
| Post-launch edit | ❌ | ✅ | HAUTE |
| Meeting-booked auto-pause | ⚠️ partiel | ✅ | HAUTE |
| Reply intelligence UI | ⚠️ backend OK | ? | HAUTE |
| Template library | ❌ | ✅ | HAUTE |
| Analytics dashboard | ⚠️ partial | ✅ | HAUTE |
| Deliverability dashboard | ⚠️ à vérifier | ✅ | MOYENNE |
| Heatmap time of day | ❌ | ? | MOYENNE |
| Timezone-aware send | ❌ | ✅ (probable) | MOYENNE |
| Spam trigger check | ❌ | ? | MOYENNE |

---

## 3. Gaps priorisés

| # | Gap | Criticité | Effort (h) |
|---|---|---|---|
| Q1 | Analytics dashboard complet per-sequence (funnel, heatmap, compare) | **CRITIQUE** | 12 |
| Q2 | Post-launch edit steps non-envoyés | **CRITIQUE** | 6 |
| Q3 | Template library 5 built-ins + user save | HAUTE | 8 |
| Q4 | A/B test variants (step-level, auto-winner) | HAUTE | 16 |
| Q5 | Reply intelligence UI (classification + suggested actions) | HAUTE | 6 |
| Q6 | Physical gift step type (v1 manual, v2 Sendoso integration) | HAUTE | 8 / 24 |
| Q7 | Meeting-booked auto-pause + badge UI | HAUTE | 3 |
| Q8 | Pagination server-side list + enrolled | HAUTE | 4 |
| Q9 | Deliverability dashboard complet | HAUTE | 8 |
| Q10 | Spam trigger check on submit | HAUTE | 3 |
| Q11 | Timezone-aware send | MOYENNE | 4 |
| Q12 | Global suppression list page | MOYENNE | 4 |
| Q13 | Schedule for... future date | MOYENNE | 3 |
| Q14 | Send pace (warmup-aware throttle) | MOYENNE | 4 |
| Q15 | Campaign wizard : multi-variant AI generation | MOYENNE | 6 |
| Q16 | Review : bulk approve par segment | MOYENNE | 3 |
| Q17 | Export sequence as JSON | MOYENNE | 2 |
| Q18 | Schedule reports weekly email | MOYENNE | 4 |
| Q19 | Drag-drop reorder steps | BASSE | 4 |
| Q20 | Deliverability alerts threshold | BASSE | 3 |

**Total v1 (Q1-Q10) :** ~74h · **v2 :** ~33h

---

## 4. Décisions à prendre

1. **Analytics sprint scope :** Q1 first vs Q2-Q3-Q5 basics first ? → **Q1 first** (sans analytics, on ne sait pas ce qui marche).
2. **Physical gift : Sendoso API ou manuel v1 ?** → **Manuel v1** (test demand avant intégration).
3. **A/B variants : step-level OR sequence-level ?** → **Step-level** (plus fine-grained).
4. **Template library : lock 5 curated OR allow community submissions ?** → **Lock 5 curated v1**.
5. **Schedule reports : email Resend OR in-app only ?** → **Les deux** (in-app toujours, email opt-in).
6. **Send pace defaults :** 50/h 200/day agressif ? → conservative default 30/h 100/day pour new mailboxes, scale avec warmup tenure.

---

## 5. Prochaines actions
1. Martin : décisions §4.
2. Sprint critique : Q1 (12h) — analytics sans lesquelles on vole aveugle.
3. Sprint : Q2+Q3+Q5+Q7+Q8 (27h) — post-launch + templates + reply intel + pagination.
4. Sprint : Q4+Q6+Q9+Q10 (30h) — A/B + gifting + deliverability + spam check.
5. v2 : Q11-Q20.
