# Étape 7 — Accounts (TAM) — Exigences pixel-level

**Date :** 2026-04-13
**Scope :** `app/apps/web/src/app/(dashboard)/accounts/page.tsx` (916 lignes) + `accounts/[id]/page.tsx` + composant `IntelligenceBrief` + endpoints `/api/enrich`, `/api/score`, `/api/signals`, `/api/search/tam`, `/api/tam`.
**Méthode :** code + audit-deep `03c-accounts.md` (~500 lignes, très complet) + captures Monaco `1-build-tam.png` + Lightfield `accounts-with-data.png`, `account-detail-meridian.png`.
**Note :** l'audit 03c couvre déjà l'état actuel en profondeur. Ce doc **priorise les gaps** et **ajoute la comparaison concurrents**.

---

## 0. État actuel — rappel + updates (verify 2026-04-13)

### 0.1 Bugs résolus depuis audit-03c
- `.catch(() => {})` silencieux ligne 84, 113, 122, 135-136, 146, 156, 165 → **tous purgés par BUGFIX-06** (grep retourne 0 matches).

### 0.2 Bugs encore présents (verify code)
- **Charge côté client tous les accounts en boucle `while(hasMore)` pageSize=200** (accounts page ligne 74-82) → 5k accounts = 25 round-trips séquentiels avant 1er render. **Pas de virtualisation** (`<table>` avec `filteredAccounts.map` brut).
- **Bulk actions serveur cap à 20** silencieusement (`/api/enrich` ligne 45, `/api/signals` ligne 54). UI dit "Enrich 100 accounts" → serveur traite 20 → **user ne sait pas**. BUG PRODUIT majeur.
- **`selectedRows` state mort :** checkboxes actives mais aucune action ne les utilise. Aucun "Score selected" / "Delete" / "Assign".
- **`customBoolColumns = ["Common Investor?", "Sales-led?"]` hardcodés** (ligne 193, dette annoncée "Kept for backward compatibility").
- **Badge "Suggested" appliqué à TOUS les contacts expanded**, pas seulement Apollo suggestions (ligne 798). **Copy trompeuse.**
- **Clearbit `logo.clearbit.com/{domain}`** utilisé pour favicons (ligne 712) : dépendance externe non documentée, silencieuse si échec (`onError hide`).
- **Search semantic sans feedback :** input → setSearchResults mais pas de "N semantic matches" badge, pas de score similarité visible, pas de différentiation visuelle.

### 0.3 Module IntelligenceBrief (audit-03c §Composant)
- **Lightweight** : `{ brief: string; keyRelationships: string[]; suggestedAction: string }`. 1 paragraphe + pills + action recommandée.
- **Aucune interaction :** suggestedAction sans CTA cliquable vers l'action. Pills non-cliquables.
- Cache serveur 1h ✅ mais **pas de cache client** → re-fetch à chaque ouverture slide-over.
- Empty state par **string-match** `brief.includes("Not enough data")` → fragile.

---

## 1. Exigences pixel-level

### 1.1 Chargement : server-side pagination (CRITIQUE perf)
- **Exigence :** remplacer la boucle `while(hasMore)` client par **pagination server-side** avec infinite scroll (intersection observer au bas du tableau) OU virtualisation (`react-virtuoso` ou `@tanstack/react-virtual`).
- URL state : `?page=1&pageSize=50&sort=score&dir=desc&filter=tam`.
- Skeleton pendant fetch page, placeholder rows pendant pagination.
- **Cible perf :** first render ≤500ms même sur tenant 5k accounts.

### 1.2 Bulk actions : vrai batch processing
- **Exigence critique (BUG produit majeur) :**
  - Option A : serveur accepte > 20 via queue Inngest. Return `{ jobId, total, batchSize: 20 }` → UI polling pour afficher progression.
  - Option B : serveur continue cap 20 MAIS UI **avertit** : "Only the first 20 accounts will be enriched. [Enqueue remaining]" button qui dispatch par tranches.
- **Recommandation :** Option A (Inngest pour jobs background).
- **Progress toast :** "Enriching 87 accounts… 23 done. [View progress]" avec lien vers `/inngest-dashboard` (admin-only) ou un toast persistant.
- **Résultat final :** toast "87 enriched, 3 failed (API error). [Retry failed]" avec detail click.

### 1.3 Selection multiple — brancher les actions
- **Exigences :**
  - "Score selected" / "Enrich selected" / "Detect signals selected" → applique l'action seulement aux `selectedRows`.
  - "Export selected as CSV".
  - "Delete selected" (avec confirm dialog + undo toast 5s).
  - "Assign owner" (dropdown des tenant members).
  - "Add tag" / "Remove tag".
  - "Move to list" (si listes implémentées).
- **Bar d'actions contextuelle :** apparaît en haut du tableau quand `selectedRows.size > 0`, replace la PageHeader.

### 1.4 Semantic search UX
- **Exigences :**
  - Input search dédié avec icône magnifying glass.
  - Loading state inside input pendant search.
  - Badge **"N semantic matches for: '{query}'"** au-dessus du tableau quand results présents.
  - Chaque ligne filtrée affiche **score de similarité** (petit badge 0-100% à côté du nom).
  - Bouton "Clear search" (X) restaure le listing complet.
  - Si 0 matches → Empty state dédié "No accounts match '{query}' semantically. Try different terms or use [filters](#)."
  - **Debounce 500ms** (actuel : Enter-only, pas de debounce).
- Différenciant Elevay : semantic search natif pgvector → doit se voir.

### 1.5 "Connected to" column (Monaco parité)
- Monaco a une colonne "Connected to" avec noms de personnes (Sam Blond, Malay Desai, Tommy Hung) = investors / advisors / network partagé.
- **Exigence :** nouvelle colonne "Warm path" qui affiche si ton réseau a une intro vers ce compte.
- Implémentation : cross-référence avec `contacts` dans ton tenant où `company_id = account.id`, aussi "common investors" si data Apollo dispo.
- Click sur un nom → panel avec détails de la relation (ex: "Sarah a envoyé 3 emails à Acme en 2024").

### 1.6 Score badges (Monaco parité)
- Monaco utilise un **grade A/B/C/D/F** avec emoji/icon ("🔥 Burning") → visuel fort.
- Elevay : `score` numeric 0-100 + `score_grade` (existe déjà probablement).
- **Exigence :** remplacer le badge numeric par grade letter + flamme si "Burning" (score ≥ 85 ET signals actifs) / "Hot" (70-85) / "Warm" (50-70) / "Cold" (<50).
- Tooltip au hover : "Fit 87/100 · Engagement 42/100 · 2 signals".

### 1.7 Status column (Monaco parité)
- Monaco a une colonne "Status" avec badges "New" / "Prospecting".
- **Exigence :** status lifecycle par account : `new` / `researching` / `prospecting` / `engaged` / `qualified` / `opportunity` / `closed-won` / `closed-lost` / `archived`.
- Auto-derived si activity data : `new` par défaut, `prospecting` si 1+ email envoyé, `engaged` si 1+ réponse, `qualified` si meeting done, `opportunity` si deal créé.
- User peut override manuellement.

### 1.8 IntelligenceBrief → action-driven
- **Exigence :** `suggestedAction` devient un CTA cliquable :
  - "Email [CEO name]" → ouvre EmailComposer prefilled.
  - "Book 15-min intro call" → génère meeting request template + link Calendly.
  - "Research competitor mention" → lance nouvelle recherche web.
- **Regenerate button :** "Refresh intelligence" → invalide cache serveur + re-fetch.
- **Sections additionnelles :**
  - "Key people" (contacts de l'account avec leur rôle)
  - "Recent activity" (emails + meetings derniers 30j)
  - "Signals" (derniers signaux détectés)
  - "Similar accounts" (cosine similarity pgvector, top 5)

### 1.9 Empty state / loading slide-over
- Si `a.lastInteraction`, `a.scoreReasons`, `a.description` missing → sections **cachées sans substitut**.
- **Exigence :** chaque section doit avoir son empty state :
  - No interactions → "No emails or meetings recorded yet. Connect your email to track interactions."
  - No score → "Not scored yet. [Score this account]" (1-click CTA).
  - No description → "Not enriched yet. [Enrich with Apollo]".

### 1.10 Table UX enrichments
- **Column customization :** user peut choisir quelles colonnes afficher (pattern Airtable/Notion) via "Display" dropdown top-right. Preset stocké en DB.
- **Column reordering :** drag-drop headers.
- **Column resizing :** drag handle entre colonnes.
- **Sort on column click** ✅ (à vérifier — actuel sort probablement via URL/filter).
- **Pinned columns :** "Account" (name) sticky left, "Actions" sticky right.
- **Row density toggle :** compact / default / comfortable (Airtable pattern).
- **Freeze row 1** (header).

### 1.11 Filter builder
- Actuel : 3 tabs simples (`all` / `tam` / `manual`).
- **Exigence :** filter builder Airtable-like :
  - "Industry is [Artificial Intelligence, FinTech]"
  - "Score >= 70"
  - "Last interaction within last 30 days"
  - "Has >= 2 signals"
  - "Size is 50-200"
  - Filters combinables (AND/OR).
  - Save filter as "View" (e.g., "Hot leads", "Stalled accounts").
- Query builder persisté en URL + backend pour sharing.

### 1.12 Create account UX
- Actuel : modal name + domain.
- **Exigences :**
  - Pre-check domain via Apollo avant submit → show preview "We found: Acme Corp · SaaS · 50-200 employees · [Create & enrich]".
  - Reject duplicate domain → "This domain exists as [Acme Corp] — [View] / [Merge]".
  - Option "Create without enrichment" pour accounts privés sans data publique.

### 1.13 "Suggested" badge fix (bug)
- Actuel : badge sur TOUS les contacts expanded (ligne 798).
- **Exigence :** n'afficher "Suggested" que si `contact.source === "apollo_auto"` ou `properties.suggestedBy === "apollo"`.

### 1.14 Clearbit favicon fallback
- Actuel : `https://logo.clearbit.com/{domain}`, `onError hide`.
- **Exigences :**
  - Fallback local : si Clearbit 404 → afficher initiales de l'entreprise dans un cercle colorié (color derived du hash du domain).
  - Respect privacy : si tenant opt-out of external services, utiliser uniquement initiales.
  - Cache navigateur : header `Cache-Control` sur les URL Clearbit (via proxy `/api/favicon?domain=xxx`).

### 1.15 Custom fields
- `customBoolColumns` hardcoded → supprimer. Tout doit passer par `useCustomFields("company")`.
- **Migration :** si ces legacy columns ont des data en prod, migrer vers custom_fields table proprement.

### 1.16 Comparaison avec Lightfield "Display" button
- Lightfield a un bouton "Display" top-right qui ouvre un panel de customization (colonnes visibles, density).
- **Exigence :** adopter ce pattern (§1.10).

### 1.17 Comparaison avec Lightfield "Filter" button
- Lightfield a un "Filter" button dédié, pas juste des tabs.
- **Exigence :** remplacer les 3 tabs par : (a) "All" / "TAM" / "Manual" quick filters + (b) "Filter" button qui ouvre le builder (§1.11).

### 1.18 Import/Export (Lightfield parité)
- Lightfield a "Import / Export" top-right.
- **Exigence :** bouton "Import" → modal CSV mapping (comme contacts SmartImport). "Export" → CSV / Excel des accounts filtrés.

### 1.19 Sidebar/panel accounts detail
- Lightfield "account-detail-meridian.png" montre un panel à droite avec :
  - Header "Meridian Labs" + logo
  - "Account summary" AI-generated (avec "Created by Sarah from [CTO at @...]")
  - "Industry" chips "Artificial Intelligence" "FinTech"
  - "Revenue" "Less than $1M"
  - "Opportunities" section
- **Exigence :** le slide-over Elevay doit afficher des sections équivalentes :
  - AI summary (1 paragraphe) ✅ via IntelligenceBrief
  - Industry chips ✅
  - Revenue / Size / Location fields
  - **Opportunities** section avec deals liés (lien vers `/opportunities/[id]`)
  - **Contacts** section (top 5 par recent interaction)
  - **Recent activity** (timeline emails + meetings)
  - **Properties** custom fields editable inline

### 1.20 Analytics PostHog
- `accounts_viewed` (filter, sort, count)
- `account_enrich_clicked` (single | bulk, count)
- `account_score_clicked` (single | bulk)
- `account_signals_clicked`
- `account_semantic_search` (query, results_count)
- `account_created` (source = manual | import | bulk)
- `account_expanded_contacts` (account_id, contacts_loaded_count)
- `account_intelligence_viewed` (account_id, cache_hit)
- `account_suggested_action_clicked` (action_type)
- `account_exported` (filter, count)
- `account_filter_saved` (filter_definition)

### 1.21 A11y
- Table : `role="table"`, `<caption>`, `<th scope="col">`.
- Sortable columns : `aria-sort="ascending|descending|none"`.
- Expandable rows : `aria-expanded` sur la ligne + `aria-controls`.
- Slide-over : focus trap, escape to close, `aria-labelledby` header.
- Bulk action bar : annoncé via `aria-live="polite"` quand selection change.

### 1.22 Keyboard
- `↑ / ↓` : navigate rows
- `Space` : toggle selection row focused
- `Enter` : expand row
- `Cmd+A` : select all visible
- `E` : enrich selected
- `S` : score selected
- `Delete` : delete selected (avec confirm)
- `/` : focus search
- `F` : open filter builder

### 1.23 Responsive
- Tablette : table scrollable horizontal, pinned first column.
- Mobile : cards verticales (une ligne par account) ou table minimale (Account + Score + Actions only).

---

## 2. Comparaison concurrents

### 2.1 Monaco (`1-build-tam.png`)
**Forces :**
- Table très dense (10 colonnes visibles) → info density élevée.
- Colonnes différenciantes : **Connected to** (réseau), **Common Investor?**, **Sales-led growth?** — data-rich filtering pour VC/startups ecosystem.
- Score grade A/B/C/D/F + "🔥 Burning" tag visuel fort.
- Status badges "New" / "Prospecting" colorés.
- Industries avec tag chips multi-valeur.
- **Tout l'écran dédié au listing**, pas de chrome superflu.

**Faiblesses :**
- Dark theme = peut fatiguer les yeux sur long sessions.
- Pas de panel detail visible dans cette capture (probablement click → page dédiée).

**Ce qu'on copie :**
- Grade letter + hotness emoji ("🔥 Burning").
- Status column.
- Connected to / Warm path column.
- Density maximale.

**Ce qu'on ne copie pas :**
- "Common Investor?" spécifique à l'écosystème YC/VC. Elevay cible plus large → laisser en custom field optionnel.

### 2.2 Lightfield (`accounts-with-data.png`)
**Forces :**
- Table aérée, 4 colonnes visibles (Account / Industry / Last interaction / Revenue).
- Sidebar navigation claire (Records/Resources/Lists/Chats).
- Top actions bar : Filter / Display / + Create + Import/Export → workflow clair.
- Footer "5 count" + "Add operation" (comme Airtable) pour totals.

**Faiblesses :**
- Moins de densité info que Monaco.
- Pas de score / signals visible.

**Ce qu'on copie :**
- Filter + Display buttons pattern.
- Import/Export top-right.
- Footer count + operations (sum/avg/…).

### 2.3 Lightfield account detail (`account-detail-meridian.png`)
**Forces :**
- Panel slide-over propre avec AI summary.
- Attribution "Created by Sarah from [CTO at @...]" = **provenance** claire (qui/quoi a créé l'account).
- Chips colorées pour industries.
- Sections Revenue / Opportunities visibles.

**Ce qu'on copie :**
- Provenance "Created by X from [source]".
- Sections Opportunities / Contacts / Activity séparées.

### 2.4 Gap synthèse
| Dimension | Elevay | Monaco | Lightfield | Gap |
|---|---|---|---|---|
| Server-side pagination | ❌ client loop | ✅ (inféré) | ✅ | **CRITIQUE** |
| Bulk cap > 20 | ❌ silencieux | ✅ (inféré) | N/A | **CRITIQUE** |
| Selection multiple actionable | ❌ mort | ✅ | ✅ | **CRITIQUE** |
| Semantic search feedback | ❌ | N/A | ❌ | **HAUTE** + Elevay advantage |
| Grade + hotness emoji | ⚠️ grade existe, emoji no | ✅ | ❌ | HAUTE |
| Status lifecycle | ❌ | ✅ | ❌ | HAUTE |
| Connected to / warm path | ❌ | ✅ | ❌ | HAUTE |
| Column customization | ❌ | ? | ✅ | HAUTE |
| Filter builder | ⚠️ 3 tabs | ? | ✅ | HAUTE |
| Row-level actions | ⚠️ seulement expand | ? | ? | HAUTE |
| Import/Export | ⚠️ import OK (contacts only?), export ? | ? | ✅ | MOYENNE |
| Provenance "Created by X from Y" | ❌ | ? | ✅ | MOYENNE |
| Footer count + operations | ❌ | ? | ✅ | MOYENNE |
| Suggested badge correct | ❌ BUG | N/A | N/A | BASSE |

---

## 3. Gaps priorisés

| # | Gap | Criticité | Effort (h) | Bloquant pour ? |
|---|---|---|---|---|
| A1 | Server-side pagination + virtualisation | **CRITIQUE** | 8 | Perf >1k accounts |
| A2 | Bulk actions : queue Inngest ou warn cap 20 | **CRITIQUE** | 6 | Bug produit majeur |
| A3 | `selectedRows` : brancher 6 actions (score/enrich/delete/export/assign/tag) | **CRITIQUE** | 6 | UX productivity |
| A4 | Semantic search feedback (badge + score + debounce) | HAUTE | 3 | Différenciation produit |
| A5 | Grade A/B/C/D/F + emoji hotness | HAUTE | 2 | Visuel fort + parité Monaco |
| A6 | Status column lifecycle | HAUTE | 4 | Workflow clarity |
| A7 | "Warm path" column (connections) | HAUTE | 6 | Différenciation |
| A8 | Column customization (Display panel) | HAUTE | 5 | Parity Lightfield/Airtable |
| A9 | Filter builder (chain conditions + save views) | HAUTE | 10 | Pouvoir utilisateur |
| A10 | IntelligenceBrief : actionable suggested_action + regenerate | HAUTE | 4 | Value produit |
| A11 | Fix "Suggested" badge (condition contact.source) | HAUTE | 0.5 | Bug copy |
| A12 | Empty states sections IntelligenceBrief | HAUTE | 2 | UX clarity |
| A13 | Import/Export bouton top-right | MOYENNE | 4 | Parity Lightfield |
| A14 | Provenance "Created by X from Y" | MOYENNE | 3 | Trust UX |
| A15 | Create modal : domain preview + dedup check | MOYENNE | 3 | Qualité data |
| A16 | Slide-over : sections Opportunities / Contacts / Activity | MOYENNE | 6 | Info richness |
| A17 | Favicon fallback initiales colorées | MOYENNE | 2 | Privacy + resilience |
| A18 | Supprimer customBoolColumns hardcoded | MOYENNE | 2 | Dette tech |
| A19 | Keyboard shortcuts (↑↓ E S Del / F Space) | MOYENNE | 4 | Power users |
| A20 | Responsive mobile/tablet | MOYENNE | 6 | Mobile users |
| A21 | Row density toggle (compact/default/comfortable) | BASSE | 2 | Polish |
| A22 | Footer count + sum/avg operations | BASSE | 3 | Parity Lightfield |
| A23 | Column reorder / resize / pin | BASSE | 6 | Power users |
| A24 | Analytics PostHog accounts (11 events) | BASSE | 3 | Optim |

**Total effort v1 (A1-A12) :** ~56h
**Total effort v2 (A13-A24) :** ~38h

---

## 4. Décisions à prendre

1. **Bulk queue : Inngest OR serveur cap + warn ?** — Inngest (queue propre, progress UI possible).
2. **Status lifecycle : auto-derived ou toujours manuel ?** — Hybrid : auto par défaut, override manuel possible.
3. **"Warm path" scope :** tenant contacts only OR inclure investors Apollo ? — Apollo investors en v2 (data-heavy).
4. **Filter builder persisté :** URL only OU backend "saved views" ? — Backend (sharing, reuse).
5. **Column customization : user-scoped OR tenant-scoped ?** — User-scoped (préférence perso).
6. **Favicon fallback : initiales OR emojis d'industrie (🏢, 🤖) ?** — Initiales (plus pro).
7. **Row actions : menu 3 dots OU hover icons ?** — Hover icons par défaut, 3 dots pour actions supplémentaires.

---

## 5. Prochaines actions

1. Martin : répond aux 7 décisions §4.
2. Sprint critique : A1 + A2 + A3 + A11 (~20h) → perf + bug majeur + selection utile + bug copy.
3. Sprint haute valeur : A5 + A6 + A7 + A8 + A10 + A12 (~23h) → visuel + workflow + produit.
4. Sprint suivi : A4 + A9 + A13-A16 (~20h).
5. v2 : A17-A24.
