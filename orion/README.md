# Orion — corpus de conception & de build

Dossier consolidé. Tout ce qui concerne **Orion** (le produit signal → brief → outbound sorti
d'Elevay) est ici. Orion est un **repo séparé** (`@orion/web`) qui **copie** les modules clés
d'Elevay et partage la **DB `leads`** scopée au tenant `elevay`.

- `spec/` — spec produit/backend (Kiro), setup opérateur, prompts de build, design UI, charte agent.
- `research/` — les 11 rapports d'analyse (les preuves derrière les décisions). Copies ; originaux
  dans `_reports/`.
- `brand/` — logo Orion (O-constellation, accent `#2C6BED`), icônes + lockups clair/sombre.

## Ordre des documents → `spec/00-INDEX.md`
**L'index `spec/00-INDEX.md` est la carte de lecture et d'exécution.** Les fichiers ne sont pas
numérotés (≈120 références croisées par nom exact ; renommer casserait le build) — l'index impose
l'ordre logique sans toucher aux noms.

## Pour démarrer le build
Ouvre **`spec/PROMPTS.md`** : tous les prompts dans l'ordre (SETUP → Vague 0 → Vague 1 ×5 → Vague 2)
+ les commandes worktree. Premier geste = coller l'ÉTAPE 1 (SETUP) dans une session Claude Code à la
racine du repo Orion vide.

Séquence : **1 SETUP → 1 Vague 0 (pack0→pack1) → 5 Vague 1 (pack2-6 en parallèle, worktrees) →
1 Vague 2 (pack7)**. Pic de parallélisme = 5.

## research/ (ordre de lecture conseillé)
1. `signals-world-class-2026-06-27.md` — audit du système actuel + taxonomie legacy/hard-to-get + framework "expert conseil signaux" + architecture cible.
2. `signal-intelligence-design-2026-06-27.md` — sous-système produit-intégré : 3 piliers Découverte / Acquisition / Activation.
3. `signal-deep-tech-2026-06-27.md` — la couche technologique profonde (6 moteurs) + le moat.
4. `signaux-couche-technologique-profonde-2026-06-27.md` — approfondissement FR de la couche profonde.
5. `signal-agent-mcp-2026-06-27.md` — surface MCP agent-native (outils + resources + gates).
6. `signal-outreach-brief-2026-06-27.md` — **le pivot** : le produit n'écrit pas le mail, il émet un brief (`citableFacts[]`/`doNotClaim[]`).
7. `signal-agent-prd-2026-06-27.md` — PRD d'expert + parcours démo 2 min.
8. `orion-differentiation-2026-06-27.md` — pourquoi Orion > Fiber AI / Orange Slice / Lopus + data d'entrée (Tier 0/1/2).
9. `partner-apis-2026-06-27.md` — APIs partenaires vérifiées (Fiber = entrée ; Instantly/OrangeSlice/Lopus = sortie webhook).
10. `orion-backend-verification-2026-06-27.md` — backend Elevay réel : versions, câblage, env, pièges à porter.
11. `elevay-convex-migration-roi-2026-06-27.md` — ROI Convex vs Supabase (décision : on garde Supabase).

## Décisions fondatrices
Repo Orion **séparé**, **même stack** qu'Elevay (Next 15 / Drizzle / Postgres-Supabase / Inngest /
AI SDK v6 / next-auth v5) ; on **copie** (vendore) les ~6 modules clés (evaluateSend, IntelligenceBrief,
serveur MCP, waterfall, record-signal, identity). DB = **Supabase/Postgres + Drizzle partagée**,
scope tenant `elevay` (RLS `elevay_app`). Sortie vers **Instantly + Orange Slice + Lopus** (webhook) ;
**Fiber = entrée**. UI **identique à Elevay**. Détail dans `spec/00-INDEX.md`.
