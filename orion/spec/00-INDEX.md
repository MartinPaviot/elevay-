# Orion — INDEX (ordre de lecture & d'exécution)

> Le dossier `spec/` se liste par ordre alphabétique ; cet index donne l'**ordre logique**.
> Les noms de fichiers ne sont volontairement PAS numérotés : ~120 références croisées (prompts,
> packs, docs) pointent vers les noms exacts — les renommer casserait le build. Cet index est la
> carte ; les noms restent stables.

## Par où commencer (selon ton intention)
- **Je veux LANCER le build** → ouvre `PROMPTS.md` et colle l'ÉTAPE 1 (SETUP). Tout s'enchaîne.
- **Je veux COMPRENDRE l'architecture** → lis la section 1 ci-dessous dans l'ordre.
- **Je veux les MÉCANISMES de setup (env, DB, clés)** → `SETUP-RUNBOOK.md` (il fait foi).

---

## 1. Orientation — à lire d'abord, dans cet ordre
| # | Fichier | Rôle |
|---|---|---|
| 1 | `00-ARCHITECTURE.md` | Décisions fondatrices (D1-D8), carte des couches, invariants (tenant elevay, RLS, copie-pas-import) |
| 2 | `00-EXECUTION-GUIDE.md` | Découpage en 8 lots, ownership de fichiers disjoint, ordre des vagues |
| 3 | `00-PREREQUISITES.md` | Dépendances dures (taxonomy, hookpoints, MCP) + prérequis opérateur |
| 4 | `CLAUDE.md` | Charte de comportement de l'agent (voix Garry Tan) — **copiée à la racine du repo** par le SETUP |

## 2. Setup opérateur — AVANT de coller le moindre prompt
| # | Fichier | Rôle |
|---|---|---|
| 5 | `SETUP-RUNBOOK.md` | **LE runbook** : `.env.local`, rôles DB (`elevay_app`/owner), tenant `elevay`, clé `mcp_*` bcrypt, migrations. Tranche sur les mécanismes vérifiés. |
| 6 | `AUTONOMY-SETUP.md` | Posture autonomie : `.claude/settings.json`, hooks (secret-scan, tsc), les 4 causes de non-autonomie |
| 7 | `MCP-AND-PERMISSIONS.md` | `.mcp.json` (context7+playwright) + `settings.local.json` (lecture seule) + connecteurs claude.ai |
| 8 | `CONFIG-TOOLING.md` | `playwright.config` + fixture auth e2e + vitest + CI |

## 3. Prompts à coller — l'exécution
| # | Fichier | Rôle |
|---|---|---|
| 9 | `PROMPTS.md` | **Tous les prompts dans l'ordre** (SETUP → Vague 0 → Vague 1 ×5 → Vague 2) + commandes worktree. **Copie-colle depuis ici.** |
| 10 | `PROMPT-00-SETUP.md` | Le prompt SETUP seul (aussi inclus dans `PROMPTS.md`) |
| 11 | `LAUNCH-KIT.md` | Prompts de build d'origine + conventions git pro (source des Vagues 0/1/2) |

## 4. Spec Kiro — le quoi / comment construire
| # | Fichier | Rôle |
|---|---|---|
| 12 | `requirements.md` | 31 exigences EARS (GIVEN/WHEN/THEN + edge cases) |
| 13 | `design.md` | 11 sections d'architecture (schéma Drizzle, adaptateurs, versions exactes) |
| 14 | `tasks.md` | 42 tâches ordonnées (verify + test par tâche) |

## 5. Lots de build — un brief auto-suffisant par session (`packages/`)
Ordre imposé : **pack0 → pack1 → (pack2, pack3, pack4, pack5, pack6 en parallèle) → pack7**.
| Lot | Fichier | Vague |
|---|---|---|
| pack0 | `packages/pack0-foundation.md` | 0 |
| pack1 | `packages/pack1-schema.md` (contrats partagés) | 0 |
| pack2 | `packages/pack2-ingestion.md` (ingestion + offline-discovery = le wedge) | 1 |
| pack3 | `packages/pack3-brief-mcp.md` | 1 |
| pack4 | `packages/pack4-output-gates.md` | 1 |
| pack5 | `packages/pack5-tier2-signals.md` | 1 |
| pack6 | `packages/pack6-ui.md` | 1 |
| pack7 | `packages/pack7-demo-integration.md` (seed + démo) | 2 |

## 6. Produit & démo
| # | Fichier | Rôle |
|---|---|---|
| 15 | `demo-hero-FROZEN.md` | Le hero de démo **figé** (signal `leadership_change.vp_eng`, lift 4,2×/3,5×, reveal confounder) |
| 16 | `demo-hero-offers.md` | Les 2 candidates + le seed détaillé (vecteurs datés) |
| 17 | `ui-spec.md` | Design language Elevay (tokens, accent `#2C6BED`, no-emoji, demi-écran) |

## 7. research/ — le pourquoi (rapports d'analyse, 11)
Ordre de lecture conseillé : voir `../README.md`. Ce sont les preuves derrière les décisions.

---

## Ordre d'EXÉCUTION (résumé en une ligne)
**SETUP (1 session)** → **Vague 0 : pack0 → pack1 (1 session)** → **Vague 1 : pack2/3/4/5/6 (5 sessions en parallèle, 1 worktree chacune)** → **Vague 2 : pack7 (1 session)**.
Pic de parallélisme = **5**. Détail + prompts = `PROMPTS.md`.
