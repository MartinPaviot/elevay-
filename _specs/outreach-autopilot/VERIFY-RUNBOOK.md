# /verify d'itération — outreach-autopilot itération 0

Étape restante : les Done VISUELS de T11 / T11b / T11c. Backend + structure déjà
vérifiés en CI. À exécuter dans une session avec env fonctionnel.

## Pré-requis env
- `cd app && pnpm install` (le store a été churné par des sessions parallèles le
  02/07 — `@playwright/test` corrompu ; une réinstall réseau répare).
- `pnpm dev` (app/) → web sur le port affiché.
- Login = le VRAI compte via credentials `.env.local` (Mail_Martin/Password_Martin —
  memory `feedback_login-as-martin-env`). PRUDENCE PROD : 0 envoi / 0 booking sans
  demande. Le tenant Elevay (fdf9b795) a ~0 outcomes résolus → attendre surtout des
  ZÉROS / états cold-start ; vérifier que les empty states se lisent bien.
- Screenshots séquentiels (001-...), before/after par surface.

## T11c — /sequences/review (revue de séquences)
Done tasks.md : « un draft bloqué affiche le gate fautif ET la raison ; chaque claim
affiche sa source ; un rejet exige une raison et la persiste ; bulk sur groupe homogène ».
1. Ouvrir un draft ayant des gate_decisions. Panneau « Quality gates » : chaque gate
   (Targeting/Factual/Copy quality/Deliverability) montre verdict (pastille couleur :
   pass=success, blocked=error, reworked=warning) + score % + LA RAISON sous un verdict
   non-pass (ex G2 « Unverifiable: ... », G4 issues, G5 « Content: ... »). [PR #652 + #654]
2. Panneau « Why this draft? » → « Sources cited » : chips (pas de dump JSON), chaque
   source = badge kind + label + lien cliquable si href + citation au survol. [PR #652]
3. Rejet-avec-raison (préexistant T6/CLE-14) : le modal exige une raison, persiste.
4. NON LIVRÉ (différé, à ne PAS vérifier comme Done) : SequenceTimeline, citations DATÉES,
   raccourcis a/e/x. Vérifier seulement que rien n'est cassé.

## T11 — /reports (résultats outcomes-first)
Done : « ordre M11-R1 ; open rate ABSENT ; taux de gates matchent gate_decisions ;
vue décisions n/lift ». [PR #656]
1. Strip outcomes-first EN HAUT (au-dessus des cartes forecast/cohorts) : RDV honorés
   (accent, le plus grand) → bookés → réponses+ → deals avancés → ENVOIS GRISÉS
   (caption « Volume », en bas). L'ordre = la hiérarchie.
2. Open-rate ABSENT de /reports (il vit sur /deliverability). Confirmer visuellement.
3. Section gates : une ligne PAR (gate, rubricVersion, path) — le G2 doit apparaître en
   DEUX lignes distinctes (sequence_step_v2 vs copy_engine) si les deux ont des rows,
   PAS un taux confondu. Barres inline. Ligne de lecture guidée par gate.
4. Vue décisions : table persona × signal avec n + lift. Cold-start si < données.

## T11b — /home (cockpit)
Done : « 3 zones rendent ; quota-atteint = jauge pleine VERTE + reprise demain + items
différés ; clavier ; aucun CLS ». [PR #657]
1. StatBar sous le header 44px : jauge cap (barre inline, accent sous plafond), santé
   délivrabilité (Healthy/Paused), RDV cette semaine. Skeleton footprint au load (PAS de CLS).
2. État quota-atteint : forcer sent>=cap (ou tenant au cap) → barre PLEINE VERTE +
   « resumes tomorrow » + « N deferred to tomorrow » (deferredCount).
3. État délivrabilité dégradée : guard tripped → token error « Paused ».
4. Zone « Prêt pour vous » : cartes drafts-à-revoir / réponses-à-classifier /
   actions-à-approuver + click-through (drafts→/sequences/review,
   replies→/inbox?split=to_classify, actions→/chat). Empty = « You're all caught up ».
5. Clavier j/k (surligne, scrollIntoView) + Enter (navigue) ; ne se déclenche PAS en
   saisie ; visible dans la cheatsheet '?'.
6. FLAG À TRANCHER (produit) : « actions à approuver » linke vers /chat car PAS de page
   d'approbations dédiée (AgentFeed monté nulle part). Confirmer /chat ou rediriger.

## Score /verify (0.0-1.0 sur 5 dimensions, PASS→rien / FAIL→respec)
Correctness · edge cases (empty/cold-start/quota) · regression (sections existantes
intactes) · design language (tokens, 44px, no emoji/em-dash) · data (les chiffres
matchent gate_decisions/outreach_decisions/action_outcomes).

## Flags produit à trancher (hors /verify)
- Cockpit « actions »→/chat (pas de page approbations).
- Invariant reply-subject sur chemins auto (reply-handler/reply-agent utilisent le
  sujet MODÈLE, pré-existant — scratchpad t6b-accepted-gaps.md).
- T11 amendement appliqué : taux G2 groupés par reasons.path (conflation évitée).
