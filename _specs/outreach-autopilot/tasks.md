# Tasks — Outreach multi-canal autopilote (Phase 3)

Date : 2026-07-02 (rév. post-revue adversariale, même jour — cf. `review-resolution-2026-07-02.md`). Dépend de : requirements.md + design.md. Chaque tâche < 1 jour sauf mention, critère de done TESTABLE, dépendances explicites.
Ordre : **MVP vertical d'abord** (prompt maître : import TAM, séquence email IA, cap quotas, classification réponses, RDV, palier 1 du learning obligatoire dès le MVP). Import/séquenceur/classification/RDV EXISTENT déjà : le MVP est dominé par le câblage des P0 et par les surfaces UI qui portent la promesse produit.

Convention : une tâche = une branche `feat/oa-T<n>` (ou regroupement logique consécutif), code → test → verify → commit → PR CI → merge. Cocher ici à chaque merge.

## Itération 0 — MVP vertical (P0)

- [x] **T1 — Cap 100/j/tenant, invariant architectural** (1 j) — MERGÉ PR #615 (02/07), migration 0112 appliquée localdev + prod, CI main en cours.
  Dépend : —. Fait : constante compilée `OUTREACH_DAILY_TENANT_CAP=100` + table `tenant_send_counters` (migration) + incrément atomique conditionnel (`UPDATE … WHERE sent_count < cap RETURNING`) + `sendClass` dérivé CÔTÉ SERVEUR (workers : `inReplyTo` de leur propre row ; interactif : auto-classifié in-gate, claim `reply` re-vérifiée contre un email ENTRANT réel) + consommation en DERNIER dans `evaluateSend`, TOUS modes (ferme l'exemption external-connected, sending-identity.ts:115-124).
  Done testable : test unitaire — 100 incréments passent, le 101e est refusé ; 2 workers concurrents ne dépassent jamais 100 (UPDATE conditionnel) ; une claim `reply` sans email entrant consomme quand même ; mode external-connected refusé au cap ; un envoi bloqué en amont ne consomme pas. Vérif : drift-guard statique — aucun `process.env` ni clé tenant-settings ne référence le cap. (Implémentée : PR #615.)

- [x] **T2 — Comportement au cap : requeue + exposition** (0,5 j) — MERGÉ PR #616 (02/07 ; requeue livré dans #615, GET /api/outreach/cap + préfixe partagé).
  Dépend : T1. Fait : refus `cap_reached` → requeue lendemain sur les chemins cron (pattern #565) ; erreur explicite sur les chemins interactifs ; endpoint compteur pour le cockpit retournant {sent, cap, resetAt fuseau tenant} ET la liste des items différés (rows requeued `daily_cap_reached`).
  Done : test — un step refusé au cap est requeué (pas failed) et part le lendemain ; l'API expose compteur + items différés.

- [x] **T3 — G5 contenu au transport : QC spec-20 câblé pour de vrai** (1 j) — MERGÉ PR #618 (02/07 ; + gap M9-R2 fermé : le chemin SMTP envoyait l'outreach sans mécanisme de désinscription).
  Dépend : —. Fait : extension de signature `evaluateSend` (content optionnel : `{ bodyText, bodyHtml }` ; no-op si absent) + plomberie aux 5 chokepoints ; adaptation de `runQc` (option plainText désactivable ou passage sur bodyText ; `maxLinks` évalué PRÉ-footer car le transport APPEND le lien de désinscription) ; ÉCRITURE du check « mention désinscription présente » (n'existe pas dans runQc aujourd'hui). Fail-closed.
  Done : test — un corps avec spam-words est bloqué au transport avec raison ; un corps HTML légitime avec le futur footer désinscription passe ; un corps sans mécanisme de désinscription est bloqué ; latence ajoutée < 50 ms (déterministe).

- [x] **T4 — Pregate des envois manuels (G2+G5 minimum, INV-10)** (1 j) — MERGÉ PR #619 (02/07 ; G2 déterministe zéro-LLM + drift-guards ; e2e léger → passe /verify de fin d'itération).
  Dépend : T3. Fait : `POST /api/send/pregate` (G5 déterministe + G2 fabrication rapide sur les claims du corps) ; le composer l'appelle avant envoi ; refus = explication inline (quel fait est invérifiable).
  Done : test API — corps avec claim invérifiable → blocked + raison ; e2e léger : le composer affiche le refus. Latence p95 < 2,5 s.

- [x] **T5 — G1 bloquant à l'enrollment, tous chemins** (1,5 j) — MERGÉ PR #621 (02/07 ; loader = `loadG1Context` (eligibility-context.ts), 6 chokepoints câblés + drift-guard ; icpScoringActive via probe EXISTS pour ne pas briquer le tenant non scoré ; leçon : tout nouvel import drizzle dans un module traversé par un test à mock partiel doit rejoindre ce mock — 2 échecs CI avant le vert).
  Dépend : —. Fait : wrapper DB-aware `loadEligibilityContext` (charge score ICP + signaux frais) autour de la fonction pure `enrollment-eligibility.ts`, adopté aux 6 call-sites existants + point d'insertion dédié dans la sélection autopilot (`enroll.ts` ne traverse pas l'eligibility aujourd'hui) ; règle bloquante « score ICP ≥ seuil ET ≥ 1 signal frais » ; raison persistée.
  Done : test — un compte sans signal frais est refusé à l'enrollment MANUEL avec raison explicite ; l'autopilot n'enrôle jamais sous le seuil même avec budget disponible (INV-11) ; les 6 call-sites passent par le wrapper (drift-guard).

- [x] **T6 — Table gate_decisions + états de drafts étendus** (1,5 j) — MERGÉ PR #623 (02/07 ; migration 0113 appliquée localdev+prod (prod via DATABASE_URL_OWNER, elevay_app pas owner du type) ; seuil G4 = passThresholdFor existant 0.7/0.8, pas 0.75 ; writer best-effort fail-soft ; + 2 trous T5 fermés : chat autopilot sans G1 et approval executor sans re-check fraîcheur à l'approbation M2-R4).
  Dépend : T3, T5. Fait : migration `gate_decisions` ; écriture depuis G1 (T5), G2 (fabrication-gate existant), G4 (graders existants), G5 (T3) avec rubric_version ; extension de l'enum réel `sequence_drafts` (pending_approval/approved/rejected/expired/sent → + gates_running/blocked/reworking/set_aside : ALTER TYPE + mise à jour exhaustive de `canTransition` et de ses consommateurs — routes approve/reject/edit, bulk-approve, dispatch-decision, expiry cron).
  Done : test — chaque verdict de gate crée une ligne exploitable (gate, score, verdict, raison) ; une génération bloquée 2× passe en set_aside, jamais envoyée ; les transitions existantes restent vertes (régression canTransition).

- [x] **T6b — G2 (vérification factuelle) sur TOUS les chemins de génération** (1 j) — MERGÉ PR #628 (02/07 ; 7 seams : reply-handler ×2 + reply-agent (trou découvert : 7 classifications déléguées auto-envoyaient sans G2) + chat ×2 + copy-engine source + auto-send défaut/V2 (trou découvert : corps personalizeStepEmail non gaté ; fix = forceDraft sur enqueueOutbound, writer unique). + extraGroundTruth (whitelist évidences appelant, tue les faux blocages, ne flippe jamais briefHasFacts) + concat sujet/actionItems gatée. Gaps acceptés documentés dans la PR : recheck post-regen déterministe-seul (T11 doit grouper G2 par reasons.path), senderName influençable (suggestReply), flag invariant reply-subject (sujet modèle sur chemins auto, pré-existant — décision founder). le fabrication-gate (2 couches, aujourd'hui câblé au seul chemin sequence-generator) devient bloquant sur chaque chemin de génération : autopilot/prepare, drafts de réponse (reply-handler), chat/compose ; chaque verdict loggé dans gate_decisions.
  Done : test PAR CHEMIN — une claim invérifiable produite par autopilot/prepare, par un draft de réponse et par le chat est retirée ou bloque le draft, avec verdict loggé ; le chemin sequence-generator reste vert (régression).

- [x] **T7 — Decision-record : outreach_decisions à l'envoi (v1 partiel)** (1 j) — MERGÉ PR #631 (02/07 ; migration 0114 localdev+prod ; sendClass résolu remonte d'evaluateSend (additif) ; UNIQUE partiel outbound_email_id = dédup retry ; C4 id conditionnel, C5 post-dispatch ; writer best-effort contrat gate-decisions ; ÉCART : C1/C2/C3 pré-transport → T8 exclut les décisions terminal-failed ; 1 échec CI — drift-guard matchant sa propre prose (classe T2 encore) ; merge parti avant le CI du commit de fix (test-only) — verdict réel = CI main, surveillé).
  Dépend : T1. Fait : migration `outreach_decisions` (features dénormalisées jsonb, design §2 ; `angle`, `alternatives` et `prompt_version` NULLABLES en v1 — ils n'existent pas avant T18) ; écriture au transport après evaluateSend OK (email) avec persona snapshot, signal, features message, canal, timing, position, gate_scores.
  Done : test — chaque envoi outreach crée exactement 1 decision-record ; les champs disponibles au transport sont non-null, angle/prompt_version explicitement null en v1 (complétés par T18) ; un envoi `reply` n'en crée pas.

- [x] **T8 — Jointure décision→outcome + purge des opens décisionnels** (0,5 j) — MERGÉ PR #638 (02/07 ; DÉCOUVERTE : aucun watcher n'existait pour les envois réguliers → créé au seam decision-record (snapshot decisionId, jointure exacte) ; backfill à resolveOutcome, exclusion fantôme en LISTE POSITIVE (la row doit prouver le départ ; un bounce backfille, -0.8 honnête) ; fuite C2 !resend fermée ; ban opens étendu aux violations découvertes : G1 freshness (un auto-open MPP qualifiait un enrollment !), hot-to-call weight 0, prompt LLM du decision-engine, événement sans consommateur. Confirmé : opens jamais dans priority_score. Suivi : attribution contact-scoped smear → scoper au outboundEmailId si T9 lossy).
  Dépend : T7. Fait : le watcher existant (action_outcomes) référencé depuis outreach_decisions (outcome_id rempli à la résolution) ; retrait de `email_opened` des triggers du cadence-branching (campaign-decision-engine.ts:52) et du critère up-next (route.ts:207 → clicks/replies). AMENDEMENT T7 : le resolver DOIT exclure/dé-pondérer les décisions dont la row outbound_emails jointe (outbound_email_id) est terminal-failed — C1/C2/C3 enregistrent pré-transport, un envoi jamais parti serait lu « sent, no response » = biais négatif systématique.
  Done : test — outcome résolu → decision-record joint avec positivity ; grep `email_opened` sur les deux sites purgés = 0 usage décisionnel ; régression up-next verte.

- [x] **T9 — Palier 1 : insights hebdo niveau décision + injection + garde-fous** (1 j) — MERGÉ PR #643 (02/07 ; migration 0115 localdev+prod ; boucle FERMÉE : décisions×outcomes + rejets founder → insights n≥10/lift (fenêtre 90j) → 5e getter du seam applyLearnedContext ; M12-R5 tenant-level (per-segment inexistant, flaggé) avec fix majeur : semaine entièrement invalidée = injection VIDE, jamais de fallback semaine ancienne ; Sonnet borné (maxOutputTokens+PHRASE_CAP+garde-chiffres+fallback déterministe) ; decision-engine ajouté à DRAFTING_AGENT_IDS).
  Dépend : T7, T8. Fait : cron `decision-insights-weekly` sur DEUX sources — agrégats outreach_decisions×outcomes ET raisons de rejet de sequence_drafts (un draft rejeté ne produit jamais de decision-record) — n ≥ 10 par pattern, LLM Sonnet pour la formulation ; croisement automatique insight×deliverability-thresholds à la publication (un pattern qui augmente le volume vers un segment à bounce élevé est invalidé, M12-R5) ; injection via `applyLearnedContext` (traced-ai.ts:121) étendu — ajout de l'agent decision-engine au set DRAFTING_AGENT_IDS + getter du bloc insights.
  Done : test — avec un dataset synthétique de 30 décisions, le cron produit ≥ 1 insight avec n/lift corrects et 1 anti-pattern issu des raisons de rejet ; un insight croisant un segment en breach délivrabilité est invalidé ; sous 10 décisions : aucun insight, état cold-start chiffré.

- [x] **T10 — File de revue des classifications incertaines + intent « objection »** (1 j) — MERGÉ PR #647 (02/07 ; migrations 0116+0117 localdev+prod ; DÉCOUVERTE : 3 classifiers, le vivant sans confiance, celui de la spec = code mort → confiance ajoutée au vivant avec le seuil spec-26 partagé ; file = OVERLAY (routage jamais bloqué) ; vocabulaire canonique unique ; lane « To classify » miroir noise ; correction 1-clic → re-route + label flywheel user_edited/user_approved M11-R3 ; FIX REVUE compliance : corriger vers unsubscribe désinscrit EN DIRECT (la ré-émission faisait rédiger un accusé au reply-agent) ; CAS rail, confidence optionnelle anti-dead-letter, unique partiel pending).
  Dépend : —. Fait : migration `reply_review_queue` ; classification < seuil de confiance → file ; UI lane « à classifier » (étend l'inbox) avec correction 1 clic ; la correction est persistée comme label (M11-R3) et re-route la réponse ; promotion d'« objection » en Intent de premier niveau dans `lib/reply/classify.ts` + routage inbox dédié (M8-R1).
  Done : test — une classification à confiance 0,3 atterrit en file ; la correction met à jour le routage ET crée le label ; une réponse objection est classée `objection` et routée ; une classification sûre ne passe pas par la file.

- [x] **T11 — Reporting outcomes-first + gates + vue décisions** (1 j) — MERGÉ PR #656 (02/07 ; lecture seule, aucune migration ; GET /api/reports/outreach-learning tenant-scopé fail-soft ; outcomes-first (RDV honorés→bookés→réponses+→deals→envois GRISÉS) ; taux de blocage GROUPÉ par (gate,rubricVersion,reasons.path) — les 2 producteurs g2.det.v1 en taux distincts ; vue décisions persona×signal via computeInsights réutilisé ; open-rate confirmé absent (vit sur délivrabilité) ; 1 fix CI TS2367 ; vérif visuelle → /verify).
  Dépend : T6, T7, T9. Fait : écran reports réordonné (RDV honorés → … → envois grisé ; open-rate déplacé vers l'écran délivrabilité avec mention diagnostic) + section gates (taux de blocage par gate + lecture guidée ; AMENDEMENT T6b : grouper les taux G2 par (gate, rubricVersion, reasons.path) — même tuple entre sequence-generator et copy-engine, et les taux « blocked » G2 sous-comptent la fabrication sémantique car le recheck post-regen est déterministe-seul) + vue décisions (combinaisons persona × signal × angle avec agrégats n/lift, design §12 ligne 3.8).
  Done : e2e visuel — l'ordre des métriques est celui de M11-R1 ; l'open rate est ABSENT de la page résultats ; les taux de gates matchent gate_decisions ; la vue décisions affiche n/lift corrects sur dataset seedé.

- [x] **T11b — Cockpit 3.2 : StatBar + zone « Prêt pour vous » + clavier** (1,5 j) — MERGÉ PR #657 (02/07 ; lecture seule, aucune migration ; StatBar cap-gauge/délivrabilité/RDV sous le header 44px ; endpoint net-new /api/deliverability/status (guard SERVER-ONLY exposé via evaluateGuard) ; « Prêt pour vous » sur les 3 tables existantes (drafts pending, review-queue pending, agent_actions awaiting=scheduled+exec-null+non-reversé) ; clavier j/k/Enter miroir inbox ; états non-nominaux (quota/paused/caught-up/skeleton) ; linkedin_action_queue+gifting_tasks non référencés (T13/T22 futurs) ; FLAG /verify : « actions »→/chat faute de page approbations dédiée. CI vert 1er coup — revue pré-push (routes tenant-scopées, 3 classes échec CI scannées, em-dash UI corrigé)).
  Dépend : T2, T6, T9. Fait : extension de /home — StatBar sous le header (compteur cap jauge-plafond, santé délivrabilité, RDV semaine), zone dominante « Prêt pour vous » (réponses avec brouillon, file LinkedIn, drafts de séquence, tâches gifting — cartes avec le pourquoi), zone « Appris cette semaine » (insights T9, état cold-start), navigation clavier j/k/enter/p, états non-nominaux du tableau ux §4 (vide, quota atteint avec items différés listés, délivrabilité dégradée).
  Done : e2e — les 3 zones rendent avec données seedées ; l'état quota-atteint affiche la jauge pleine VERTE + « reprise demain » + items différés (données T2) ; navigation clavier opérante ; aucun CLS (skeleton footprint).

- [~] **T11c — Revue des séquences : SequenceTimeline + gates visibles + rejet-avec-raison** (1 j) — PARTIEL, PR #652 mergée (02/07 ; LIVRÉ : scores/verdicts G1-G5 par draft via jointure gate_decisions + qualityScore ; sources de personnalisation en chips de citation (au lieu du dump JSON) ; lecture seule. PRÉEXISTANT (T6/CLE-14) : rejet-avec-raison persistée (SequenceDraftRejectModal → rejection learner T9) + bulk-approve multi-select. raison textuelle du gate fautif FERMÉE PR #654 (gateReasonText extrait le why par gate depuis reasons jsonb). DIFFÉRÉ : citations DATÉES, SequenceTimeline §12.3.3 (net-new), raccourcis j/k/a/e/x).
  Dépend : T6. Fait : extension de sequences-review — liste groupée par séquence/trigger, SequenceTimeline (steps + waits, pattern Monaco), scores G2-G4 par draft (gate_decisions), citation datée par affirmation (G2), actions approuver/éditer/rejeter-avec-RAISON persistée (source du cron T9), bulk par groupe, raccourcis j/k/a/e/x.
  Done : e2e — un draft bloqué affiche le gate fautif et la raison ; chaque claim du message affiche sa source datée ; un rejet exige une raison et la persiste ; bulk n'agit que sur le groupe homogène.

- [x] **T12 — Producteurs d'outcomes meeting_booked / meeting_held** (0,5 j) — MERGÉ PR #651 (02/07 ; les meetings ne résolvaient JAMAIS de watcher = biais structurel contre le sommet de la hiérarchie ; checkMeetingOutcomes miroir checkEmailOutcomes + 3 producteurs temps réel (book/attendance-held/recall par contact matché) + sweep cron AVANT le check reply (un watcher se consomme une fois, held avant booked) ; jointure décision auto via le snapshot ; 1 fix CI = refactor a cassé un guard T8 littéral → adapté à la structure).
  Dépend : —. Fait : PAS de migration — la table `meetings` n'existe pas (meetings = activities + fetch calendrier live) et le tracking attendance held/no_show EXISTE déjà (PR #270, `resolveAttendance`). Travail réel : produire l'outcome `meeting_booked` sur le watcher du contact à la prise de RDV (préalable au récit T23) et résoudre `meeting_held` depuis `resolveAttendance` (POSITIVITY déjà posée, PR #609).
  Done : test — une prise de RDV résout meeting_booked (0,95) ; une attendance held résout meeting_held (1,0) ; un no-show ne résout pas meeting_held.

## Itération 1 — LinkedIn (file de validation + mode auto) + pause globale

- [ ] **T13a — Câblage du dispatch LinkedIn (le seam est orphelin)** (1 j)
  Dépend : —. Fait : `dispatchLinkedInStep`/`dispatchLinkedInAction` ont ZÉRO caller de production et l'adaptateur séquenceur est un stub tâche-manuelle : câbler l'adaptateur sequence-dispatch → dispatch-step réel (closures suppression spec-22 + anti-collision spec-14 + quotas seat + idempotence, tout existe en lib).
  Done : test d'intégration — un step linkedin_message dû traverse dispatch-step avec tous les garde-fous ; **premier envoi live Unipile vérifié sur un seat connecté** (screenshot/log).

- [ ] **T13b — linkedin_action_queue : file par défaut + decision-record** (1 j)
  Dépend : T13a. Fait : migration + le dispatcher écrit en file (state pending, expires_at = min(TTL signal, +7 j)) sauf auto_mode ; approbation → chemin dispatch existant intact ; **chaque action dispatched écrit un outreach_decisions avec channel=linkedin** (M12-R1 : le dataset garde la dimension canal).
  Done : test — un step LinkedIn dû crée une entrée pending et N'EXÉCUTE PAS ; l'approbation exécute avec les garde-fous ; chaque action dispatched a exactement 1 decision-record channel=linkedin.

- [ ] **T14 — UI file de validation clavier-first** (1 j)
  Dépend : T13b. Fait : page file (cartes, enter/e/x/j/k, batch par groupe homogène, compteur session, quotas seat visibles) + carte cockpit.
  Done : e2e — valider 5 actions au clavier sans souris ; le batch ne valide que le groupe homogène.

- [ ] **T15 — Mode automatique opt-in avec disclosure** (1 j)
  Dépend : T13b. Fait : flag par seat (activated_at + disclosure_ack journalisés) ; modal disclosure CGU ; quotas limits.ts convertis en CONSTANTES non overridables ; pause canal 1 clic (globale/séquence).
  Done : test — sans ack, aucune action directe ; avec auto, les quotas restent bloqués à 20/100 même si la config tenant tente de les relever ; la pause gèle la file ET le mode auto.

- [ ] **T16 — Sweep d'expiration sur signal périmé (LinkedIn + drafts)** (1 j)
  Dépend : T13b, T6. Fait : cron horaire — `linkedin_action_queue` pending→expired sur expires_at ET `sequence_drafts` pending dont le signal justifiant a dépassé son TTL → expired avec trace (état « signal expiré » de la revue, ux §4) ; sections repliées UI.
  Done : test — une action ET un draft dont le signal expire passent expired et sortent des files actives, avec trace.

- [ ] **T16b — Pause globale tenant (1 clic, reprise propre)** (1 j)
  Dépend : T13b. Fait : action « Tout mettre en pause » (cockpit + raccourci p) — gèle les enrollments email (pattern pauseEnrollment, raison `manual_global`), la file LinkedIn et les tâches gifting ; reprise propre (rien ne se perd) ; tracée dans design §12.
  Done : test — pause → aucun envoi/dispatch ne part (les crons skippent), les états UI le disent ; reprise → tout repart sans perte ni doublon.

## Itération 2 — Délivrabilité table stakes + décision par prospect

- [ ] **T17 — Vérifieur email mailbox-level** (1 j)
  Dépend : —. Fait : implémentation `VerifyProvider` (l'interface existante de verify-email.ts — NeverBounce OU ZeroBounce, choix au pricing réel, interface réversible) dans le slot existant (mx-verify-provider.ts:6) ; politique M1-R4 (invalid bloqué, risky/catch-all bloqués par défaut) ; vérification à l'entrée en séquence, coût compté au métering existant.
  Done : test — statuts provider mockés → politiques appliquées au gate ; un contact vérifié valid il y a > 90 j est re-vérifié.

- [ ] **T18 — Decision-engine : canal + timing par prospect** (1 j)
  Dépend : T7. Fait : `lib/autopilot/decision-engine.ts` (generateObject, sortie JSON stricte design §4, via traced-ai) ; timing clampé aux fenêtres tenant ; le choix complète les champs v1-null de outreach_decisions (angle/alternatives/prompt_version).
  Done : test — un prospect sans email vérifié mais seat LinkedIn connecté → channel_first=linkedin ; le timing hors fenêtre est clampé ; le JSON invalide est rejeté (retry puis fallback déterministe) ; les decision-records post-T18 ont angle/prompt_version non-null.

- [ ] **T19 — Warmup auto à la connexion de boîte** (1 j)
  Dépend : —. Fait : la connexion d'une boîte déclenche la rampe existante (2→50/j) sans intervention admin ; l'admin garde la main (pause/reset).
  Done : test — boîte fraîchement connectée : cap effectif jour 1 = début de rampe ; la rampe progresse ; UI onboarding l'affiche (« montée progressive voulue »).

- [ ] **T20a — Golden set annoté + calibration des seuils de gates** (0,5 j)
  Dépend : T6. Fait : annotation de N cas excellent/moyen/mauvais dans golden-cases.ts (à la main, avec le founder si disponible) + script de calibration produisant les seuils G3/G4 (précision/rappel).
  Done : le script sort précision/rappel par seuil candidat ; les seuils retenus sont committés comme constantes versionnées.

- [ ] **T20 — G3 interchangeabilité + G4 seuil central + set_aside** (1 j)
  Dépend : T6, T20a. Fait : rubrique G3 (test de substitution) dans personalization-judge ; seuil G4 centralisé (calibré T20a, défaut 0,75) ; boucle regenerate max N=2 puis set_aside avec explication, sur TOUS les chemins de génération.
  Done : eval — sur le golden set, G3 rejette les messages interchangeables annotés (recall ≥ 0,8) sans bloquer les excellents (précision ≥ 0,9) ; un draft set_aside n'est jamais schedulé.

- [ ] **T21 — List-Unsubscribe structurel** (0,5 j)
  Dépend : T3. Fait : vérification chemin par chemin (worker, SMTP, composer outreach) que le header RFC 8058 part ; le QC gate le vérifie (déjà côté corps, T3).
  Done : test d'intégration — les 3 chemins produisent le header ; absence = blocked par G5.

## Itération 3 — Gifting + payoff + onboarding

- [ ] **T22 — gifting_tasks : déclenchement IA + carte cockpit** (1 j)
  Dépend : T7. Fait : migration ; déclencheur (compte tier haut + signal configuré) → tâche avec suggestion (cadeau, budget, message groundé G2) ; états (done/refused/blocked_budget/expired) ; outcome = touchpoint (rejoint l'attribution) ; **OFF par défaut, activation explicite (M7-R4)**.
  Done : test — sans activation explicite, aucun trigger ne crée de tâche ; une levée sur un compte tier-1 (gifting activé) crée UNE tâche (idempotent) ; au-dessus du seuil budget → approbation requise ; refus avec raison nourrit le learning.

- [ ] **T23 — Récit d'attribution RDV (payoff)** (1 j)
  Dépend : T7, T12. Fait : composant AttributionStory (signal→décision→message→réponse→RDV depuis outreach_decisions + outcomes) sur l'écran RDV pris + demande honoré/no-show quand l'attendance existante ne peut pas le déduire.
  Done : e2e — un RDV pris affiche sa chaîne complète avec dates et sources ; chaque RDV a un récit (100 %, métrique UX).

- [ ] **T24 — Onboarding < 15 min : timer + resserrage** (1 j)
  Dépend : T5, T19. Fait : flow 5 étapes (ux 3.1) avec time-to-first-sequence mesuré (event PostHog) ; états bloquants DNS avec fix guidé ; premier lot = comptes à signal frais uniquement.
  Done : e2e chronométré sur tenant seedé — parcours complet < 15 min ; l'événement TTFS est émis.

## Itération 4 — Apprentissage avancé (gated volume) + conformité

- [ ] **T25a — Bandits : état + lib Thompson** (1 j) — Dépend : T7. Gated : ≥ 300 décisions/tenant.
  Done : tests propriétés — convergence sur bras dominant en simulation ; jamais d'arm hors G1-G3.
- [ ] **T25b — Bandits : intégration decision-engine + update event-driven + garde-fou délivrabilité** (1 j) — Dépend : T18, T25a.
  Done : test — outcome/resolved met à jour α/β du bras joué ; le decision-engine reçoit la proposition comme INPUT (tracé dans alternatives) ; un bras dont le segment entre en breach bounce/spam est gelé (M12-R5).
- [ ] **T26 — Placement tests + blacklist monitoring** (1 j + décision outillage)
  Dépend : —. Fait : intégration seed-list/blacklist (outil à choisir : GlockApps/MailReach-like ou construction seed interne) ; alertes.
  Done : un test de placement programmable produit un rapport par provider ; une inscription blacklist alerte.
- [ ] **T27a — Reward model : dataset + training script + registry** (1 j) — Dépend : T7. Gated : ≥ 2 000 décisions, ≥ 100 positives.
  Done : le script d'entraînement produit un artefact + métriques (AUC, p@20) sur split temporel strict train/test ; enregistré candidate.
- [ ] **T27b — Reward model : backtest, canary, re-rank autopilot, rollback + garde-fou délivrabilité** (1 j) — Dépend : T27a.
  Done : promotion refusée si AUC ≤ baseline+0,05 OU si le canary dégrade bounce/spam ; le re-rank ne fait que FILTRER/ordonner (jamais générer) ; rollback = bascule registry testée.
- [ ] **T28 — Registre des traitements + lawful-basis ON** (1 j)
  Dépend : —. Fait : page registre (finalités, données, durées, sous-traitants — inclut le pool cross-tenant anonymisé) ; backfill lawful-basis puis flag ON.
  Done : le gate lawful-basis actif bloque un contact sans base légale ; le registre liste toutes les catégories du design §2.
- [ ] **T28b — Pondération du succès configurable (M11-R5)** (1 j)
  Dépend : T11. Fait : pondération tenant (ex. RDV honoré vs volume de réponses) dans tenant_settings, défauts sains, consommée par la labellisation des insights (T9) et l'ordre du reporting (T11).
  Done : test — modifier la pondération change le classement des patterns dans la vue décisions ; les défauts reproduisent le comportement actuel.

## Hors périmètre explicite (flaggé, pas oublié)
- Intégration provider gifting (Reachdesk/Alyce) — derrière l'interface T22.
- **Re-scaling POSITIVITY replied_negative (-0,3) vs no_response (0,0)** — décision 02/07 : PAS de re-scale en v1 (les consommateurs positivity > 0,3 — learned-trust.ts:126-131, stats.ts — donnent une sémantique au signe) ; la hiérarchie ORDINALE cible (M11-R1) est encodée au moment de l'AGRÉGATION du decision-record (palier 1), pas dans POSITIVITY. Cf. design §9.
- **Attribution multi-touch fenêtrée (M11-R4)** — hors-scope v1 assumé : l'attribution v1 est last-touch via le watcher existant ; la fenêtre multi-touch sera réévaluée au palier 2 quand le volume de decision-records la rendra calculable. Décision à re-soumettre au founder à ce moment.
- Table `signals` normalisée + decay graduel + composition multi-signaux (M2-R2/R3/R5) — chantier signaux dédié (~11,5 j-h estimés par le rapport signals-world-class), hors MVP.
- Branchements conditionnels in-sequence (M4-R3/R6) — après la file LinkedIn (le vocabulaire sans opens est spécifié).
- Warmup mutualisé façon Smartlead (pool) — multi-semaines, après le MVP (reco benchmark R5).
- Mobile, multi-stakeholder orchestration — non (ux.md, prior-research).

**Comptage** : itération 0 = **15 j-h** (15 tâches, dont 3 surfaces UI) ; it. 1 = 6 j-h ; it. 2 = 5 j-h ; it. 3 = 3 j-h ; it. 4 = 7 j-h + gated. **Total ~36 j-h dont MVP vertical 15.**
