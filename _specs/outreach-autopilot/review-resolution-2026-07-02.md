# Résolution de la revue adversariale — 2026-07-02

Source : `review-findings-2026-07-02.json` (47 findings : 2 bloquants, 20 majeurs, 25 mineurs, 4 lentilles).
Docs modifiés : requirements.md, design.md, tasks.md (réécrit), ux.md, wireframes.html, benchmark/competitors-matrix.md, benchmark/raw/elevay-existing.md.
Décisions d'arbitrage prises par la session principale (POSITIVITY non re-scalée v1 ; nouvelles tâches it.0 ; périmètre du cap).

Index = ordre du JSON (bloquants puis majeurs puis mineurs).

| # | Sév. | Résumé court | Disposition |
|---|---|---|---|
| 0 | B | G2 sur tous les chemins de génération sans tâche | TRAITÉ — nouvelle tâche T6b (1 j, it.0), done par chemin (autopilot/prepare, reply-drafts, chat), verdicts loggés gate_decisions |
| 1 | B | Cockpit / revue séquences / vue décisions sans tâches UI | TRAITÉ — T11b (cockpit, 1,5 j), T11c (revue, 1 j), T11 étendu (vue décisions), tous it.0 |
| 2 | M | Surface cockpit M5-R2 absente | TRAITÉ — T11b (même fix que #1) ; done T2 étendu (items différés) |
| 3 | M | Logs de gates invisibles (M13-R6) | TRAITÉ — T11c : gate_scores + citation par claim + raison de rejet, e2e « draft bloqué affiche gate+raison » |
| 4 | M | Decision-record LinkedIn absent | TRAITÉ — T13b : chaque action dispatched écrit outreach_decisions channel=linkedin |
| 5 | M | replied_negative/no_response non tranché | TRAITÉ — décision documentée design §9 (pas de re-scale v1, ordinal à l'agrégation) + entrée hors-périmètre tasks.md |
| 6 | M | M11-R5 disparu de la chaîne | TRAITÉ — récap requirements (P2) + tâche T28b (it.4) |
| 7 | M | Garde-fous M12-R5 sans tâche | TRAITÉ — dones étendus T9 (croisement insight×thresholds), T25b (bras gelé sur breach), T27b (canary bounce/spam) |
| 8 | M | Intent « objection » sans tâche ni récap | TRAITÉ — T10 étendu (promotion en Intent de premier niveau + routage) + récap requirements (ligne P1) |
| 9 | M | Dispatch LinkedIn = seam orphelin, T13 sous-chiffré | TRAITÉ — M6-R5 requalifié PARTIEL ; T13 scindé T13a (câblage + premier envoi live vérifié) / T13b (file) |
| 10 | M | sendClass déclaratif = bypass INV-1 | TRAITÉ (déjà résolu by design, PR #615) — design §3 annoté : dérivation serveur C1-C3 (inReplyTo), C4/C5 auto-classifiés, claim reply re-vérifiée in-gate, invérifiable = outreach |
| 11 | M | T3 runQc irréaliste (0,5 j, pas de contenu dans le gate) | TRAITÉ — T3 re-scopé 1 j : signature evaluateSend content optionnel, plomberie 5 sites, options plainText/maxLinks pré-footer, check désinscription À ÉCRIRE ; design §5 corrigé |
| 12 | M | Done T7 impossible (angle/prompt_version avant T18) | TRAITÉ — T7 v1 record PARTIEL (champs nullables, done l'assume), complété par T18 |
| 13 | M | meetings.attendance infaisable + attendance existe déjà (PR #270) | TRAITÉ — T12 réécrit (0,5 j, producteurs d'outcomes seulement), design §2 corrigé, M8-R4 requalifié, post-scriptum audit |
| 14 | M | Attribution multi-touch tombée en silence | TRAITÉ — flag explicite hors-scope v1 (design §9 + tasks hors-périmètre + récap P3), décision à re-soumettre au palier 2 |
| 15 | M | M11-R5 (doublon de #6) | TRAITÉ — cf. #6 |
| 16 | M | Re-scaling déféré par requirements jamais traité | TRAITÉ — cf. #5 (décision documentée + récap mis à jour « DÉCIDÉ v1 ») |
| 17 | M | Open rate affiché sur l'écran Résultats du wireframe 5 | TRAITÉ — carte remplacée par un lien « Diagnostic délivrabilité » ; cellule ux §4 Reporting corrigée |
| 18 | M | Pause globale promise sans support technique | TRAITÉ — nouvelle tâche T16b (pause tenant-wide : enrollments + file LinkedIn + gifting, reprise propre, 1 j, it.1) |
| 19 | M | État « signal expiré » de la revue sans mécanisme | TRAITÉ — T16 étendu (sweep sur linkedin_action_queue ET sequence_drafts pending, 1 j) + cellule ux §4 annotée (livré it.1) |
| 20 | M | Objection promise en 3.5 sans code | TRAITÉ — cf. #8 (T10) |
| 21 | M | Em-dashes dans la copy générée des wireframes | TRAITÉ — les deux messages réécrits sans em-dash (golden cases irréprochables) |
| 22 | m | Vue décisions sans tâche | TRAITÉ — T11 étendu (dep T7/T9, done n/lift) |
| 23 | m | Seuils cold-start incohérents (~50 vs n≥10) | TRAITÉ — règle unique dans design §9 (n≥10/pattern + compte total), copys ux + wireframes alignées |
| 24 | m | Rate limit classé sous-plafond de volume | TRAITÉ — design §3 : reclassé lissage de débit (safety net), 600/h ≈ 14 400/j explicité |
| 25 | m | « T-0 100 % déterministe » contredit par les HEAD checks | TRAITÉ — design §5 précisé (nouveaux checks <50 ms ; citations T-0 = I/O-bound, timeout fail-closed) |
| 26 | m | Trois périmètres de cap concurrents entre docs | TRAITÉ — matrice R2 annotée (tranché founder 02/07 = tenant, PR #615) |
| 27 | m | Benchmark décrit comme actuels des conflits corrigés (#609) | TRAITÉ — post-scriptum « Corrections post-audit » dans elevay-existing.md |
| 28 | m | Dépendance injustifiée T19→T1 | TRAITÉ — dépendance retirée (T19 : Dépend : —) |
| 29 | m | M7-R4 (gifting OFF par défaut) absent du done T22 | TRAITÉ — done T22 : « sans activation explicite, aucun trigger ne crée de tâche » |
| 30 | m | Producteur meeting_booked sans tâche | TRAITÉ — fusionné dans T12 réécrit |
| 31 | m | getLearnedContext n'existe pas (applyLearnedContext, gated) | TRAITÉ — design §9 renommé + [ÉTEND] (agent decision-engine + getter), T9 le dit |
| 32 | m | EmailVerifierPort n'existe pas (VerifyProvider) | TRAITÉ — design §7 + T17 corrigés |
| 33 | m | T5 serré (fonction pure, 6 call-sites, autopilot hors circuit) | TRAITÉ — T5 re-scopé 1,5 j avec wrapper loadEligibilityContext explicite + drift-guard 6 sites |
| 34 | m | G5 surestimé (warmup/DNS worker-side) + enum drafts réel | TRAITÉ — design §5 corrigé (cron-only v1) ; T6 re-chiffré 1,5 j avec le contenu ALTER TYPE/canTransition explicite |
| 35 | m | Périmètre de l'invariant cap non écrit | TRAITÉ — clause ajoutée INV-1 + design §3 (envois initiés par Elevay ; sendViaInstantly via evaluateSend ; campagne provider-side interdite) |
| 36 | m | Objection (doublon de #8/#20) | TRAITÉ — cf. #8 |
| 37 | m | Golden set annoté sans tâche de création | TRAITÉ — nouvelle tâche T20a (0,5 j, it.2), T20 en dépend |
| 38 | m | Garde-fous apprentissage sans implémentation (doublon #7) | TRAITÉ — cf. #7 |
| 39 | m | États non-nominaux : lignes RDV et Gifting manquantes | TRAITÉ — 2 lignes ajoutées au tableau ux §4 |
| 40 | m | Prompt système du decision-engine jamais esquissé | TRAITÉ — squelette v1 ajouté design §4 (règles dures anti-hallucination, priorité règles > contexte appris, sortie JSON) |
| 41 | m | 3 réponses d'interview en confiance Moyenne non validées | TRAITÉ PAR ANNOTATION — ux.md : validation founder requise à la première démo cockpit (T11b) ; impossible de bloquer (protocole « continue sans accord ») |
| 42 | m | « objectif atteint » = vocabulaire volume-objectif banni | TRAITÉ — badge réécrit « 12 envois, tous excellents : journée réussie » |
| 43 | m | Tutoiement improvisé (ambiguïté de charte, INV-4) | TRAITÉ — wireframes alignés vouvoiement + question founder inscrite en tête d'ux.md (réponse à consigner dans design-language.md) |
| 44 | m | Ligne cockpit §12 incomplète (délivrabilité, RDV, différés) | TRAITÉ — design §12 complété + done T2 étendu |
| 45 | m | Rejets de drafts jamais sources d'anti-patterns | TRAITÉ — design §9 + T9 : sequence_drafts.raisons de rejet = seconde source du cron |
| 46 | m | Polish FR wireframes (décimales, franglais, tournures) | TRAITÉ — virgules décimales (0,86/0,75), « brouillon prêt », « créneaux », « étayé par ses sources », « choisi face à », cold-start unifié |

**Bilan : 47/47 traités (2 B, 20 M, 25 m) — 0 rejeté.** Deux traitements sont des annotations plutôt que des fixes bloquants (#41 validation différée à la démo, #43 question de charte posée au founder), conformes au protocole d'autonomie en vigueur.

Effet sur le plan : tasks.md passe de 28 tâches / ~27,5 j-h à **34 tâches / ~36 j-h** (MVP it.0 : 10,5 → **15 j-h**), l'écart venant des 3 surfaces UI qui portaient la promesse produit sans tâche, du câblage LinkedIn réel (seam orphelin) et des re-chiffrages honnêtes (T3, T5, T6).
