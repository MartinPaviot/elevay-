# Requirements — Outreach multi-canal autopilote (Elevay)

Phase 1 du prompt maître (`_specs/prompt-claude-code-outreach-elevay.md`). Format EARS :
« QUAND [événement/condition], LE SYSTÈME DOIT [comportement mesurable] » ; « LE SYSTÈME DOIT TOUJOURS » pour les invariants.

**Ancrage brownfield** : chaque exigence est annotée contre `origin/main` (ref auditée `79731970`, re-validée `969123ee`) —
`[EXISTE — preuve]` / `[PARTIEL — preuve + gap]` / `[ABSENT]`. Détail complet : `benchmark/raw/elevay-existing.md`.
Chemins relatifs à `app/apps/web/src/` sauf mention contraire.

**Décisions founder intégrées (02/07/2026)** :
1. Cap d'envoi = **100 emails/jour/TENANT**, invariant architectural.
2. LinkedIn = file de validation par action PAR DÉFAUT + **mode automatique activable par canal** (amende la vision 5 du prompt maître).
3. Gifting MVP = **tâche manuelle déclenchée par l'IA** (pas d'intégration provider en v1).
4. Les opens sont bannis PARTOUT : apprentissage, déclencheur de décision, branchement de séquence, priorisation UI.
5. Charte = `_harness/design-language.md` (réécrite le 02/07 depuis les tokens réels de `globals.css`).

---

## 0. Invariants système (règles permanentes du prompt maître, opposables à tous les modules)

- **INV-1** — LE SYSTÈME DOIT TOUJOURS refuser tout envoi d'email d'outreach au-delà de 100/jour calendaire/tenant, dans TOUS les modes d'envoi (primary, elevay-managed, external-connected/Instantly), sans aucun chemin de configuration (UI, colonne DB, variable d'env tenant) permettant de le dépasser. Périmètre : l'invariant gouverne tout envoi INITIÉ par Elevay ; tout câblage futur d'un envoi provider (ex. `sendViaInstantly`) DOIT traverser `evaluateSend`, et le mode « campagne pilotée par le scheduler du provider » est interdit (il contournerait le cap par construction). `[ABSENT — les quotas actuels sont des variables de config : 20/j primary (lib/config/tenant-settings.ts:531), 50/j/mailbox (db/schema/outbound.ts:367), 60/min+600/h tenant (lib/infra/rate-limit.ts:104-109) ; le mode external-connected n'est pas gated en volume (lib/guardrails/sending-identity.ts:115-124). Point d'insertion : evaluateSend (lib/guardrails/sending-gate.ts:214), unique et fail-closed sur les 5 chokepoints]`
- **INV-2** — QUAND un message est généré, LE SYSTÈME DOIT y attacher la référence du signal qui justifie le contact (type, date, source) ; SI aucun signal pertinent n'existe, ALORS le prospect ne DOIT PAS entrer en séquence, quel que soit son fit statique. `[PARTIEL — l'autopilot sélectionne signal-ranked (lib/autopilot/run.ts:1-13) et la copy est groundée par brief (lib/autopilot/prepare.ts:1-16), mais aucune règle « pas de signal frais = pas d'enrollment » n'est opposable aux enrollments manuels/chat, et la référence du signal n'est pas attachée au message envoyé]`
- **INV-3** — LE SYSTÈME NE DOIT JAMAIS affirmer sur un prospect une information non vérifiable contre une donnée source datée ; QUAND une information manque, le template DOIT se dégrader proprement (fallback segment). `[PARTIEL — fabrication-gate 2 couches (lib/evals/fabrication-gate.ts:1-22) + never-invent floor (prepare.ts:7-9), mais seulement sur le chemin sequence-generator ; pas au transport ; envois manuels non couverts]`
- **INV-4** — Toute UI et tout template DOIT respecter la charte (`_harness/design-language.md`, source de vérité `globals.css` @theme) ; toute ambiguïté de charte DOIT être remontée au founder, pas improvisée. `[EXISTE — charte resynchronisée le 02/07]`
- **INV-5** — Toute fonctionnalité livrée DOIT inclure ses états vide / chargement / erreur / quota-atteint / délivrabilité-dégradée / signal-expiré. `[PARTIEL — les états vide/chargement/erreur sont couverts app-wide (arcs #510-#552) ; quota-atteint et signal-expiré à spécifier par écran en Phase 1bis]`
- **INV-6** — QUAND un événement outbound survient (envoi, bounce, réponse, classification, RDV pris, RDV honoré, opt-out), LE SYSTÈME DOIT le persister dans un schéma pensé pour l'apprentissage, dès le MVP ; aucune donnée d'outcome ne DOIT être perdue. `[PARTIEL — outcomes d'action (lib/outcomes/resolve.ts, create-watcher.ts:4-30) et activités existent ; le decision-record complet (M12-R1) n'existe pas]`
- **INV-7** — LE SYSTÈME NE DOIT JAMAIS utiliser les opens : ni comme signal d'apprentissage, ni comme déclencheur de décision, ni comme condition de branchement de séquence, ni comme critère de priorisation UI, ni comme métrique de succès affichée en premier. Les opens restent visibles comme diagnostic de délivrabilité uniquement. `[PARTIEL — apprentissage neutralisé par PR #609 (watcher, prior, attribution) ; restent 2 usages décisionnels à purger : trigger « email_opened » du cadence-branching dormant (inngest/campaign-decision-engine.ts:52) et priorisation up-next (app/api/home/up-next/route.ts:207)]`
- **INV-8** — QUAND un prompt ou un modèle est modifié, LE SYSTÈME DOIT exécuter la suite d'evals et un backtest AVANT toute promotion en production, et tout déploiement DOIT être réversible. `[PARTIEL — canary ramp/promote/rollback (lib/prompts/canary-ramp.ts) + evals (lib/evals/*) existent ; le déclenchement systématique « à chaque modification » n'est pas garanti structurellement]`
- **INV-9** — LE SYSTÈME DOIT exposer les insights de la boucle d'apprentissage à l'utilisateur dans l'UI, en langage clair. `[PARTIEL — les artefacts appris sont injectés dans les prompts (lib/ai/traced-ai.ts:90-308) mais pas exposés comme feature UI]`
- **INV-10** — AUCUN message ne DOIT partir sans avoir franchi les 5 quality gates (M13) ; il ne DOIT exister aucun chemin de code de contournement ; les envois manuels initiés depuis l'UI DOIVENT passer au minimum les gates 2 (factuel) et 5 (délivrabilité). `[PARTIEL — G5 existe au transport ; G1-G4 n'existent qu'à la génération sur certains chemins ; le QC gate spec-20 est construit mais a 0 call-site (lib/copy/variants/index.ts) ; les envois manuels bypassent G2]`
- **INV-11** — LE SYSTÈME NE DOIT contenir aucune logique de « remplissage de quota » : le cap est un plafond, jamais un objectif ; un jour à 12 envois excellents est un succès. `[PARTIEL — l'autopilot sélectionne ≤ budget signal-ranked (run.ts) mais rien n'empêche de compléter le budget avec des candidats à signal faible ; le seuil de qualité minimal d'entrée (G1) doit devenir bloquant]`

---

## Module 1 — Ingestion TAM & enrichissement

- **M1-R1** — QUAND l'utilisateur importe un fichier CSV ou connecte une source (Apollo, Sales Navigator, registres FR), LE SYSTÈME DOIT ingérer comptes et contacts avec mapping de champs assisté et rapport d'import (lignes acceptées/rejetées/raisons). `[EXISTE — lib/import/agentic-executor.ts, lib/sourcing/, lib/campaign-engine/sources/linkedin.ts, inngest/icp-source.ts]`
- **M1-R2** — QUAND un compte ou contact entrant correspond à un enregistrement existant, LE SYSTÈME DOIT dédupliquer par identité canonique (domaine, email, similarité) sans perte des propriétés déjà acquises. `[EXISTE — lib/dedup/{contacts,group,merge,run,similarity}.ts, spec 07]`
- **M1-R3** — QUAND un contact est destiné à recevoir un email, LE SYSTÈME DOIT vérifier son adresse par une cascade se terminant par une vérification mailbox-level (SMTP/provider payant), et classer le résultat {valid, risky, catch-all, invalid, unverifiable}. `[PARTIEL — cascade syntaxe+jetable+MX/domaine (lib/contacts/email/verify-email.ts, mx-verify-provider.ts:3-6) ; le vérifieur mailbox est « slotted in » mais ABSENT (persist-verification.ts:11)]`
- **M1-R4** — QUAND l'adresse est classée `invalid`, LE SYSTÈME DOIT bloquer l'envoi ; QUAND elle est `risky`/`catch-all`, LE SYSTÈME DOIT appliquer la politique du tenant (bloquer par défaut). `[PARTIEL — le gate ne bloque que `invalid` connu (sending-gate.ts:281-292) ; pas de politique risky/catch-all]`
- **M1-R5** — QUAND l'utilisateur définit son ICP (en langage naturel ou par critères), LE SYSTÈME DOIT le persister versionné et le traduire vers chaque source de sourcing. `[EXISTE — lib/icp/store/db-store.ts + version.ts, nl/nl-to-icp.ts, to-{apollo,pappers,sirene}-params.ts, lookalike/derive.ts]`
- **M1-R6** — QUAND le TAM est construit, LE SYSTÈME DOIT le rafraîchir périodiquement (nouvelles entreprises matchant l'ICP, sorties de marché). `[EXISTE — inngest/tam-refresh-cron.ts, lib/tam/persist-tam.ts]`

Edge cases : CSV encodé exotique/colonnes manquantes (rapport, pas de crash) ; contact sans email NI LinkedIn (inéligible, visible comme tel) ; deux sources donnant des valeurs contradictoires (waterfall par champ avec priorité de source — lib/enrichment/field/waterfall.ts) ; domaine expiré depuis l'import (re-vérification à l'entrée en séquence, pas seulement à l'import).

## Module 2 — Moteur de signaux

- **M2-R1** — LE SYSTÈME DOIT collecter des signaux d'achat depuis des sources multiples (levées, hiring, changements de poste, tech-stack, actualités, engagement first-party) via des jobs planifiés. `[EXISTE — inngest/signal-monitor.ts:37 (cron 4 h), signal-score-daily.ts:106 (cron quotidien), engagement-signal.ts, funding-signal-monitor, jobs-posts-sourcing.ts:163, custom-signals]`
- **M2-R2** — QUAND un signal est détecté, LE SYSTÈME DOIT l'enregistrer normalisé (type canonique unique, date de détection, source, force) — une seule taxonomie, les variantes producteurs résolues par alias à l'ÉCRITURE. `[PARTIEL — recordCompanySignal upsert typé (lib/signals/record-signal.ts:94) mais JSONB properties.signals[] non normalisé, ≥6 taxonomies réconciliées à la LECTURE par alias-map (lib/scoring/signal-outcomes.ts:105-148)]`
- **M2-R3** — QUAND le score de priorité est calculé, LE SYSTÈME DOIT appliquer une décroissance temporelle GRADUELLE par type de signal (pas un cliff binaire frais/périmé), avec TTL par type. `[PARTIEL — TTL par type + application quotidienne (lib/signals/freshness.ts:31,81 ; signal-score-daily.ts:87-90) mais décroissance en marche d'escalier]`
- **M2-R4** — QUAND un signal est périmé (au-delà de son TTL), LE SYSTÈME NE DOIT plus le citer comme justification de contact (INV-2) ni le compter dans le score. `[EXISTE — isSignalFresh dans le scorer ; à étendre au moment de l'ENVOI : un signal frais à l'enrollment peut être périmé au step 4]`
- **M2-R5** — QUAND plusieurs signaux convergent sur un compte, LE SYSTÈME DOIT les composer (le score reflète la convergence, le brief cite les signaux composés). `[PARTIEL — bestMultiplierForCompany prend le MEILLEUR multiplicateur (signal-score-daily.ts:75-95), pas une composition multi-signaux]`
- **M2-R6** — LE SYSTÈME DOIT apprendre le poids des signaux par tenant depuis les outcomes réels (multiplicateurs), avec priors informés avant volume et échantillon minimal avant de faire confiance. `[EXISTE — getSignalMultipliers (signal-outcomes.ts:298), MIN_SAMPLE_SIZE 10, priors :61-93, opens exclus depuis PR #609]`

Edge cases : signal contradictoire (levée annoncée puis démentie) — l'upsert par type garde le plus récent ; deux signaux du même type à dates différentes (le plus frais gagne — record-signal.ts) ; compte sans aucun signal (score plancher, jamais 0 arbitraire, et INÉLIGIBLE à l'outreach par INV-2) ; source de signal en panne (le cron continue sur les autres sources, alerte opérateur).

## Module 3 — Moteur de décision IA

- **M3-R1** — QUAND un prospect est éligible (ICP + signal frais), LE SYSTÈME DOIT choisir la séquence par le trigger-signal et l'ICP (une séquence différente par why-now), avec fallback déterministe. `[EXISTE — lib/autopilot/sequence-router.ts:1-14 : pickIcpScopedSequence puis pickSequenceForSignal]`
- **M3-R2** — QUAND un prospect entre en séquence, LE SYSTÈME DOIT choisir le CANAL du premier touchpoint par prospect (email vs LinkedIn) selon la disponibilité des coordonnées, la force du signal et les patterns appris — pas uniquement par le template. `[ABSENT — le mix canal vient du template (lib/sequences/templates/types.ts:30)]`
- **M3-R3** — QUAND un envoi est planifié, LE SYSTÈME DOIT décider le TIMING par prospect (jour/heure) à partir du fuseau du prospect et des patterns appris, dans les fenêtres autorisées du tenant. `[ABSENT — fenêtres statiques par mailbox 08:00-18:00 + sendDays (inngest/email-send-worker.ts:253-254)]`
- **M3-R4** — QUAND un message est généré, LE SYSTÈME DOIT sélectionner explicitement l'angle de value prop parmi des angles concurrents et TRACER la décision (angle choisi, alternatives écartées, signal justifiant). `[PARTIEL — copy groundée par brief (prepare.ts) et traces agents (agent_traces) mais pas de sélection d'angle explicite tracée]`
- **M3-R5** — QUAND l'IA décide (enrollment, canal, timing, angle), LE SYSTÈME DOIT produire une explication en langage clair consultable dans l'UI (« pourquoi ce prospect, pourquoi ce message, quel signal »). `[PARTIEL — reasoning JSON strict de l'agent-reactor (lib/agent-reactor/decision-prompt.ts:20-33) mais pas de surface UI systématique]`
- **M3-R6** — QUAND une décision événementielle est requise (réponse, bounce, signal fort), LE SYSTÈME DOIT la prendre par le moteur de décision avec règles d'intensité (« a funding round may justify outreach, a single email open does not ») et confiance. `[EXISTE — decision-prompt.ts:20-33, 12 triggers ; l'heuristique email_opened est déjà no-action (__tests__/agent-reactor.test.ts:87)]`
- **M3-R7** — LE SYSTÈME NE DOIT JAMAIS utiliser un open comme déclencheur de décision (INV-7). `[PARTIEL — agent-reactor conforme ; up-next (api/home/up-next/route.ts:207) et cadence-branching (campaign-decision-engine.ts:52) à purger]`

Edge cases : prospect matchant DEUX triggers simultanés (priorité du signal le plus fort + trace du choix) ; aucune séquence ne matche le signal (fallback déterministe, jamais d'enrollment silencieusement raté) ; timing décidé tombant hors fenêtre tenant (report au prochain créneau, jamais d'envoi hors fenêtre) ; contact sans email mais avec LinkedIn (M3-R2 route LinkedIn au lieu d'échouer).

## Module 4 — Séquenceur & orchestration

- **M4-R1** — LE SYSTÈME DOIT modéliser l'état de chaque prospect en séquence ({active, paused(raison), completed, halted(raison)}) avec audit trail. `[EXISTE — lib/sequences/enrollment.ts:5-28, raisons replied|bounced|complained|unsubscribed|manual|deal_won]`
- **M4-R2** — QUAND une réponse (tout sentiment), un RDV pris, un opt-out ou un hard bounce survient, LE SYSTÈME DOIT arrêter automatiquement la séquence du prospect, idempotent, sur TOUS les canaux. `[EXISTE — pauseEnrollment + route.ts:59-66 (positive → halt) ; suppression cross-canal consommée par email ET LinkedIn (dispatch-step.ts:4-5)]`
- **M4-R3** — QUAND une condition observable survient (replied / clicked / bounced / connexion LinkedIn acceptée / délai écoulé), LE SYSTÈME DOIT permettre un branchement conditionnel DANS la séquence (variante de step suivant). Les opens ne sont PAS une condition de branchement autorisée (INV-7, décision founder : le vocabulaire du marché — LGM/Reply branchent sur opened — est explicitement rejeté). `[ABSENT — structure linéaire steps+delays ; les réactions vivent hors séquence dans l'agent-reactor]`
- **M4-R4** — QUAND un step multi-canal est dû, LE SYSTÈME DOIT le dispatcher par l'adaptateur du canal (email, linkedin_message, phone_task) avec les gates du canal. `[EXISTE — lib/sequence-dispatch/ + test dispatch.test.ts:52]`
- **M4-R5** — QUAND un signal fort survient en cours de séquence, LE SYSTÈME DOIT pouvoir accélérer la cadence ; QUAND une séquence se termine sans réponse, LE SYSTÈME DOIT recycler le prospect en nurture avec ré-entrée possible après délai. `[EXISTE — inngest/signal-accelerate-cadence.ts ; nurture-recycle.ts + index unique partiel (sequence_id,contact_id) WHERE status='active']`
- **M4-R6** — QUAND un step est dû mais que le signal justifiant la séquence est périmé (M2-R4), LE SYSTÈME DOIT suspendre le step et re-décider (continuer avec un nouvel angle, ou sortir proprement). `[ABSENT]`

Edge cases : réponse reçue ENTRE la génération et l'envoi du step suivant (l'arrêt doit gagner la course — vérifier l'ordre dans le worker) ; OOO (ne pas arrêter : reprendre au retour — l'intent ooo existe, lib/reply/classify.ts:9-13) ; bounce soft répété (3 softs = hard) ; prospect changeant d'entreprise en cours de séquence (signal job_change → halt + re-décision).

## Module 5 — Délivrabilité & quotas

- **M5-R1** — INV-1 (cap 100/j/tenant non contournable). LE SYSTÈME DOIT l'implémenter DANS `evaluateSend` (compteur atomique par tenant/jour calendaire, timezone tenant), s'appliquant à TOUS les modes y compris external-connected, AVANT les autres checks de volume. Les caps existants (20/j primary, 50/j mailbox, rampe warmup) restent des sous-plafonds. `[ABSENT — voir INV-1 ; précédent d'insertion : le rate limit tenant a été ajouté exactement là (#565)]`
- **M5-R2** — QUAND le cap tenant est atteint, LE SYSTÈME DOIT requeue (pas fail) les envois différables et l'afficher dans le cockpit (« quota atteint, reprise demain »). `[PARTIEL — le pattern requeue-pas-fail existe pour le rate limit (#565) ; l'affichage cockpit est à créer]`
- **M5-R3** — QUAND une nouvelle boîte d'envoi est connectée, LE SYSTÈME DOIT imposer une rampe de warm-up progressive avant d'atteindre son plafond nominal. `[PARTIEL — rampe 4 semaines 2→50/j (lib/campaign-engine/deliverability/warmup.ts:7-37) mais déclenchement opérateur admin uniquement (arc #392-399), non câblée automatiquement à la connexion]`
- **M5-R4** — LE SYSTÈME DOIT vérifier SPF/DKIM/DMARC par lookup DNS réel avant de rendre un domaine sendable, et exposer une checklist actionnable. `[EXISTE — lib/sending/identity/auth.ts + dns-auth-lookup.ts + api/deliverability/verify + page deliverability ; smtp_custom non vérifié = non sendable (capacity-source.ts:30-36)]`
- **M5-R5** — LE SYSTÈME DOIT monitorer bounces et plaintes spam avec les seuils 2026 (pause à 5% bounce / 0,3% spam Google / 0,1% Microsoft) et auto-pauser le tenant en dépassement, avec cool-off et reprise progressive. `[EXISTE — lib/deliverability/thresholds.ts:25-36 + inngest/deliverability-monitor.ts + guardTrippedForTenant dans evaluateSend]`
- **M5-R6** — QUAND plusieurs boîtes sont disponibles, LE SYSTÈME DOIT répartir les envois (rotation) en respectant le cap par boîte et la santé de chacune. `[EXISTE — round-robin sur capacité restante (email-send-worker.ts:264-282)]`
- **M5-R7** — LE SYSTÈME DOIT tester le placement inbox (seed lists) et monitorer les blacklists des domaines d'envoi, avec alertes. `[ABSENT — c'est le standard du camp exécution (Smartlead 400+ blacklists, Amplemarket spam tests hebdo) ; requis avant de revendiquer l'axe délivrabilité]`
- **M5-R8** — Tout email sortant DOIT porter le header List-Unsubscribe (RFC 8058, exigence bulk-sender Gmail/Yahoo). `[PARTIEL — flaggé P0-7 à l'audit du 21/06 pour le path worker ; à re-vérifier chemin par chemin]`

Edge cases : deux workers concurrents décrémentant le compteur tenant (atomicité DB, pas de compteur en mémoire) ; changement de timezone tenant (le « jour » ne se réinitialise pas deux fois) ; boîte déconnectée en cours de journée (sa capacité disparaît du round-robin sans bloquer les autres) ; cap tenant atteint pendant qu'un batch est en vol (les envois déjà evaluateSend-approuvés passent, le suivant requeue).

## Module 6 — Canal LinkedIn (deux modes, décision founder)

- **M6-R1** — PAR DÉFAUT, QUAND l'IA décide une action LinkedIn (visite, invitation, message), LE SYSTÈME DOIT la placer dans une FILE DE VALIDATION ; l'action ne part que sur validation humaine explicite (1 clic, raccourcis clavier, batch). `[ABSENT — le HITL actuel porte sur l'enrollment (lib/autopilot/enroll-decision.ts), pas sur chaque action ; l'infra d'exécution existe (dispatch-step.ts)]`
- **M6-R2** — QUAND l'utilisateur active le MODE AUTOMATIQUE pour son compte LinkedIn (activation par canal, par utilisateur), LE SYSTÈME DOIT afficher un avertissement explicite du risque CGU LinkedIn au moment de l'activation, exiger une confirmation, et journaliser l'activation. `[ABSENT — l'exécution directe existe (Unipile) mais sans opt-in explicite ni disclosure]`
- **M6-R3** — EN MODE AUTOMATIQUE, LE SYSTÈME DOIT conserver les quotas conservateurs NON RELEVABLES (20 connexions/j, 100 messages/j par siège) et la rampe d'échauffement dédiée. `[EXISTE — lib/sending/linkedin/limits.ts:14-15, capacity.ts:1-12 (connects 5→20, messages 20→100) ; le caractère non-relevable est à durcir (aujourd'hui défauts)]`
- **M6-R4** — LE SYSTÈME DOIT offrir une pause 1 clic du canal LinkedIn (globale, par séquence, par prospect), effective immédiatement pour les actions non encore parties. `[PARTIEL — pauseEnrollment par prospect existe ; pause canal globale/séquence à créer]`
- **M6-R5** — QUAND une action LinkedIn est due, LE SYSTÈME DOIT la faire passer par les mêmes garde-fous que l'email : suppression cross-canal, anti-collision, santé du siège, idempotence. `[PARTIEL — les briques existent et sont testées (dispatch-step.ts:1-12 : fail-close santé, suppression-22, anti-collision-14, warmup caps, idempotence) mais le seam est ORPHELIN : dispatchLinkedInStep/dispatchLinkedInAction ont zéro caller de production et l'adaptateur séquenceur est un stub tâche-manuelle ; aucune exécution live Unipile jamais vérifiée — câblage = T13a]`
- **M6-R6** — QUAND le compte LinkedIn de l'utilisateur est restreint ou déconnecté, LE SYSTÈME DOIT stopper toutes les actions du siège (fail-closed), notifier, et NE PAS basculer sur un autre siège. `[EXISTE — fail-closed si siège non connected (capacity.ts) ; jamais d'emprunt de siège (dispatch-step.ts)]`

Edge cases : invitation déjà envoyée manuellement par l'utilisateur (anti-collision doit dédupliquer) ; file de validation ignorée N jours (les actions périment avec leur signal — M2-R4 — et sortent de la file avec trace) ; bascule auto→validation en cours de séquence (les actions en file restent en file ; rien ne part rétroactivement) ; invitation acceptée mais message jamais validé (relance dans la file, pas d'auto-envoi en mode défaut).

## Module 7 — Gifting (MVP : tâche manuelle déclenchée par l'IA — décision founder)

- **M7-R1** — QUAND un compte à forte valeur (score/tier ICP) présente un signal de déclenchement configuré (ex. levée < 30 j), LE SYSTÈME DOIT créer une TÂCHE de gifting avec suggestion (type de cadeau, budget indicatif, message d'accompagnement groundé sur le signal) au lieu d'un envoi automatique. `[ABSENT — git grep gifting/reachdesk/alyce sur origin/main : zéro code produit, contenu docs seulement (lib/docs/steps/run.ts:471)]`
- **M7-R2** — QUAND la tâche de gifting est complétée (ou refusée), LE SYSTÈME DOIT tracker l'outcome comme un touchpoint de séquence (le gifting entre dans l'attribution M11). `[ABSENT]`
- **M7-R3** — LE SYSTÈME DOIT imposer un workflow d'approbation budget : pas de tâche de gifting au-dessus du budget par cadeau / budget mensuel configurés sans approbation explicite. `[ABSENT]`
- **M7-R4** — Le gifting DOIT être optionnel et OFF par défaut ; l'intégration provider (Reachdesk/Alyce) est HORS SCOPE v1 (itération suivante, derrière la même interface de tâche). `[ABSENT]`

Edge cases : adresse postale inconnue (la tâche le signale et propose la demande d'adresse en réponse à un échange positif, jamais de scraping d'adresse personnelle — RGPD) ; signal périmé avant exécution de la tâche (la tâche expire avec trace) ; budget mensuel épuisé (les nouvelles tâches sont créées en état « bloqué budget »).

## Module 8 — Prise de RDV & détection de réponses

- **M8-R1** — QUAND une réponse arrive, LE SYSTÈME DOIT la classifier {positif, négatif, objection, pas-maintenant, OOO, désinscription} avec score de confiance. `[PARTIEL — Sentiment+Intent+confiance existent (lib/reply/classify.ts:9-13 : interested|not_now|referral|opt_out|ooo) mais « objection » n'est pas un intent routable de premier niveau (seulement objectionDetail dans le handler)]`
- **M8-R2** — QUAND la confiance de classification est sous le seuil, LE SYSTÈME DOIT router la réponse en file de revue humaine ; la correction humaine DOIT être persistée comme donnée d'entraînement (M12). `[ABSENT — la basse confiance n'est pas traitée comme sûre (reply.test.ts:47-59) mais aucune file de revue + correction-comme-donnée]`
- **M8-R3** — QUAND une réponse est positive, LE SYSTÈME DOIT arrêter la séquence, créer le hot-lead, et proposer des créneaux de RDV réels (calendrier connecté) dans le draft de réponse. `[EXISTE — route.ts:59-66 (positive → hot-lead + halt) ; slots injectés (inngest/reply-handler.ts + lib/integrations/meeting-booking)]`
- **M8-R4** — QUAND un RDV est pris, LE SYSTÈME DOIT persister l'événement `meeting_booked` (outcome) et arrêter toute séquence active du prospect ; QUAND le RDV est honoré, LE SYSTÈME DOIT persister `meeting_held` (signal ultime, M11). `[PARTIEL — booking + invite states existent (#582, #493) ET le tracking d'attendance held/no_show EXISTE déjà (PR #270, resolveAttendance — l'audit initial l'avait raté ; il n'existe pas de table meetings, les meetings vivent en activities + fetch calendrier) ; le gap réel est le PRODUCTEUR d'outcomes : meeting_booked n'est jamais résolu sur le watcher à la prise de RDV, et meeting_held (POSITIVITY posée par PR #609) n'est pas câblé à resolveAttendance — T12]`
- **M8-R5** — QUAND la réponse est un OOO avec date de retour, LE SYSTÈME DOIT suspendre et reprendre la séquence au retour. `[EXISTE — branche ooo dédiée (route.ts)]`
- **M8-R6** — La poursuite de séquence DOIT continuer jusqu'au RDV pris, à la réponse, à l'opt-out ou au bounce — jamais au-delà. `[EXISTE — M4-R2]`

Edge cases : réponse d'une AUTRE personne que le destinataire (assistant, collègue — classifier sur le thread, référer au signal referral existant) ; réponse positive puis no-show (meeting_booked sans meeting_held — la différence est exactement le signal que M11 doit capturer) ; désinscription formulée en langage naturel (« plus de mails svp ») — la classification opt_out DOIT alimenter la suppression cross-canal ; deux réponses contradictoires du même prospect (la plus récente gagne).

## Module 9 — Conformité RGPD

- **M9-R1** — LE SYSTÈME DOIT opérer sous base légale intérêt légitime pour le B2B, avec gate lawful-basis ACTIF au transport. `[PARTIEL — gate construit (lib/compliance/lawful-basis/db-gate.ts) mais flag OFF, backfill d'audience non fait]`
- **M9-R2** — Tout email d'outreach DOIT contenir une mention de désinscription fonctionnelle ; l'opt-out DOIT être appliqué cross-canal (email + LinkedIn) immédiatement et définitivement. `[PARTIEL — suppression cross-canal typée + consommée aux deux dispatch (spec 22 ; sending-gate.ts, dispatch-step.ts:4-5) ; la présence de la mention dans CHAQUE template doit devenir structurelle (M13-G5), pas conventionnelle]`
- **M9-R3** — QUAND une demande DSAR arrive (accès, effacement, portabilité), LE SYSTÈME DOIT l'exécuter (export/erase avec ré-entrée bloquée) sous 30 jours. `[EXISTE — lib/compliance/dsar/*, api/gdpr/{delete,erase,export} (requireAdmin), db-erase.ts:7 (anti-ré-entrée)]`
- **M9-R4** — LE SYSTÈME DOIT purger les données selon la politique de rétention (30 j après clôture de compte) par job planifié. `[EXISTE — inngest/data-retention.ts:1-19]`
- **M9-R5** — LE SYSTÈME DOIT maintenir un registre des traitements consultable (finalités, catégories de données, durées, sous-traitants). `[ABSENT — seule trace : une ligne dans la page légale]`
- **M9-R6** — QUAND des données servent l'apprentissage cross-tenant (M12 palier 3), LE SYSTÈME DOIT les anonymiser (PII strippée) et le documenter au registre. `[PARTIEL — la distillation strippe la PII (lib/distillation/pipeline.ts:1-13) ; registre absent]`

Edge cases : opt-out reçu APRÈS planification d'un step (le gate transport re-vérifie à T-0 — c'est le cas aujourd'hui, fail-closed) ; DSAR d'un contact présent chez PLUSIEURS tenants (isolation tenant stricte, effacement par tenant) ; contact effacé puis ré-importé par CSV (la suppression doit gagner — anti-ré-entrée existante).

## Module 10 — UI conforme charte

- **M10-R1** — Toute UI du système DOIT consommer les tokens de `globals.css` (@theme + :root/.dark) documentés dans `_harness/design-language.md` (resynchronisée 02/07 : light « Clear Mode » défaut, accent #2C6BED/#60A5FA, header 44px/contrôles h-7, rows 44px). `[EXISTE — le produit consomme déjà ces tokens ; la charte doc est à jour]`
- **M10-R2** — AUCUN écran ne DOIT être implémenté s'il ne correspond pas à un parcours défini dans `specs/ux.md` (Phase 1bis) ; tout compromis UX imposé par la technique DOIT être signalé avant arbitrage. `[À VENIR — dépend de la Phase 1bis]`
- **M10-R3** — Les templates de messages DOIVENT respecter les règles éditoriales baseline : aucun emoji, pas d'em-dash, vouvoiement FR B2B, produit anglophone par défaut. `[PARTIEL — règles documentées (design-language.md §éditorial, spec 18) ; l'enforcement automatique appartient au gate G4 (brandViolations dans le QC gate spec-20, non câblé)]`

## Module 11 — Définition du succès & taxonomie des outcomes

- **M11-R1** — LE SYSTÈME DOIT persister chaque outcome outbound selon la hiérarchie ordinale cible : bounce/opt-out/plainte (négatif fort) < aucune réponse < réponse négative < réponse neutre/plus-tard < réponse positive < RDV pris < RDV honoré (signal ultime). `[PARTIEL — POSITIVITY corrigée pour meeting_held(1.0) > meeting_booked(0.95) > replied_positive(0.9) (PR #609) ; DIVERGENCE restante assumée à trancher en design : replied_negative (-0.3) < no_response (0.0) dans le code alors que la cible ordonne l'inverse — le re-scaling touche les consommateurs de positivity (learned-trust.ts:126-131, stats.ts) et mérite la Phase 2, pas un hotfix]`
- **M11-R2** — LE SYSTÈME NE DOIT JAMAIS utiliser le taux d'ouverture comme signal d'apprentissage ni comme métrique de succès affichée en premier ; les opens restent un diagnostic de délivrabilité. `[EXISTE — PR #609 : watcher non consommé par un open, prior neutre, attribution exclue + tests de régression ; reste l'inventaire des dashboards affichant l'open rate en premier (à faire en Phase 1bis)]`
- **M11-R3** — QUAND une réponse est classifiée (M8-R1), la classification, sa confiance, et l'éventuelle correction humaine DOIVENT être persistées comme événements d'apprentissage. `[PARTIEL — classification persistée ; correction humaine absente (M8-R2)]`
- **M11-R4** — QUAND un outcome survient, LE SYSTÈME DOIT l'attribuer : quel message de la séquence, quel canal, quel signal ont déclenché l'outcome (dernier touchpoint + fenêtre multi-touch). `[PARTIEL — watchers par action avec fenêtres 7-14 j (create-watcher.ts:4-30) = attribution dernier-touchpoint niveau action ; l'attribution message-de-séquence + multi-touch n'existe pas]`
- **M11-R5** — LE SYSTÈME DOIT permettre au tenant de configurer la pondération du succès (ex. RDV honoré vs volume de réponses) avec des défauts sains. `[ABSENT]`

## Module 12 — Boucle de self-improvement (l'unité d'apprentissage est la DÉCISION)

- **M12-R1 (palier 1, obligatoire dès le MVP)** — QUAND un message est envoyé, LE SYSTÈME DOIT persister un ENREGISTREMENT DE DÉCISION : features prospect (persona, secteur, taille, maturité), signal déclencheur + fraîcheur, angle de value prop choisi, features du message (longueur, type de CTA, ton), canal, timing, position dans la séquence — joint à l'outcome labellisé (M11). Sans ce dataset dès J1, les paliers 2-3 sont impossibles. `[ABSENT comme dataset — les briques existent (agent_traces, action-outcomes, signals) mais pas la table de décisions apprêtée pour l'apprentissage]`
- **M12-R2 (palier 1)** — LE SYSTÈME DOIT produire une analyse hebdomadaire de patterns AU NIVEAU DÉCISION (« les CTO de scale-ups contactés < 30 j après une levée avec l'angle X répondent 3× plus ») ET d'anti-patterns, injectée dans le prompt du moteur de décision. `[PARTIEL — le flywheel analyse et injecte au niveau MESSAGE (lib/evals/flywheel.ts:1-15 ; traced-ai.ts:90-308) ; le niveau décision n'existe pas]`
- **M12-R3 (palier 2, dès ~300-500 décisions)** — LE SYSTÈME DOIT expérimenter par bandits bayésiens sur les DIMENSIONS DE DÉCISION (angle par persona, timing post-signal, ordre des touchpoints), jamais au détriment de la pertinence pour un prospect donné. `[ABSENT — git grep bandit|thompson|epsilon : 0 occurrence]`
- **M12-R4 (palier 3, seuil à définir en design)** — LE SYSTÈME DOIT entraîner un modèle de scoring/reward prédisant la probabilité de réponse positive d'une paire (décision, brouillon), avec pipeline d'entraînement, éval offline (backtest sur historique), et rollback si dégradation. `[ABSENT — graine : lib/distillation/pipeline.ts (dataset PII-strippé) et lib/evals/personalization-backtest.ts]`
- **M12-R5** — LE SYSTÈME NE DOIT JAMAIS apprendre un pattern qui améliore les réponses en dégradant la délivrabilité ou la marque ; le monitoring de dérive et la séparation train/test sont obligatoires. `[PARTIEL — les guardrails délivrabilité existent en aval ; aucune contrainte structurelle côté apprentissage]`
- **M12-R6** — Les insights appris DOIVENT être exposés à l'utilisateur en langage clair dans l'UI (INV-9) — c'est le différenciateur n°1 identifié au benchmark (aucun des 8 concurrents ne le fait). `[ABSENT comme surface UI]`

Edge cases : cold-start (0 outcome — priors informés + patterns cross-tenant anonymisés, jamais de multiplicateur appris sous MIN_SAMPLE) ; tenant au comportement atypique (l'apprentissage tenant prime sur le cross-tenant) ; boucle de renforcement (un pattern appris qui augmente le volume vers un segment dégrade la délivrabilité → M12-R5 doit le bloquer).

## Module 13 — Qualité chirurgicale : 5 quality gates bloquants

Principe : *ne rien envoyer vaut toujours mieux qu'envoyer un message moyen*. Pipeline séquentiel à états explicites (`en_attente → gate_1..5 → approuvé | bloqué | en_retravail`), rubriques versionnées, seuils calibrés sur golden set. `[ABSENT comme pipeline à états ; briques listées par gate ci-dessous]`

- **M13-G1 (ciblage)** — QUAND un prospect est candidat à l'enrollment (autopilot, chat, manuel), LE SYSTÈME DOIT vérifier : score ICP ≥ seuil ET ≥ 1 signal frais et vérifiable justifiant le contact MAINTENANT. Échec = pas d'enrollment, avec raison loggée. `[PARTIEL — l'autopilot sélectionne signal-ranked (run.ts) mais le gate n'est pas opposable aux enrollments manuels/chat ; SAFE_MODE targeting au transport est flag-OFF]`
- **M13-G2 (vérification factuelle)** — QUAND un message contient des affirmations sur le prospect, CHACUNE DOIT être vérifiée contre sa donnée source datée ; toute affirmation invérifiable DOIT être supprimée du message. Zéro hallucination tolérée. `[PARTIEL — fabrication-gate 2 couches + regenerate-sans-les-claims (fabrication-gate.ts:1-22, sequence-generator.ts:11) + citation-gate T-0 (sequence-drafts/citations.ts, unique sur le marché audité) ; MAIS seulement sur certains chemins de génération, jamais au transport, et les envois manuels ne le traversent pas (violation INV-10)]`
- **M13-G3 (interchangeabilité)** — QUAND un message est évalué, LE SYSTÈME DOIT le faire échouer au « test d'interchangeabilité » s'il pourrait être envoyé tel quel à un autre prospect : le lien signal → problème probable → value prop doit être spécifique à CE prospect MAINTENANT. `[PARTIEL — personalization-judge évalue le grounding des claims, pas l'interchangeabilité explicitement]`
- **M13-G4 (score rédactionnel)** — QUAND un message passe G3, LE SYSTÈME DOIT le scorer par LLM juge sur rubrique explicite (pertinence de l'angle, concision, une seule idée, CTA faible friction, ton charte, zéro cliché outbound) ; sous le seuil : régénération (max N) puis mise de côté avec explication. `[PARTIEL — graders composites existent (email-quality-grader.ts, sequence-quality.ts) ; seuils non centralisés, pas de « max N puis mise de côté » systématique]`
- **M13-G5 (sécurité délivrabilité)** — AVANT tout envoi, LE SYSTÈME DOIT vérifier : spam-words, ratio texte/liens, mention désinscription présente, réputation du domaine du jour, quotas et warm-up. `[PARTIEL — quotas/réputation/warmup au transport (evaluateSend) ; spam-words/ratio-liens/brand existent DANS le QC gate spec-20 (runQc/sendEligible, lib/copy/variants/qc.ts) construit, testé, 0 call-site]`
- **M13-R6** — CHAQUE gate DOIT logger sa décision et son score ; ces logs alimentent M12 et sont VISIBLES dans l'UI (pourquoi un message a été bloqué ou envoyé — la rigueur est une feature visible). `[ABSENT comme surface ; traces partielles (agent_traces, reasons d'evaluateSend)]`
- **M13-R7** — LE SYSTÈME DOIT exposer le taux de blocage par gate comme métrique de pilotage (trop bas = gates laxistes ; trop haut = ciblage amont défaillant). `[ABSENT]`
- **M13-R8** — Les envois manuels depuis l'UI DOIVENT traverser au minimum G2 + G5 (INV-10). `[ABSENT — les chemins interactifs ne passent que evaluateSend (destinataire/quota)]`

Edge cases : gate LLM en panne (fail-closed : bloqué, jamais approuvé par défaut) ; latence cumulée des gates > fenêtre d'envoi (pipeline asynchrone : les gates tournent à la génération+approbation, seuls G5 + re-vérification T-0 des citations au transport) ; message retravaillé N fois sans passer G4 (mise de côté définitive avec explication, JAMAIS d'envoi dégradé) ; golden set non annoté (seuils par défaut conservateurs jusqu'à calibration).

---

## Récapitulatif des gaps (ce que la Phase 2 doit designer)

| Priorité | Gap | Exigences | État |
|---|---|---|---|
| P0 | Cap 100/j/tenant dans evaluateSend, tous modes | INV-1, M5-R1, M5-R2 | ABSENT (point d'insertion prêt) |
| P0 | Gates de contenu au transport + QC spec-20 câblé + manuel G2/G5 | INV-10, M13-G2/G5, M13-R8 | PARTIEL (câblage dominant) |
| P0 | Decision-record palier 1 (dataset d'apprentissage) | M12-R1, INV-6 | ABSENT |
| P1 | File de validation LinkedIn par action + mode auto opt-in disclosure | M6-R1, M6-R2 | ABSENT (infra d'exécution prête) |
| P1 | Pipeline gates à états + logs UI + taux de blocage | M13 préambule, R6, R7 | ABSENT |
| P1 | Purge des opens décisionnels restants (cadence-branching, up-next) | INV-7, M3-R7 | 2 sites identifiés |
| P1 | Vérifieur email mailbox-level + politique risky/catch-all | M1-R3, M1-R4 | ABSENT (interface prête) |
| P1 | Revue humaine des classifications incertaines + correction=donnée + intent « objection » routable | M8-R1, M8-R2, M11-R3 | ABSENT |
| P2 | Décision IA canal + timing par prospect | M3-R2, M3-R3 | ABSENT |
| P2 | Branchements conditionnels in-sequence (sans opens) | M4-R3, M4-R6 | ABSENT |
| P2 | Placement tests + blacklist monitoring | M5-R7 | ABSENT |
| P2 | Gifting tâche manuelle IA | M7 | ABSENT (greenfield) |
| P2 | Producteurs d'outcomes meeting_booked/meeting_held (l'attendance existe, PR #270) | M8-R4 | PARTIEL |
| P2 | Pondération du succès configurable par tenant (défauts sains) | M11-R5 | ABSENT |
| P3 | Hiérarchie ordinale replied_negative/no_response — encodée à l'agrégation, POSITIVITY non re-scalée (décision 02/07) | M11-R1 | DÉCIDÉ v1 |
| P3 | Attribution multi-touch fenêtrée — hors-scope v1 assumé (last-touch via watcher) | M11-R4 | FLAGGÉ |
| P2 | Insights appris exposés dans l'UI | M12-R6, INV-9 | ABSENT |
| P3 | Bandits (palier 2) puis reward model (palier 3) | M12-R3, M12-R4 | ABSENT (gated sur volume) |
| P3 | Table signals normalisée + decay graduel + composition | M2-R2, M2-R3, M2-R5 | PARTIEL |
| P3 | Registre des traitements + lawful-basis ON | M9-R1, M9-R5 | PARTIEL |
