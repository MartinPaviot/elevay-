# N1 — `/accounts` (Accounts list / TAM)

Live PROD, workspace "E2E Test Workspace" (= données réelles : **767 comptes** Suisse/France, Pilae). 2026-06-05.
Preuve : `screenshots/002-accounts-n1-populated.png` + snapshot `page-2026-06-05T16-43-46-596Z.yml`.

## Grille 7 états
- **populated** ✅ — 767 comptes, table large (18 colonnes : Account, Website, LinkedIn, Industry, Geography, Size, Revenue, Stage, Score, Last Interaction, Connected to, Investor, Funding, Hiring, YC, Common Investor?, Sales-led?, actions). Pagination 50/page.
- **loading** ⚠️ — 1er rendu = page blanche (skip-link + alert seuls) puis pop-in du contenu ~2s. Pas de skeleton visible. À reconfirmer (peut être SSR+hydratation). Probable lacune skeleton.
- **partial** ⚠️ — colonnes signaux affichent un état **"Computing…" (···) perpétuel** sur les comptes non-enrichis (ID Quantique, UEFA, Ville de Gland, Dubois Dépraz, Montreux Jazz) ; "—" ou valeurs sur les enrichis (Evooq, Prima…). À vérifier si "Computing" est réellement en cours ou **bloqué** (signal d'enrichissement jamais résolu).
- **error** ❓ — code statique = erreurs avalées en silence (aucun état error). Non déclenchable proprement en lecture.
- **empty** ❓ — non testable ici (767 comptes) → Phase A (fresh signup).
- **edge** ✅ — accents OK (Dubois Dépraz SA rendu correct), 767 lignes gérées via pagination.
- **exit-CTA** ⚠️ — voir coutures.

## Coutures (edges)
- **S3 Accounts → Account detail** : le nom de compte est un **`button`** (ex. `button "ID Quantique"`), **pas un `<link>` vers `/accounts/[id]`**. Confirme le finding statique → ouvre un slide-over in-page. **Test en cours** (clic). Si slide-over sans URL = pas de deep-link/partage/back natif → score ≤ 0.5.
- Website / LinkedIn = vrais liens externes (`https://…`, `linkedin.com/company/…`) ✅.
- Actions ligne : **Enrich**, **Delete**. Actions header : **Delete all** (placement risqué, en 1ère position), **Signals**, **Enrich (50)**, **Find more accounts**, **Create account**.
- Deux barres de recherche côte à côte : **Smart search** ("e.g. SaaS in France with high fit score") + **Semantic search** ("Search accounts…") → risque de confusion (deux paradigmes, intitulés proches).

## Gaps (→ gap-register)
- G-N1-1 [S1/seam] nom de compte = button→slide-over, pas de page/URL dédiée (deep-link, partage, back impossibles). sév S1.
- G-N1-2 [node/partial] colonnes signaux "Computing…" potentiellement bloquées sur comptes non-enrichis. sév S2 (à confirmer).
- G-N1-3 [node/loading] pas de skeleton — flash de page blanche. sév S3.
- G-N1-4 [node/UX] "Delete all" en tête de barre d'actions = risque destructif (767 comptes en 1 clic). sév S2.
- G-N1-5 [node/UX] double barre de recherche (Smart vs Semantic) sans hiérarchie claire. sév S3.
- G-N1-6 [node/error] échecs fetch avalés silencieusement (pas d'état error). sév S2.
