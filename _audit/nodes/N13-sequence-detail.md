# N13 — `/sequences/[id]` (Campaign / Sequence detail)

Live PROD, "Updated Sequence" (active, 6618fece-…). Preuve : `screenshots/012-sequence-detail-N13.png`.
Seul objet d'engagement peuplé du workspace → précieux pour tester les coutures sur données réelles.

## Structure
- Header : "Updated Sequence — To Test Contact (test@bugtest.com)", badge **active**, actions **Pause** / **Export**.
- Tabs : **Steps** / **Analytics**.
- SEQUENCE (1 STEP · 1 DAYS) : Step 1 "Hello {{firstName}}" (chevron → détail step).
- ENROLLED (1) : table Contact | Email | Step | Status | Actions → "Test Contact" | test@bugtest.com | 1/1 | active | Pause/Stop.

## Coutures (testées LIVE)
- **S12a enrolled → contact** = **cul-de-sac (0.0)**, confirmé : `contactDetailLinks: []`, la cellule "Test Contact" est un `<td>` texte brut non lié. Impossible de cliquer du contact enrôlé vers sa fiche.
- **S12b enrollment → inbox thread** = absent : aucun lien contextuel ; seul `/inbox` (nav globale) existe. Pas de "voir les réponses de cet enrôlé".

## Autres findings
- **Data inconsistency** : séquence "1 contacts" (Test Contact) mais `/contacts` = 0 → le contact enrôlé n'apparaît pas dans la liste contacts (orphelin / masqué / filtré). Le compteur ou la liste est faux.
- **Terminologie** : nav "Campaigns" / route `/sequences` / objet "Sequence" → drift de vocabulaire (3 mots pour 1 concept).

## Gaps
- G-N13-1 [S0/seam] enrolled→contact cul-de-sac (live, `td` brut).
- G-N13-2 [S1/seam] enrollment→inbox thread inexistant.
- G-N13-3 [data] contact enrôlé absent de /contacts (count vs liste incohérents).
- G-N13-4 [polish] Campaign/Sequence — vocabulaire incohérent.
