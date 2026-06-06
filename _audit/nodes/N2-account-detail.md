# N2 — `/accounts/[id]` (Account detail)

Live PROD, compte ID Quantique (`f2a861bf-…`). 2026-06-05.
Preuve : `screenshots/004-account-detail-N2.png`.

## Grille 7 états
- **populated** ✅ (partiel) — Research Dossier riche (non-LLM) : Recommended approach (Best contact: **Unknown**, angle "General value proposition", opening line générique), Funding 76.3M / Merger&Acquisition, Tech Stack (23), Hiring signals (1 : "Using Salesforce — may be looking for alternatives"). Right rail "Account Details".
- **partial/degraded** ⚠️⚠️ — **LLM OFF** : "AI INTELLIGENCE — Not enough data yet", "ICP FIT 50% — Automated ICP fit scoring unavailable (LLM not configured)", "COMPETITIVE LANDSCAPE — No competitive analysis available (LLM unavailable)". → voir `CROSS-CUTTING.md` C1.
- **empty** (intel) ✅ message dégradé correct ("Connect your email or add activities").
- **error/loading/edge** ❓ non isolés ici.

## Coutures
- Breadcrumb **Accounts** (retour liste) ✅.
- **S5 Account → Brain** : bouton **"View brain"** présent (top-right) → testé en N3.
- **S4 Account → Contacts** : ❌ aucune section Contacts ; "Best contact: Unknown". Pas d'affordance "voir/ajouter contacts" sur ce compte. (compte froid sans contacts → à re-tester sur compte riche)
- **S15 Account → Deal/Opportunity** : aucune section deals visible (compte froid). À re-tester sur compte avec pipeline.
- Tech-stack chips (Salesforce, Slack…) = texte, non cliquables (pas de filtre "autres comptes avec Salesforce").

## Gaps
- G-N2-1 [S0/cross] LLM non configuré en prod → ICP fit / competitive / AI intelligence inertes. → CROSS-CUTTING C1.
- G-N2-2 [S1/seam] pas de section Contacts ni d'action "ajouter contact" depuis la fiche compte (S4 cassé).
- G-N2-3 [node] opening line générique identique au fallback ("Hi, I noticed X is in the … space") — sans LLM, l'ouverture n'est pas personnalisée.
