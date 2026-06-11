# Intervention prod — suppression des 2 profils ICP périmés + restauration des scores (2026-06-11)

**Demande de Martin** : les 2 profils actifs ne représentent plus l'ICP réel (étendu depuis — cf. `project_pilae-icp-precise`) ; le scoring ne doit pas se baser dessus ; les sociétés déjà dans Accounts restent.

## Ce qui a été fait (script one-off, transactionnel, backup préalable)

Tenant `47dca783` uniquement (le tenant dev `pilae` n'a pas été touché).

1. **Soft-delete** de `Scale-up Tech / SaaS B2B` (13ae029d) et `Finance suisse tech-native` (b87a1a6e) — `deleted_at` posé, criteria conservés → restaurables via l'Archive de la page ICP Profiles ou `/api/icps/restore`.
2. **4 310 cellules `company_icp_fit` supprimées** (hard, comme le fait DELETE /api/icps/[id]) — backupées avant.
3. **Aucune société supprimée.** Les 990 rows d'Accounts sont intactes ; 148 pointeurs `properties.primaryIcpId` orphelins nettoyés.
4. **Scores restaurés à l'échelle 0-100** depuis la provenance `properties.score_fit` : 753 sociétés re-scorées (le book registre romand — spread réel : 1 A+, 181 A, 246 B, 201 C, 124 D/F) ; 237 sans provenance (l'ancien book Apollo français, largement hors-ICP) passées à `NULL` = « Not scored » honnête, re-scorables plus tard.
5. **0 séquence liée** aux profils supprimés (vérifié avant) → aucun impact enrollment.

## État résultant et stabilité

- 0 ICP actif sur le tenant → le recompute quotidien (05:00 UTC) sort immédiatement (`activeIcps.length === 0`, `icp-fit-recompute.ts:49-51`) : **les scores restaurés ne seront pas réécrasés**.
- Le tri Accounts remet la vraie cible en tête (Alpian Bank 94, Banque Heritage 87, Fondation IPT 85, KeriMedical 85…).
- **Ne PAS recréer de profil ICP actif avant la Phase 0** de `_specs/icp-unification/` (fix d'échelle) : tout profil actif avec critères redéclencherait le recompute 0-1 et recasserait le book. Le profil reflétant l'ICP réel (Suisse romande, 100-1000 FTE, low-tech/fondations/santé/parapublic) sera créé à la mise en service de la page unifiée.

## Rollback

`_audit/_backup-2026-06-11-icp-deletion.json` (2,9 Mo, non commité) contient : les 2 icp ids, les 4 310 cellules complètes, et les 990 (id, score, primaryIcpId, score_fit) pré-intervention. Restauration : ré-insérer les cellules, re-poser les scores depuis le backup, `deleted_at = NULL` sur les 2 icps.
