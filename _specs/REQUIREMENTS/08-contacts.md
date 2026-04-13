# Étape 8 — Contacts + SmartImport — Exigences pixel-level

**Date :** 2026-04-13
**Scope :** `app/apps/web/src/app/(dashboard)/contacts/page.tsx` + `/contacts/[id]/page.tsx` + SmartImport (composant inspecté dans audit-03b) + endpoints `/api/contacts`, `/api/import`, `/api/enrich-contacts`.
**Méthode :** référence audit-deep `03b-contacts.md` + captures Lightfield `contacts-table.png`, `import-csv-header.png`, `import-csv-mapping.png`, `import-csv-review.png`.

---

## 0. État actuel — rappel compressé

Voir audit-03b pour détail. Points clés :
- Contacts table : name, title, company, email, phone, LinkedIn, score + reasons, last interaction, custom fields.
- Create : form first/last/email/title/company/phone/LinkedIn.
- SmartImport : CSV/Excel, AI mapping auto, dédup, import history.
- Enrich single / all via Apollo.

### 0.1 Bugs/gaps connus audit-03b
- Pagination absente/à vérifier.
- Pas de merge dupes UI visible.
- Pas de batch edit.
- SmartImport wizard : multi-step, upload → parsing → AI mapping → review → import. Généralement bon.

---

## 1. Exigences pixel-level

### 1.1 Table contacts — parité avec accounts
Même exigences structurelles que §Étape 7 Accounts :
- **Server-side pagination + virtualisation** (K1).
- **Selection multiple actionable** (K2) : score/enrich/delete/export/assign/tag selected.
- **Column customization** (K3) : Display panel.
- **Filter builder** (K4) : multi-condition AND/OR, save views.
- **Keyboard shortcuts** (K5) : ↑↓ navigate, Space select, E enrich, Del delete, / search.
- **Row density toggle** (K6).
- **Footer count + operations** (K7) : "5 count" + Add operation (sum/avg/min/max).

### 1.2 Colonnes requises
Lightfield table affiche : Name, Account, Last interaction, Job title, Email. Minimum nécessaire.

**Exigence Elevay plus riche :**
- Name (avec avatar initiales ou photo si dispo)
- Job title
- Account (avec logo company clickable)
- Email (avec icon copy-on-hover)
- Last interaction (relative time "3 days ago")
- Score (grade A/B/C/D/F + hotness emoji)
- Priority (derived badge)
- Tags (custom)
- Phone, LinkedIn (optional columns)

### 1.3 Empty state & fresh tenant
- Si 0 contacts → CTA double :
  - "Import a CSV" (→ SmartImport)
  - "Find contacts for my top accounts" (→ triggers Apollo pour top 20 accounts)
- **Exigence onboarding** : si user post-onboarding sans contacts → bannière "Your contacts appear here. [Build TAM first](/onboarding)" ou "[Import CSV](#)".

### 1.4 Contact detail panel
Similaire au slide-over accounts :
- Header : photo + name + title + company (clickable)
- AI intelligence : qui, pourquoi prioriser, talking points, suggested subject lines
- **Sections :**
  - Deals (opportunities where `contact_id IN (...)`)
  - Recent activity (emails + meetings + notes timeline)
  - Related people (at same company)
  - Scoring breakdown (fit + engagement)
  - Signals detected
- **Actions inline :**
  - "Email this contact" (EmailComposer)
  - "Add to sequence" (select sequence dropdown)
  - "Create task" (deadline picker)
  - "Log call" / "Log meeting"
  - "Mark as 'Not a fit'" (move to archive)

### 1.5 Edit inline
- Click sur un field (title, email, phone) → editable inline avec save on blur.
- Undo toast 5s ("Changed title. Undo.").
- Validation runtime Zod.

### 1.6 SmartImport wizard — parité Lightfield

**Flow Lightfield identifié (4 captures) :**

1. **Upload** : drag-drop CSV/Excel (non montré mais implicite).
2. **Header row detection** (`import-csv-header.png`) : "Sélectionnez la ligne d'en-tête" — user confirme quelle ligne est le header. Default = row 1, mais certains CSV ont des metadata au-dessus.
3. **Column mapping** (`import-csv-mapping.png`) : "Mapper les colonnes" avec CTA "Proposer automatiquement des mappings" (AI auto-mapping). 3 colonnes : **UPLOAD COLUMNS** / **DONNÉES D'ÉCHANTILLON** / **LIGHTFIELD COLUMNS**. AI guesses + user override.
4. **Review** (`import-csv-review.png`) : "Passer en revue et finaliser" — table avec lignes highlighted pink pour dupes/invalid. "Tips on finalizing your data" side panel + "Tous les problèmes" tab. CTA "Importer".

**Elevay SmartImport existant audit-03b** : similaire (upload → AI mapping → review).

**Gaps à combler :**
- **Header row picker explicite** : si user uploade un CSV avec metadata (notes, sous-titres) avant le vrai header → le wizard doit permettre de skip.
- **Preview data per column** (DONNÉES D'ÉCHANTILLON) : montre 2-3 exemples de values par colonne pendant mapping → user comprend mieux ce qu'il mappe.
- **Error highlighting par ligne** : dupes en pink avec raison ("Existing contact"), invalid email en rouge, phone mal formaté en orange.
- **"Tous les problèmes" tab** : filter pour voir seulement les lignes problématiques.
- **Fix inline pendant review** : user peut éditer directement dans la table review.
- **Skip / Merge / Overwrite** decision par duplicate row.
- **Preview count final** : "Importing 47 new contacts · 3 duplicates will be skipped · 2 rows have errors".

### 1.7 SmartImport AI mapping
- Actuel : AI mapping auto via LLM. ✅ déjà bien.
- **Exigences additionnelles :**
  - Confidence score par mapping (high/med/low) → low highlighted pour manual review.
  - "Corrections feedback loop" : quand user override un mapping, logger dans `tenants.settings.importCorrections` pour fine-tune le prompt.
  - Support **multi-header CSVs** (Excel merged cells) : détecter et aplatir.
  - Support **nested JSON/Excel** : parser les colonnes imbriquées.
  - Support **types dynamiques** : si colonne "LinkedIn" contient des URLs vs usernames → détecter et normaliser.

### 1.8 Merge duplicates — UI manquant
- Audit-03b flagge ce gap.
- **Exigences :**
  - Page `/contacts/duplicates` listant les paires détectées (match par email exact + fuzzy name + company).
  - Pour chaque paire : side-by-side view + "Merge" button.
  - Merge logic : preserve toutes les activities, combine custom fields, keep most recent timestamps.
  - Batch merge si > 10 pairs.

### 1.9 Enrichment UX
- Same que accounts : bulk via Inngest queue si >20.
- Feedback visuel pendant enrichment (status badge sur la ligne : "Enriching…").
- Indication des fields enriched récemment (edit indicator).

### 1.10 Contact-to-account matching
- Quand on crée un contact avec email `sarah@acme.com` :
  - Auto-match account par domain `acme.com`.
  - Si no match → propose "Create account for Acme" inline.
  - Si ambiguous (multiple accounts same domain) → show picker.

### 1.11 Add to sequence / task inline
- Bulk action bar → "Add N contacts to sequence" → modal pick sequence.
- Bulk "Create tasks for N contacts" → unified task generator (ex: "Email each within 3 days").

### 1.12 Import history & re-import
- Endpoint `/api/import/history` existe (audit-03b).
- **Exigence :** page `/contacts/imports` listant les imports précédents avec :
  - Date, source filename
  - Stats (created / skipped / companies created / errors)
  - "Download original CSV" (si stocké — sinon supprimer la colonne)
  - "Re-import" → re-run l'import avec mêmes mappings.
  - "Rollback" → undo l'import (delete les contacts créés par cet import). Attention : destructive, confirm avec typed "DELETE".

### 1.13 LinkedIn enrichment (v2)
- Actuel : LinkedIn URL champ libre.
- **Exigence v2 :** si LinkedIn URL présente, scraper (manuel user-triggered ou via Phantombuster API) → enrich job title, current company, recent posts (signals).

### 1.14 Custom fields (parité accounts)
- Same patterns : `useCustomFields("contact")` (déjà existant probablement).
- Pas de hardcoded columns.

### 1.15 Analytics PostHog
- `contacts_viewed` (filter, sort, count)
- `contact_created` (source = manual | import | bulk | auto)
- `contact_enriched` (single | bulk)
- `contact_deleted` / `contact_merged`
- `contact_added_to_sequence`
- `import_started` (source_type, file_size, row_count)
- `import_header_row_selected` (row_index)
- `import_mapping_auto` (confidence_avg)
- `import_mapping_overridden` (column_name, from, to)
- `import_completed` (created, skipped, errors)
- `duplicates_detected` (count)
- `duplicates_merged` (count)

### 1.16 A11y + keyboard (parité accounts)
Same que Étape 7 §1.21-1.22.

### 1.17 Responsive mobile
- Cards verticales stackées, swipe actions (left = archive, right = add to sequence).
- Detail = full-screen page, not slide-over.

---

## 2. Comparaison concurrents

### 2.1 Lightfield
**Forces table (contacts-table.png) :**
- Structure propre avec icons par colonne (person icon, building, clock, briefcase, mail).
- Support multilingual natif (Arabic, French examples visibles).
- "+ All" tab en haut pour toggle views.
- Footer "5 count" + "+ Add operation" par colonne (Airtable pattern).

**Forces import (4 captures) :**
- 4-step wizard clair : header → mapping → review → import.
- AI auto-mapping avec button "Proposer automatiquement".
- Problème tracking "Tous les problèmes" tab.
- Side tips panel pendant review.

**Ce qu'on copie :**
- Header row picker (gap Elevay actuel).
- "Tous les problèmes" filter tab.
- Side tips panel.
- Footer operations.

**Ce qu'on ne copie pas :**
- Minimalisme extrême (Elevay veut plus de columns par défaut).

### 2.2 Gap synthèse
| Dimension | Elevay | Lightfield | Gap |
|---|---|---|---|
| Server-side pagination | ⚠️ à vérifier | ✅ | **CRITIQUE** |
| Bulk actions selectedRows | ⚠️ à vérifier | ✅ | **CRITIQUE** |
| Merge duplicates UI | ❌ | ? | **CRITIQUE** |
| Header row picker import | ❌ probablement | ✅ | **HAUTE** |
| Error highlighting import review | ⚠️ partiel | ✅ | HAUTE |
| AI mapping confidence score | ❌ | ? | MOYENNE |
| Import rollback | ❌ | ? | MOYENNE |
| Filter builder | ⚠️ partial | ✅ | HAUTE |
| Column customization | ❌ | ✅ | HAUTE |
| Contact detail sections (opps, activity) | ⚠️ partial | ✅ | HAUTE |
| Edit inline | ❌ | ✅ | HAUTE |
| Contact-to-account auto-match | ⚠️ à vérifier | ✅ | MOYENNE |
| LinkedIn enrichment | ❌ (v2) | ❌ (probable) | BASSE |

---

## 3. Gaps priorisés

| # | Gap | Criticité | Effort (h) |
|---|---|---|---|
| K1 | Server-side pagination + virtualisation | **CRITIQUE** | 8 |
| K2 | Bulk actions selectedRows (6 actions) | **CRITIQUE** | 6 |
| K3 | Merge duplicates UI (page + batch) | **CRITIQUE** | 10 |
| K4 | SmartImport: header row picker | HAUTE | 3 |
| K5 | SmartImport: error highlighting ligne + "Tous les problèmes" filter | HAUTE | 4 |
| K6 | SmartImport: mapping confidence + override feedback loop | HAUTE | 4 |
| K7 | Contact detail: sections Opportunities/Activity/Related people | HAUTE | 6 |
| K8 | Edit inline fields (title, email, phone) + undo | HAUTE | 4 |
| K9 | Filter builder (like accounts A9) | HAUTE | 10 |
| K10 | Column customization (Display panel) | HAUTE | 5 |
| K11 | Grade + hotness emoji + score breakdown | HAUTE | 2 |
| K12 | Contact-to-account auto-match + inline create | HAUTE | 4 |
| K13 | Add to sequence / Create task bulk | HAUTE | 4 |
| K14 | Import history page + rollback | MOYENNE | 6 |
| K15 | Fresh-tenant empty state CTAs | MOYENNE | 2 |
| K16 | Keyboard shortcuts | MOYENNE | 4 |
| K17 | Row density + footer operations | MOYENNE | 3 |
| K18 | Mobile cards + swipe actions | MOYENNE | 6 |
| K19 | Analytics PostHog contacts (12 events) | MOYENNE | 3 |
| K20 | LinkedIn enrichment v2 | BASSE | 12 |

**Total v1 :** ~55h · **v2 :** ~28h

---

## 4. Décisions à prendre

1. **Duplicate detection threshold :** email exact OR fuzzy name+company ? → **les deux**, priorité exact.
2. **Import rollback TTL :** jusqu'à quand on peut rollback (24h, 7j, permanent) ? → **7j** (stocker import_id sur chaque contact, indexé).
3. **Merge "winning" policy :** most-recent OR manual pick par field ? → **Manual pick** avec "use most recent" default.
4. **Contact-to-account matching :** auto on create OR require explicit confirm ? → **Auto** si domain match unique, confirm si ambigu.
5. **Filter views scope :** user OR tenant ? → **User** (v1).
6. **Import rollback : confirmation typée "DELETE" ou juste click ?** → Typée (destructive).

---

## 5. Prochaines actions
1. Martin : décisions §4.
2. Sprint : K1+K2+K3 (24h) — perf + bulk + duplicates.
3. Sprint : K4+K5+K6 (11h) — SmartImport parity.
4. Sprint : K7+K8+K11+K12 (16h) — detail + inline.
5. Sprint : K9+K10+K13 (19h) — power users.
6. v2 : K14-K20.
