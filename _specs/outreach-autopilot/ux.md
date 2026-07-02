# UX Spec — Outreach multi-canal autopilote (Phase 1bis)

Date : 2026-07-02. Dépend de : `requirements.md` (Phase 1), charte `_harness/design-language.md` (resynchronisée 02/07).
Wireframes basse fidélité : `wireframes.html` (même dossier, tokens réels de la charte).

**Protocole** : le founder a levé les STOP inter-phases (02/07). L'interview Étape A est donc remplie par
réponses PRÉSUMÉES depuis ses positions documentées — chaque ligne cite sa source et se corrige d'un mot.
Toute correction du founder invalide les sections qui en dépendent (traçées).

**À confirmer par le founder à la première démo du cockpit (T11b)** — les 3 réponses en confiance Moyenne qui
conditionnent les écrans : Q3 (vue d'accueil = cockpit « travail déjà fait »), Q4 (budget ≤ 15 min/jour),
Q12 (desktop-only v1). **Question de charte ouverte (INV-4, non improvisée)** : tutoiement ou vouvoiement de
l'INTERFACE vers l'utilisateur ? La charte ne documente le vouvoiement que pour la copy B2B générée ; dans
l'attente, les wireframes sont alignés sur le vouvoiement. Réponse à inscrire dans design-language.md §éditorial.

---

## Étape A — Interview UX : réponses présumées

| # | Question | Réponse présumée | Source | Confiance |
|---|---|---|---|---|
| 1 | Utilisateur principal et maturité outbound ? | Founder early-stage en founder-led sales, maturité outbound FAIBLE à moyenne — il ne veut pas apprendre le métier de SDR, il veut des RDV. | CLAUDE.md (« chat-first, fully autonomous GTM engine for early-stage founders doing founder-led sales. Zero manual CRM entry, no human SDR, no tool config ») | Haute |
| 2 | Degré de contrôle quotidien ? | PROGRESSIF : copilote au départ (tout passe en validation), autopilote activable explicitement PAR CANAL une fois la confiance établie. Jamais de bascule silencieuse. | Décision founder 02/07 (« le but c'est de pouvoir activer un mode automatique ») + contrat « jamais auto-send » structurel (autonomy-hub.ts) + autonomy-nudges #531 | Haute |
| 3 | LA vue d'accueil idéale ? | Cockpit « le travail est déjà fait » : ce que l'IA a préparé cette nuit, classé par urgence, avec le raisonnement visible — pas un dashboard de stats. Le chat reste accessible partout (produit chat-first). | Benchmark (pattern Agent Inbox d'Actively + « Good morning » de Monaco, `benchmark/raw/actively.md` §Lecture) + /home existant (up-next, FollowUpsReadyCard) | Moyenne |
| 4 | Minutes par jour pour tenir la promesse « pilote automatique » ? | ≤ 15 min/jour : ~5 min file LinkedIn + ~10 min réponses & drafts. Au-delà, la promesse est rompue. | Prompt maître (onboarding < 15 min, file LinkedIn « ultra-rapide ») + trade-off accepté M6 (débit LinkedIn borné par ~5 min/j) | Moyenne |
| 5 | Ton / personnalité de l'interface ? | Sobre, précis, factuel. Aucun emoji, pas de hype, pas de gamification. Anglais par défaut, FR sélectionnable. | Feedback memories (no-emoji, no marketing language, detail-over-vision) + i18n #563 | Haute |
| 6 | Volume vs qualité ? | La qualité d'abord, assumée jusque dans l'UI : un jour à 12 envois excellents s'affiche comme un succès, pas comme une jauge à moitié vide. Le cap est un plafond, jamais un objectif. | Prompt maître module 13 + INV-11 | Haute |
| 7 | Les blocages des quality gates : friction ou feature ? | Feature visible : chaque message bloqué affiche quel gate et pourquoi — la rigueur EST l'argument produit. | Prompt maître (« la rigueur devient une feature visible ») + gap benchmark §6.2 (personne ne le fait) | Haute |
| 8 | Le moment de vérité du produit ? | Le RDV pris (et honoré). Ce moment doit être célébré et raconté (quel signal, quelle séquence, quel message ont produit ce RDV) — c'est aussi la vitrine de la boucle d'apprentissage. | Scheduler audit (mémoire : « payoff nude » à corriger) + M11 (meeting_held = signal ultime) | Haute |
| 9 | Que voit l'utilisateur de la boucle d'apprentissage ? | Des insights en langage clair sur SES décisions (« vos réponses viennent 3× plus des CTO contactés < 30 j après une levée ») + anti-patterns. Différenciateur n°1 du benchmark — aucun des 8 concurrents ne l'expose. | INV-9, M12-R6, benchmark §6.1 | Haute |
| 10 | Gifting dans l'expérience ? | Une tâche préparée (cadeau suggéré + message + budget), jamais un envoi automatique. S'insère dans le cockpit comme n'importe quel travail préparé à valider. | Décision founder 02/07 (tâche manuelle IA) | Haute |
| 11 | Confiance dans les données affichées ? | Toute affirmation IA affichée est cliquable vers sa source datée (pattern Reasoning + Sources de Monaco, vérifié en capture 010). Pas de source = pas d'affirmation. | INV-3 + benchmark deep-dive Monaco | Haute |
| 12 | Mobile ? | Desktop-only pour la v1 (le cockpit et la file de validation exigent le clavier) ; la seule surface mobile envisageable plus tard = notification RDV pris. | Benchmark (Monaco desktop-only 1440px+) + aucune demande mobile documentée | Moyenne |

---

## 1. Personas & jobs-to-be-done (2)

**P1 — Le founder-seller (primaire).** Fondateur d'une boîte early-stage (pré-seed → série A), 30 à 90 min/jour MAX pour la vente, pas de SDR, pas de RevOps. JTBD : « Quand je me lève le matin, je veux trouver des conversations qualifiées prêtes à avancer, sans avoir passé ma soirée à prospecter — pour remplir mon pipeline sans cesser d'être fondateur. » Critère de succès : des RDV honorés dans son calendrier ; il ne se connecte pas pour « faire de l'outreach », il se connecte pour VALIDER et RÉPONDRE.

**P2 — L'opérateur growth solo (secondaire).** Premier profil growth/ops d'une petite équipe, mandaté pour industrialiser ce que le founder faisait à la main. Même parcours, deux différences : il configure plus finement (ICP, séquences, budgets gifting) et lit le reporting chaque semaine. JTBD : « Quand le founder me confie l'outbound, je veux prouver par les outcomes que la machine progresse — pour justifier le canal sans embaucher un SDR. »

Aucun persona « équipe SDR » : le produit refuse ce marché (pas de territoires, pas de quotas par rep — c'est le terrain d'Amplemarket/Reply).

## 2. Principes d'expérience (hiérarchisés — en conflit, le plus haut gagne)

1. **Transparence des décisions.** Chaque prospect enrollé, chaque message, chaque blocage affiche « pourquoi » : le signal (avec date et source cliquable), l'angle choisi, le gate franchi ou raté. Obligatoire partout (INV-2, INV-3, M13-R6) — c'est le principe que le benchmark montre inoccupé en profondeur.
2. **Confiance progressive.** Tout commence en copilote (validation). L'autopilote s'active par canal, explicitement, avec disclosure (M6-R2) ; le système PROPOSE l'activation quand les métriques le justifient (« 30 drafts validés sans modification — passer l'email en auto ? »), il ne bascule jamais seul.
3. **Contrôle humain à 1 clic.** Pause globale, par séquence, par prospect, par canal — accessible depuis chaque écran sans navigation (M6-R4). Une pause n'est jamais punie (rien ne se perd, tout reprend proprement).
4. **Le travail arrive fait.** L'utilisateur revoit, il ne crée pas. Zéro écran de configuration obligatoire après l'onboarding ; les défauts sont sains (M11-R5). Review > compose, toujours.
5. **La rigueur visible.** Les messages bloqués par les gates et les jours « 12 envois seulement » sont présentés comme le produit qui fonctionne, pas comme des erreurs (INV-11, M13-R7).
6. **Qualité d'affichage des outcomes.** Réponses, RDV pris, RDV honorés d'abord ; jamais l'open rate en premier (INV-7) — il vit uniquement dans l'écran délivrabilité comme diagnostic.

## 3. Parcours utilisateur clés, écran par écran

Ancrage brownfield : chaque écran étend une surface EXISTANTE quand elle existe (colonne « Surface »).

### 3.1 Onboarding — objectif : première séquence lancée en < 15 min
Surface : flow `(dashboard)` existant (connexion boîte, import, ICP NL — briques présentes).
1. **Connexion boîte email** (OAuth Google/MS ou SMTP) → checklist SPF/DKIM/DMARC en temps réel (M5-R4, page deliverability existante). État bloquant si DNS non conforme : explication actionnable, pas de « contactez le support ».
2. **Import TAM** (CSV ou source connectée) → rapport d'import (M1-R1) → dédup silencieuse.
3. **ICP en langage naturel** (« SaaS B2B français, 10-50 personnes, vendent aux DAF ») → lib/icp/nl existante → aperçu du TAM matché avec taille.
4. **Première séquence proposée par l'IA** : le système choisit les N meilleurs comptes À SIGNAL FRAIS (INV-2 : pas de signal = pas dans la liste, même au premier jour), montre la séquence (steps + messages réels) avec le pourquoi par compte.
5. **Validation** → la séquence part en warmup-aware (M5-R3) : l'écran dit clairement « la première semaine, le volume monte progressivement — c'est voulu ».
Timer UX : chaque étape affiche sa durée cible ; time-to-first-sequence mesuré (métrique n°1).

### 3.2 Cockpit quotidien (vue d'accueil)
Surface : étend `/home` existant (up-next, FollowUpsReadyCard).
Structure en 3 zones :
- **« Prêt pour vous »** (zone dominante — vouvoiement par défaut, cf. question de charte en tête) : le travail préparé cette nuit, classé par urgence — réponses à traiter (avec brouillon prêt), actions LinkedIn en file, drafts de séquence à valider, tâches gifting. Chaque item porte son pourquoi (signal + date). Pattern « review one by one » au clavier.
- **Barre d'état** (44px sous le header) : quota du jour (X/100 tenant — jauge PLAFOND, pas objectif : à 12/100 avec 12 excellents, l'état est « vert »), santé délivrabilité (état + lien diagnostic), RDV pris cette semaine.
- **« Appris cette semaine »** (zone droite) : 1-3 insights en langage clair avec preuve (M12-R6). Vide les premières semaines : état cold-start honnête, chiffré sur la règle unique du design §9 (« 14 décisions trackées — un insight s'affiche dès 10 décisions sur un même pattern »).

### 3.3 Revue des séquences proposées par l'IA
Surface : étend `sequences-review` existant (lib/sequence-drafts, state machine, bulk atomique).
- Liste des enrollments proposés groupés par séquence/trigger (« Post-levée — 8 comptes »), chaque ligne : compte, contact, signal (type + fraîcheur + source), angle, aperçu du 1er message.
- Détail : timeline verticale des steps (pattern Monaco 011) avec les messages réels et, par affirmation, sa source datée (G2).
- Actions : approuver / éditer / rejeter (avec RAISON — la raison nourrit M12) / « pas maintenant ». Bulk par groupe. Raccourcis j/k/a/e/x.
- Un enrollment rejeté N fois sur le même motif = anti-pattern injecté (M12-R2).

### 3.4 File de validation LinkedIn — ultra-rapide
Surface : NOUVELLE (l'infra dispatch existe, la file est à créer — M6-R1).
- Une action = une carte : prospect, action (visite/invitation/message), le message pré-rempli, le signal justifiant, l'état du quota siège (X/20 connexions).
- Clavier : `enter` = valider, `e` = éditer, `x` = passer, `j/k` = naviguer. Batch « tout valider » par groupe homogène (même séquence, même template).
- Session cible : 30 actions en < 5 min. Compteur de session visible.
- Bandeau mode : « Validation manuelle (défaut) — Activer le mode automatique » → modal disclosure CGU (M6-R2), avec l'état des quotas non relevables affiché.
- Une action dont le signal a expiré sort de la file avec trace (M2-R4) : section repliée « expirées » en bas.

### 3.5 Réponses à traiter
Surface : étend l'inbox existante (lanes priorisées, j/k/e/r, prepared-draft — classe-leader d'après l'audit concurrentiel de juin).
Ajouts requis par la spec : la lane « à classifier » (M8-R2 : classifications sous seuil de confiance, l'humain corrige en 1 clic — la correction est une donnée d'entraînement, dite comme telle : « merci, le système apprend de cette correction ») ; les slots de RDV injectés dans le draft (existant, M8-R3) ; l'objection routée (M8-R1).

### 3.6 RDV (le payoff)
Surface : étend le scheduler existant (invite states #582).
- Moment « RDV pris » : écran de confirmation qui RACONTE l'attribution (M11-R4) : « Signal levée Série A (12/06, source) → séquence Post-levée → message 2 → réponse positive → RDV jeudi 10h ». C'est la vitrine du produit — soignée, partageable.
- Après le RDV : demande de confirmation « honoré ? » (alimente meeting_held, M8-R4) si le calendrier ne peut pas le déduire.

### 3.7 Gifting (tâches)
Surface : NOUVELLE, mais rendue DANS le cockpit (pas de page dédiée en v1 — M7).
Carte tâche : compte, signal déclencheur, cadeau suggéré + budget, message d'accompagnement, boutons fait / refuser (raison) / bloqué-budget. État « approbation requise » au-dessus du seuil (M7-R3).

### 3.8 Reporting
Surface : étend `reports` existants.
- Ordre IMPOSÉ des métriques : RDV honorés, RDV pris, réponses positives, réponses, puis volume. L'open rate n'apparaît QUE dans l'écran délivrabilité (INV-7).
- Taux de blocage par gate (M13-R7) avec lecture guidée (« 22% bloqués au gate factuel : normal en démarrage »).
- Vue « décisions » (M12) : quelles combinaisons persona × signal × angle produisent les outcomes — la version lisible du decision-record.

## 4. États non-nominaux (par écran)

| Écran | Vide | Chargement | Erreur | Quota atteint | Délivrabilité dégradée | Signal expiré |
|---|---|---|---|---|---|---|
| Cockpit | « Rien à valider — l'autopilot travaille. Prochain lot : cette nuit » + dernier lot traité | Skeleton footprint (invariant loading.tsx existant) | Bandeau erreur + retry, jamais de zone blanche | Jauge pleine VERTE + « reprise demain 00:00 (fuseau) » ; items différés listés | Bandeau ambre persistant + CTA diagnostic ; les envois pausés le disent | n/a |
| Revue séquences | « Aucune proposition — aucun compte avec signal frais aujourd'hui » (JAMAIS « ajoutez des comptes » : le manque de signal est l'état normal, INV-2) | Skeleton liste | Erreur par ligne, le lot reste actionnable | Propositions créées mais marquées « partira demain » | Proposition gelée + explication | La ligne montre « signal expiré » et sort du lot actif (sweep T16, livré it.1) |
| File LinkedIn | « File vide — prochaines actions demain 8h » + total validé cette semaine | Skeleton cartes | L'action en erreur passe en fin de file avec raison | Quota siège atteint : file gelée + compteur reset | Siège restreint : file gelée, notification, AUCUN basculement de siège (M6-R6) | Section « expirées » repliée, avec trace |
| Réponses | « Inbox à zéro » + stat de la semaine | Skeleton existant (#510) | Draft indisponible ≠ réponse illisible : dégrader en réponse manuelle | n/a | n/a | n/a |
| Reporting | État cold-start chiffré sur la règle unique (« 14 décisions — un insight s'affiche dès 10 sur un même pattern ») | Skeleton | Sections indépendantes (une erreur ne vide pas la page) | n/a | Bandeau d'alerte + lien vers l'ÉCRAN délivrabilité (l'open rate ne vit QUE là, jamais dans le reporting — T11) | n/a |
| RDV (payoff) | « Pas encore de RDV — le premier récit d'attribution s'affichera ici » | Skeleton du récit | Attribution incomplète : afficher la chaîne partielle, jamais une page vide | n/a | n/a | n/a — cas propres : calendrier déconnecté (bandeau reconnexion), attendance inconnue (question honoré/no-show, T12) |
| Gifting (cartes cockpit) | Aucune tâche : la section n'apparaît pas (OFF par défaut, M7-R4) | Skeleton carte | Erreur par carte, le cockpit reste actionnable | Budget mensuel épuisé : tâches créées en état « bloqué budget » | n/a | Tâche expirée avec trace (signal périmé avant exécution) |
| Onboarding | — | Par étape | DNS non conforme = étape bloquante avec fix guidé, PAS de skip silencieux | n/a | n/a | n/a |

## 5. Wireframes basse fidélité

`_specs/outreach-autopilot/wireframes.html` — 5 écrans (cockpit, revue séquences, file LinkedIn, RDV-payoff, reporting), HTML statique consommant les tokens réels (`--color-bg-page #FAFAFA`, accent `#2C6BED`, header 44px, rows 44px, Inter). Basse fidélité assumée : boîtes + hiérarchie + copy réelle, pas de design fini (la Phase 2 mappe les tokens ; le design fini passe par /design-review à l'implémentation).

## 6. Métriques UX de succès

| Métrique | Cible | Mesure |
|---|---|---|
| Time-to-first-sequence | < 15 min (médiane) | timestamp signup → premier enrollment validé |
| Temps quotidien dans l'outil | ≤ 15 min/jour actif | sessions agrégées |
| Messages IA acceptés sans modification | > 60 % au mois 1, > 80 % au mois 3 | drafts approuvés vs édités (nourrit aussi M12) |
| Actions LinkedIn validées < 24 h | > 90 % | file de validation |
| Activation d'un mode auto à J30 | > 40 % des tenants actifs | événement d'activation (M6-R2) |
| RDV pris attribuables affichés | 100 % (chaque RDV a son récit d'attribution) | M11-R4 |

Anti-métrique : le volume d'envois n'est JAMAIS une métrique de succès UX (INV-11).
