# Étape 5 — Dashboard Home ("Up next") — Exigences pixel-level

**Date :** 2026-04-13
**Scope :** `app/apps/web/src/app/(dashboard)/home/page.tsx` (730 lignes).
**Méthode :** code lu (top 250 lignes + refs audit) + capture Lightfield `app-up-next.png`.

---

## 0. État actuel vérifié (2026-04-13)

### 0.1 Architecture
- Client component, 6 fetch au mount (lignes 128-166) :
  - `/api/onboarding/status` → déclenche wizard si `needsOnboarding`
  - `/api/dashboard/summary` → greeting, weekSummary, founderMetrics, todayTasks, todayMeetings
  - `/api/actions` → priorités du jour
  - `/api/insights` → business insights
  - `/api/priorities` → hot contacts
  - `/api/recommendations` → recos hebdo
- **Coût mount :** 6 round-trips HTTP parallèles → TTFB user-visible dominé par le plus lent (~500-800ms typique).

### 0.2 Sections
| Section | Source de données | Lignes (approximatif) |
|---|---|---|
| PageHeader "Up next" + date | static | 179 |
| Greeting personnalisé + challenge subtitle | `/api/dashboard/summary` | 183-198 |
| Welcome banner (first-time) | `firstTime=true` + `founderMetrics` | 200-246 |
| Weekly summary (outbound OR founder stats) | `weekSummary` + `founderMetrics` | 248-286 |
| Deals at risk (max 3) | `founderMetrics.dealsAtRisk` | 289+ |
| Priorités du jour (max 5) | `/api/actions` | 337+ |
| Today's schedule (right col) | `/api/dashboard/summary` | 485+ |
| Hot contacts (top 5) | `/api/priorities` | 485+ |
| Recommendations (max 3) | `/api/recommendations` | 485+ |
| Priority detail panel (slide-over) | `/api/actions` item | 616-703 |

### 0.3 Greeting + challenge routing
- Copy subtitle change selon `summary.challenge` :
  - "Finding the right leads" → "Your top prospects by fit score."
  - "Getting responses" → "Reply rates and follow-up gaps."
  - "Closing deals" → "Pipeline velocity and next steps."
  - "Expanding accounts" → "Expansion signals across your accounts."
  - Fallback → date du jour
- **Bug potentiel** : la valeur `summary.challenge` utilise les labels anglais hardcodés. Si onboarding wizard stocke en français ou si un autre label → fallback date affiché. Vérifier cohérence avec `onboarding-wizard.tsx` : `CHALLENGES = ["Finding leads", "Getting responses", "Closing deals", "Expanding accounts"]` — **mismatch** : "Finding leads" vs "Finding the right leads" dans home. Bug confirmé.

### 0.4 Welcome banner (first-time)
- Trigger : `?firstTime=true` + `!localStorage.leadsens_welcomed`
- 3 CTAs : Review top accounts / Launch a campaign / Ask Elevay
- Chaque click set le flag localStorage + redirect hard (`window.location.href`) → **full page reload**, perd state React. Exigence : utiliser `router.push()` de Next.js.

### 0.5 Weekly summary logic
- Si `outboundTotal > 0` → stats outbound (sequences, responses, meetings, closed).
- Sinon si `founderMetrics` a data → stats founder (accounts, contacts, pipeline, deals).
- Sinon rien.
- **Aucun trend indicator** (↑/↓ vs semaine précédente).

### 0.6 Limitations hardcodées
- `actions` capped à 5 (voir lignes ~337+) — cap dur.
- `dealsAtRisk` capped à 3.
- `priorities` top 5.
- `recommendations` top 3.
- **Aucun "View all"** pour dépasser les caps.

### 0.7 Priority detail panel
- Slide-over right, non-resizable.
- Footer : "Send follow-up" (ouvre EmailComposer) ou "View details" (redirect).
- Pas d'édition inline (status, notes, due date).

---

## 1. Exigences pixel-level

### 1.1 Performance : consolider les 6 fetches
- **Actuel :** 6 round-trips séquentiels en `useEffect`. Chacun avec son `.catch()` → expérience dégradée si un seul plante.
- **Exigence v1 :** endpoint consolidé `GET /api/dashboard/hydrate` qui retourne un JSON agrégé : `{ status, summary, actions, insights, priorities, recommendations }`. 1 round-trip, pipeline parallèle côté serveur.
- **Exigence v2 :** ISR/SWR caching 60s sur summary + priorities (données rarement changeantes). Revalidate on focus.
- **Exigence v2 :** streaming SSR (React Server Components + Suspense) pour afficher le `greeting` instantanément, puis hydrater les cards quand prêt.

### 1.2 Fix challenge label mismatch (BUG)
- Home ligne 188 utilise "Finding the right leads", wizard ligne 47 utilise "Finding leads".
- **Exigence :** normaliser les 4 labels. Préférer les labels courts du wizard. Update home aussi.
- Migration DB : si `tenants.settings.challenge` stocke déjà la vieille valeur → migration script pour normaliser.

### 1.3 Empty state & new-user progressive reveal
- **Actuel :** si user n'a **rien** encore (no accounts, no deals, no meetings) → la plupart des sections sont vides, la page est **fantôme**.
- **Exigence :** progressive reveal selon l'état :
  - **User sans data (post-onboarding, avant build TAM)** : grande zone "Welcome banner" + CTA "Build your TAM" centrée, sidebar skeletons des autres sections grisées avec teaser "Review 5 accounts to see them here".
  - **User post-TAM mais no outbound yet** : bannière "Your prospects are ready — launch your first sequence" + CTA.
  - **User actif** : page normale.
- Conçoit l'empty state comme une étape d'activation, pas un blank.

### 1.4 Cap dur → "View all" + pagination
- Pour chaque section cappée (actions 5, deals-at-risk 3, priorities 5, recommendations 3) :
  - Afficher "N of M · [View all]" en footer de la section.
  - "View all" ouvre un dialog plein écran OU redirige vers la page list filtrée (ex: actions → `/actions`, priorities → `/contacts?sort=priority`).
- **Attention :** ne pas sur-charger la home. Cap reste à 5 actions mais access total doit être 1 click.

### 1.5 Trend indicators
- **Exigence :** sur chaque stat (weekly summary), afficher delta vs semaine précédente :
  - `12 sequences launched ↑ +3 vs last week`
  - `47 responses received ↑ +12`
  - `3 meetings booked → same`
- Code delta : endpoint doit renvoyer `{ current, previous }`, front calcule delta + arrow.
- Couleur : vert si ≥0 en positif, rouge si négatif sur les bons sens, gris si no change.

### 1.6 Deals at risk — tri + clickable direct
- **Actuel :** max 3, click → `/opportunities` (liste). Perd contexte.
- **Exigence :**
  - Click sur un deal at risk → `/opportunities/{id}` (détail direct).
  - Badge "Silent Nd" + color-code selon `N` : 7d jaune / 14d orange / 30d+ rouge.
  - Hover action icons inline : "Draft follow-up" (ouvre EmailComposer prefilled) / "Mark safe" (pause l'alerte 7j) / "Mark lost" (move to stage lost).

### 1.7 Priority detail panel amélioré
- **Actuel :** panel view only + send follow-up. Pas d'édition.
- **Exigences :**
  - **Inline edit :** status, priority, due date éditables inline (Enter to save).
  - **Mark done** avec check icon + animation slide-out. L'item disparaît de la list.
  - **Snooze** 1h / tomorrow / next week.
  - **Resizable** (drag bord gauche du panel).
  - **Keyboard :** `J/K` navigate actions, `E` open panel, `D` mark done, `S` snooze, `F` follow-up.
  - **Panel header :** breadcrumb "Action 3 of 5 → Sarah Chen (Acme Corp)".

### 1.8 Top-right tabs "Just me" vs "My team" (Lightfield parité)
- Lightfield affiche ces tabs (capture app-up-next.png, ligne 1 du main).
- **Exigence v2 (si multi-user tenant) :**
  - Tab "Just me" (défaut) → filtre `owner = current_user`.
  - Tab "My team" → filtre `tenant members`.
  - Disabled si tenant solo (1 user).
- Endpoint doit accepter `?scope=me|team`.

### 1.9 "+ Create" top-right global
- Lightfield a un CTA "+ Create" top-right avec dropdown (New account / New contact / New deal / New task / New note).
- **Exigence :** ajouter dans le layout (pas home-only — global dashboard). Shortcut `C` pour ouvrir.
- Dropdown items : New account, New contact, New deal, New task, New sequence, New note.

### 1.10 Persistent chat input bottom (Lightfield parité)
- Lightfield a un chat input "Ask Lightfield" en bas permanent sur toutes les pages.
- Elevay a `PersistentChatBar` déjà (cf `layout.tsx`) — à vérifier qu'il fonctionne sur home.
- **Exigence :** s'assurer que `PersistentChatBar` est rendu sur home, avec query autocomplete basé sur le contexte de la page.

### 1.11 Dates + locale
- Actuel : `toLocaleDateString("en-US")` hardcodé (ligne 169).
- **Exigence :** utiliser `Intl.DateTimeFormat` avec la locale utilisateur (`settings.profile.language`).
- Format concis : "Mon, Apr 13" au lieu de "Monday, April 13" (plus dense, Lightfield fait ça).

### 1.12 Page header : plus que "Up next"
- Actuel : `<PageHeader icon={<Clock/>} title="Up next" subtitle={today} />`
- **Exigence :** ajouter à droite du header :
  - Refresh icon (trigger le hydrate)
  - Settings gear (ouvre preferences "ce qui apparaît sur ton Home")
  - Date picker (voir "hier" / "demain" / semaine précédente)

### 1.13 Analytics PostHog
- **Exigence events :**
  - `home_viewed` (has_welcome_banner, sections_rendered_count)
  - `home_action_clicked` (action_id, priority, category)
  - `home_action_done` (action_id, method = click_button | keyboard)
  - `home_deal_at_risk_clicked` (deal_id, days_silent)
  - `home_priority_contact_clicked` (contact_id)
  - `home_email_composer_opened` (source = action | priority | deal)
  - `home_welcome_cta_clicked` (cta = top_accounts | campaign | ask)
  - `home_section_view_all_clicked` (section_name)
  - `home_scope_changed` (from, to)

### 1.14 Skeleton et loading
- Actuel : `Skeleton` component importé mais l'usage n'est pas uniforme. Certaines sections affichent `null` pendant loading → layout shift.
- **Exigence :** chaque section doit avoir un skeleton-placeholder strict (même dimensions qu'un état chargé). `loadingSummary`, `loadingActions` déjà présents — étendre au reste.
- Target CLS (Cumulative Layout Shift) : < 0.1.

### 1.15 A11y
- **Landmarks :** `<main>` sur content, `<aside>` sur right column, `<section aria-labelledby>` pour chaque widget.
- **Live regions :** nouveaux insights / priorités → `aria-live="polite"` pour screen readers.
- **Keyboard navigation :** Tab order logique (greeting → banner → weekly → deals → actions → sidebar).
- **Shortcuts :** documenter les shortcuts (`?` overlay help).

### 1.16 Responsive mobile
- Actuel : layout 2-col (main + aside). Mobile → aside stack en bas ?
- **Exigence :** mobile stack vertical : greeting → banner → actions → deals-at-risk → today schedule (meetings, tasks, hot contacts, recommendations) → chat bar sticky.
- **Mobile cap** : réduire cap actions à 3 (vs 5 desktop), permettre expand via "See more".

### 1.17 Copy
- Aujourd'hui les CTAs sont "Review top accounts" / "Launch a campaign" / "Ask Elevay".
- Exigence : micro-copy plus vivante : "See who to email first" / "Start a campaign" / "Ask anything".
- Éviter jargon "sales engine" (mentionné welcome banner) → "your setup is ready" plus humain.

### 1.18 "Up next" comme concept
- Le titre "Up next" (Lightfield influence) est un **promesse** — il doit lister ce qui est **up next**, pas tout afficher.
- **Exigence philosophique :** repenser la page comme "3 choses que je dois faire maintenant" plutôt que "dashboard de tout".
- Option radicale : v2 layout = 1 section "Up next" (3-5 actions ordonnées par priorité) + chat en bas. Tout le reste (deals, priorities, recommendations) déplacé vers pages dédiées (/opportunities, /contacts, /insights).
- Garder la densité si user veut "tout en un", mais offrir un mode "focus" (setting user : "Full dashboard" | "Focus mode").

---

## 2. Comparaison concurrents

### 2.1 Lightfield (capture app-up-next.png)
**Forces :**
- Minimalisme : 2 sections (Meetings + Tasks) + chat en bas.
- Tabs "Just me" / "My team" → scope immédiat.
- Date header clair "Mon, Mar 30".
- Dropdown "Today" sur chaque section → range flexible.
- Sidebar très structurée (Records / Resources / Lists / Chats).
- Empty states propres ("No meetings", "No tasks") — pas d'encombrement.
- **+ Create** global top-right.
- Chat persistent bottom "Ask Lightfield".

**Faiblesses :**
- Très **passif** : ne dit pas "qui appeler maintenant". Juste calendrier + tasks.
- Pas d'actions recommandées (AI-native gap vs Elevay).
- Pas de signals / insights.

**Ce qu'on copie :**
- Header "Up next" + date ✅ déjà fait.
- Tabs Just me / My team pour v2.
- "+ Create" global top-right.
- Sidebar structure (à vérifier étape 12).

**Ce qu'on ne copie pas :**
- Minimalisme extrême — Elevay est AI-action-first, ça justifie la densité.

### 2.2 Monaco
- Pas de capture home disponible.

### 2.3 Gap synthèse
| Dimension | Elevay actuel | Lightfield | Gap |
|---|---|---|---|
| API hydration | 6 round-trips | 1-2 estimés | **HAUTE** |
| Tabs Just me / My team | ❌ absent | ✅ | MOYENNE |
| "+ Create" global | ❌ pas sur home | ✅ top-right | MOYENNE |
| Empty state propre | ⚠️ certaines sections vides | ✅ "No X" messages | HAUTE |
| Chat persistent | ✅ (à vérifier) | ✅ | OK |
| Trend indicators | ❌ | ? | MOYENNE |
| Inline edit priorités | ❌ | ? | HAUTE |
| Action shortcuts keyboard | ❌ | ? | MOYENNE |
| Deep-links actions | ✅ priority panel | ✅ | OK |
| Focus mode | ❌ | ❌ | + Elevay v2 |

---

## 3. Gaps priorisés

| # | Gap | Criticité | Effort (h) | Bloquant pour ? |
|---|---|---|---|---|
| H1 | `/api/dashboard/hydrate` consolidé | **CRITIQUE** | 5 | TTFB, UX perceived perf |
| H2 | Fix challenge label mismatch wizard ↔ home | **CRITIQUE** | 0.5 | Subtitle correct |
| H3 | Progressive reveal new-user / empty states propres | **CRITIQUE** | 6 | Activation new users |
| H4 | Welcome banner : `router.push` au lieu de `window.location` | HAUTE | 0.5 | SPA integrity |
| H5 | "View all" footer par section cappée | HAUTE | 3 | UX (users voient que 3-5) |
| H6 | Trend indicators sur weekly summary | HAUTE | 3 | Value-add dashboard |
| H7 | Deals at risk : click → détail direct + badge days color | HAUTE | 2 | UX navigation |
| H8 | Priority panel : inline edit + mark done + snooze | HAUTE | 6 | Productivity |
| H9 | Skeleton uniforme + CLS <0.1 | HAUTE | 3 | Polish, SEO |
| H10 | Vérifier PersistentChatBar fonctionne sur home | HAUTE | 1 | Parité Lightfield |
| H11 | `Intl.DateTimeFormat` locale-aware | MOYENNE | 1 | i18n |
| H12 | PostHog events (9 events) | MOYENNE | 3 | Analytics |
| H13 | Refresh + Settings + Date picker dans page header | MOYENNE | 4 | Pouvoir utilisateur |
| H14 | Tabs "Just me" / "My team" v2 | MOYENNE | 4 | Multi-user parity |
| H15 | "+ Create" global top-right v2 | MOYENNE | 3 | Parity Lightfield |
| H16 | Keyboard shortcuts (J/K/E/D/S/F/?) | MOYENNE | 4 | Power users |
| H17 | Responsive mobile stack + cap 3 actions | MOYENNE | 4 | Mobile users |
| H18 | Copy refresh + no "sales engine" jargon | BASSE | 1 | Polish |
| H19 | A11y landmarks + aria-live + tab order | BASSE | 2 | WCAG |
| H20 | "Focus mode" setting (minimal vs dashboard) | BASSE (v2) | 8 | Flexibilité UX |

**Total effort v1 (H1-H10) :** ~30h
**Total effort v2 (H11-H20) :** ~34h

---

## 4. Décisions à prendre

1. **Hydrate endpoint consolidé : REST ou tRPC-like ?** — Recommandation : REST simple `GET /api/dashboard/hydrate` avec `{ status, summary, actions, ... }`. Pas besoin de tRPC v1.
2. **Progressive reveal : 3 états (no data / no outbound / active) ou plus granulaire ?** — 3 suffit v1.
3. **Tabs "Just me / My team" v1 ou v2 ?** — V2. V1 tenants sont majoritairement solo.
4. **"+ Create" global : dropdown ou modal ?** — Dropdown menu (plus rapide).
5. **Focus mode setting : user toggle ou auto-detect (si < 3 items active) ?** — User toggle explicit v2.
6. **Deal at risk click → /opportunities/{id} ou panel overlay ?** — Détail page `/opportunities/{id}` (moins de niveaux UI).
7. **Snooze durations : 1h / tomorrow / next-week ou custom ?** — Les 3 en default + "custom..." qui ouvre un date picker.

---

## 5. Prochaines actions

1. Martin : répond aux 7 décisions §4.
2. Quick wins : H2 + H4 (~1h).
3. H1 (hydrate consolidé) en sprint dédié → gain perçu énorme.
4. H3 + H5 + H7 + H10 ensuite (~12h) → UX navigation + empty states.
5. H6 + H8 + H9 (~12h) → productivity + polish.
6. v2 : H11-H20.
