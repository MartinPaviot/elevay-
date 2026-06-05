# N3 — `/accounts/[id]/brain` (Account Brain)

Live PROD, ID Quantique. Preuve : `screenshots/005-account-brain-N3.png`.

## Concept
"Unified read of every artifact and derived signal we have on this account." Agrège 8 dimensions, toutes repliables avec compteur :
Contacts, Open deals, Recent activities, Meetings, Knowledge, Graph facts, Memories. + "Back to account".
→ Bon concept de hub 360°. C'est le seul endroit qui réunit Graph facts + Memories (context graph + agent memory) par compte.

## Grille 7 états
- **empty** ✅ — tout à 0 pour ce compte froid ("No contacts.", "No deals.", "No activities."). Messages propres.
- **populated** ❓ — non testable ici (compte froid). À re-tester sur compte riche (verra si les items linkent — statique dit "texte brut, pas de liens" → cul-de-sac probable).

## Findings
- G-N3-1 [node/valeur] Brain vide pour la majorité (767 comptes froids) → n'apporte de la valeur qu'aux rares comptes actifs. Le concept dépend d'activités/contacts/LLM, tous absents sur le froid.
- G-N3-2 [node/cohérence] **Score incohérent entre vues** : liste = "F Cold" ; fiche rail = "Score 1" ; brain = "Score 0.8". Trois représentations du même score.
- G-N3-3 [seam à confirmer] items du brain probablement non cliquables (statique) → vérifier sur compte riche (S4/S5/S14 depuis le brain).
