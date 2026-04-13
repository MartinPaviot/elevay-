# Étape 11 — Opportunities — Exigences pixel-level

**Date :** 2026-04-13
**Scope :** `/opportunities/page.tsx`, `/opportunities/[id]/page.tsx`, endpoints `/api/deals/*` + analytics.
**Méthode :** audit-deep `04-meetings-opportunities.md` (section OPPORTUNITIES) + captures Lightfield `opportunities-kanban-empty.png`, `opportunity-detail.png`, `create-opportunity-dialog.png` + Monaco `5-track-pipeline.png`.

---

## 0. État actuel — rappel

D'après audit-04 :
- **Stages** : lead → qualification → demo → trial → proposal → negotiation → won/lost
- **Vues** : Board (Kanban) + Table (sortable, filterable)
- **Filters** : field, label, operator (eq/contains/gte/lte), value
- **Analytics** : total deals, active, pipeline value, won/lost counts, win rate, avg deal value, avg velocity (days), value by stage, funnel, risk summary
- **Card deal** : name, stage, value, company, owner, summary, expected close, risk level, custom properties

### 0.1 Gaps connus audit-04
- Filter builder UI non inspecté en détail.
- Interaction drag-drop Kanban non confirmée.

---

## 1. Exigences pixel-level

### 1.1 Kanban board
- **Drag-drop** columns → stages. Inline stage change avec optimistic update + toast.
- **Sort intra-column** : amount DESC / close date ASC / last activity.
- **Card density toggle** : compact (name + value only) / default / detailed (summary + next steps).
- **WIP limits** per column (optional admin setting) : si > N deals, column badge orange "Over capacity".
- **Empty column** : "+ Create opportunity" inline comme Lightfield (au lieu d'un empty state séparé).
- **Aggregate per column** : "5 deals · $125k" header.

### 1.2 Table view
- Parité colonnes/filters/custom fields avec accounts/contacts (Étape 7/8).
- Colonnes : Name / Account / Stage / Value / Expected close / Owner / Last activity / Risk level / Probability / Age in stage.
- **Probabilité** auto-derived du stage (lead 10%, qualification 25%, demo 40%, trial 55%, proposal 70%, negotiation 85%, won 100%, lost 0%). User override possible.
- **Age in stage** : days depuis dernier stage change. Color-coded : <7j green, 7-14j yellow, >14j red.

### 1.3 Detail page
- Similaire structure meeting-detail (tabs or accordion) :
  - **Overview** — AI summary + health score (derived from recent activity, engagement, sentiment)
  - **Timeline narrative** (Monaco parité — différenciant)
  - **Next steps** — checklist éditable
  - **Attendees / Contacts** — list, roles (decision-maker, champion, blocker)
  - **Activity** — emails + meetings + calls + notes chronologique
  - **Custom properties** — editable inline
  - **Competitors** — list (auto-detected from meeting transcripts)
  - **Buying signals** — aggregated from all meetings linked
  - **Related deals** — same account, same competitor, similar size

### 1.4 Timeline narrative (Monaco différenciant)
- **Exigence :** chronologique de ce qui s'est passé sur le deal, avec dates et résumés riches.
- Auto-generated de : activities (emails, meetings, notes) → LLM summarizes chaque interaction en 1-2 phrases.
- Format Monaco :
  ```
  October 27, 2025: Monaco <> Judgment Labs follow-up — discussion on TAM, sequences,
  and pipeline. Owner Sam Blond. Expected Close Date: November 30, 2025.
  ```
- Update auto quand nouvelle activity ajoutée.
- User peut ajouter entries manuelles (pas juste AI).

### 1.5 Deal health score + risk banner
- **Score 0-100** computed from :
  - Engagement score du account + contact principal
  - Days since last activity
  - Completeness fields (MEDDIC/BANT filled)
  - Sentiment from recent meetings
  - Email response rate from champion
  - Stage velocity (current vs avg)
- **Risk banner** si score < 40 : "This deal is stalling. [Generate re-engagement plan]" + CTA AI-generated follow-up strategy.
- Display in header : grade A/B/C/D + color.

### 1.6 Auto-progression suggestions
- **Exigence :** quand activity event triggers stage progression hint (via meeting transcript analysis — §Étape 10 M7), banner on deal detail :
  - "Based on your last meeting, move to 'Demo scheduled'? [Yes] [No]"
- **Auto-progression** setting : if enabled, Elevay auto-moves stages with 100% confidence signals (ex: meeting with agenda "Demo" done).
- Always log stage changes in activity timeline.

### 1.7 Create dialog (Lightfield parité)
- Dialog minimal : Account (required, searchable) + Name (defaulted "New business" or "{{Account}} — {{current_month}}") + Stage (dropdown, default Lead) + Contacts (optional, multi-select).
- **Exigences additionnelles :**
  - Value (optional, formatted with currency).
  - Expected close date (optional).
  - Source (how did this come in? — inbound / outbound / referral / event).
  - Owner (if team, default = current user).
- Auto-enrich : if Account has recent activity, show "This account has 3 recent interactions — [Link them to this deal]".

### 1.8 Import/Export
- Parity avec accounts/contacts (Étape 7/8).
- Export CSV with deals + stages + custom fields + forecast columns.
- Import CSV → AI-mapping.

### 1.9 Forecasting
- **Exigence :** section `Forecast` dans la top nav ou dedicated page `/opportunities/forecast` :
  - Pipeline weighted by probability.
  - Forecast this month / this quarter.
  - Commit / Best Case / Pipeline breakdown.
  - Historical accuracy : "Last quarter forecast was X, actual was Y — accuracy 78%".
- Editable commit vs best case per deal.

### 1.10 Analytics dashboard
- Amélioré vs existant :
  - **Per-stage funnel** avec drop-off rates + avg time in stage.
  - **Win/lost reasons** tracking (dropdown at close-time : competitor won / no budget / wrong timing / priorities changed / …).
  - **Win-rate by source, owner, industry.**
  - **Stalled deals** table : all deals >14j in stage.
  - **Pipeline velocity** : median days from creation → won.
  - **Cohort analysis** : conversion rate by month of creation.

### 1.11 Deal coaching (AI)
- **Exigence :** per-deal, CTA "Get coaching" → AI analyses deal state + generates :
  - Next best action (who to email, what to ask, meeting to book).
  - Risks (objections not addressed, champion at risk, competitor gaining ground).
  - Talking points for next meeting.
  - Email draft for next step.
- Embedded in detail page "Coach" tab OR button.

### 1.12 Competitor tracking
- **Exigence :** auto-detect competitors from meeting transcripts + email content.
- Per-deal "Competitors" section with each competitor : status (leading / lost to / comparing), budget share, their strengths (from transcripts).
- Tenant-level competitor intel : if Elevay detects "We're comparing with Salesforce" across 10 deals, generate a battlecard.

### 1.13 Team collaboration
- @mentions in notes / activity (triggers notification).
- Deal ownership transfer (log change).
- **Shared view** : "My team's open deals" filter.
- Comments per deal for internal discussion (not visible to prospect).

### 1.14 A11y + keyboard
- Kanban : drag with keyboard (Space grab, ←→ move column, Enter drop).
- Shortcuts : `K` switch to Kanban, `T` to Table, `N` new deal, `/` search.

### 1.15 Mobile
- Kanban → horizontal swipe between columns.
- Table → vertical cards.
- Detail → tabs stacked.

### 1.16 Analytics PostHog
- `opportunity_created` (source, has_contacts, has_value)
- `opportunity_stage_changed` (from, to, method = manual | suggested | auto)
- `opportunity_coaching_requested`
- `opportunity_risk_viewed`
- `opportunity_won` / `opportunity_lost` (reason)
- `opportunity_timeline_entry_added` (manual)
- `forecast_viewed` (period)
- `deal_filter_saved` (filter_definition)

---

## 2. Comparaison concurrents

### 2.1 Monaco (`5-track-pipeline.png`)
**Forces :**
- Liste déals avec **montants gros et clair** + logo par deal.
- **Hotness emoji flamme orange** sur Judgment Labs → surgit visuellement les hot deals.
- **Overview panel** avec **Summary narrative riche** : contexte, state, next step, owner, expected close date, followed by **dated timeline entries** en chronologique inverse.
- Dark theme premium feel.

**Ce qu'on copie :**
- Timeline narrative dated (§1.4) — différenciant majeur.
- Hotness emoji sur card deal.
- Summary narrative auto-generated.

### 2.2 Lightfield (3 captures)
**Forces (kanban empty) :**
- Kanban propre avec columns Lead / Qualification / Demo.
- "+ Create opportunity" inline dans chaque column vide (vs empty state séparé).
- Import/Export + Create top-right (pattern cohérent Accounts/Contacts/Opportunities).

**Forces (detail) :**
- Panel détail avec "Opportunity details" section compacte.
- Name / Account / Owner / Stage / Upcoming meetings / Open tasks.
- "See all" links par section.

**Forces (create dialog) :**
- Minimal : Account + Opportunity + Stage + Contacts.
- "Account" required, Stage default "Lead".
- Clean, 4-field form.

**Ce qu'on copie :**
- Create dialog minimal 4-field.
- "+ Create opportunity" inline dans empty columns.
- Import/Export + Create top-right.
- Panel avec sections Upcoming meetings / Open tasks / "See all" links.

### 2.3 Gap synthèse
| Dimension | Elevay | Monaco | Lightfield | Gap |
|---|---|---|---|---|
| Timeline narrative | ❌ | ✅ | ⚠️ partial | **CRITIQUE** |
| Hotness emoji | ❌ | ✅ | ❌ | HAUTE |
| Deal health score | ⚠️ risk level existe | ⚠️ | ❌ | HAUTE |
| Auto-progression suggestion | ❌ | ? | ❌ | HAUTE |
| AI coaching | ❌ | ✅ (Monaco deal coaching) | ❌ | HAUTE |
| Forecasting page | ⚠️ analytics partial | ✅ | ❌ | HAUTE |
| Win/lost reasons | ❌ | ✅ | ❌ | HAUTE |
| Competitor tracking | ⚠️ meeting extract | ✅ | ❌ | HAUTE |
| Stalled deals table | ⚠️ audit existe | ✅ | ❌ | MOYENNE |
| Kanban empty col inline CTA | ⚠️ à vérifier | ❌ | ✅ | MOYENNE |
| Import/Export deals | ⚠️ à vérifier | ❌ | ✅ | MOYENNE |
| Drag-drop keyboard | ❌ | ? | ? | MOYENNE |
| @mentions + team collab | ❌ | ? | ? | MOYENNE |
| Create dialog minimal | ⚠️ | ? | ✅ | BASSE |

---

## 3. Gaps priorisés

| # | Gap | Criticité | Effort (h) |
|---|---|---|---|
| Y1 | Timeline narrative auto + manual entries | **CRITIQUE** | 10 |
| Y2 | Deal health score + risk banner + re-engagement AI | **CRITIQUE** | 10 |
| Y3 | Auto-progression suggestions depuis meetings | **CRITIQUE** | 6 |
| Y4 | AI coaching tab (next action + risks + talking points) | HAUTE | 12 |
| Y5 | Forecasting page + commit/best-case | HAUTE | 10 |
| Y6 | Win/lost reasons tracking + stage velocity analytics | HAUTE | 6 |
| Y7 | Competitor tracking per-deal + tenant-level battlecard | HAUTE | 8 |
| Y8 | Hotness emoji + probability column | HAUTE | 3 |
| Y9 | Kanban drag-drop optimistic update + WIP limits | HAUTE | 5 |
| Y10 | Create dialog minimal (Lightfield parity) | HAUTE | 3 |
| Y11 | Detail page sections complètes (8 tabs/accordion) | HAUTE | 8 |
| Y12 | Stalled deals filter + dashboard | MOYENNE | 4 |
| Y13 | Import/Export deals CSV | MOYENNE | 4 |
| Y14 | @mentions in notes + notifications | MOYENNE | 5 |
| Y15 | Team shared views (if multi-user) | MOYENNE | 3 |
| Y16 | Column density toggle + sort intra-column | MOYENNE | 3 |
| Y17 | Mobile Kanban swipe + detail tabs | MOYENNE | 6 |
| Y18 | Keyboard shortcuts (K/T/N/drag-drop) | MOYENNE | 4 |
| Y19 | Analytics PostHog (8 events) | BASSE | 3 |
| Y20 | Cohort analysis monthly | BASSE | 4 |

**Total v1 (Y1-Y11) :** ~81h · **v2 :** ~36h

---

## 4. Décisions à prendre

1. **Timeline narrative : all-auto or manual-addable ?** → **Both**, auto + manual entries intercalées.
2. **Health score : hidden score only OR grade letter visible ?** → **Letter + score tooltip**.
3. **Coaching : dedicated tab OR inline banner ?** → **Tab** + inline risk banner.
4. **Forecasting period : quarter default OR user-configurable ?** → **Quarter default**, switcher user.
5. **Win/lost reasons : curated list OR free-text ?** → **Curated + "Other..." with free text**.
6. **Competitor tracking : detected auto OR manual input ?** → **Auto detection + user confirm** (LLM precision not 100%).

---

## 5. Prochaines actions
1. Martin : décisions §4.
2. Sprint critique : Y1+Y2+Y3 (26h).
3. Sprint : Y4+Y5+Y6+Y7+Y8 (39h) — AI + analytics + compet.
4. Sprint : Y9+Y10+Y11 (16h) — UX polish.
5. v2 : Y12-Y20.
