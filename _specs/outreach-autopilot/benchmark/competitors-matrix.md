# Benchmark concurrentiel — outreach multi-canal autopilote (Phase 0)

Date : 2026-07-01 (captures) / 2026-07-02 (synthèse). Périmètre : pages publiques uniquement, aucune authentification.
Méthode : 8 agents Playwright (Chromium headless dédié par concurrent, UA Chrome 131, 1440x900) + 1 agent de distillation de la recherche interne (26-27/06) + 1 audit brownfield du code Elevay sur `origin/main`.

Preuves sur disque :
- 68 screenshots : `benchmark/screenshots/<concurrent>/NNN-*.png`
- 69 pages HTML brutes : `benchmark/html/<concurrent>/`
- 8 fiches détaillées : `benchmark/raw/<concurrent>.md` (chaque affirmation y est adossée à un screenshot ou une URL)
- Recherche antérieure distillée : `benchmark/raw/prior-research.md`
- Capability map Elevay : `benchmark/raw/elevay-existing.md`

Incident de capture : Reply.io a un Cloudflare actif (challenge après ~2 pages en headless) ; repris en Chrome headed, 8/8 pages capturées. Aucun autre blocage.

---

## 1. Lecture du paysage — trois archétypes

Le marché s'est trié en trois couches. Aucun acteur ne couvre les trois avec profondeur.

**A. Rails d'exécution + délivrabilité** — Smartlead, Reply.io (infra), lemlist (lemwarm).
La délivrabilité est un pilier de vente de premier niveau : warmup inclus par boîte (Reply : « Free with every mailbox », `raw/replyio.md` §7), pools de warmup tiérés et monétisés (Smartlead Ultra Premium, add-on 59 $/mois — `raw/smartlead.md` §2), achat de domaines/mailboxes dans le produit avec DNS auto (Reply, Smartlead, lemlist), tests de placement sur seed lists + 400+ blacklists (SmartDelivery, `raw/smartlead.md` §4), Domain Health Center SPF/DKIM/DMARC avec spam tests hebdomadaires (Amplemarket, `raw/amplemarket.md`). Le modèle économique est structurellement volume : mailboxes illimitées, paliers à 100 000+ envois/mois.

**B. Couche data/orchestration** — Clay ($5B, "100M ARR" affirmé).
Pas un outil d'outreach : une infrastructure ("Build systems to grow revenue") opérée par un expert « GTM engineer ». Waterfall 150+ providers, Claygent (agent web multi-hop), signaux custom depuis n'importe quelle donnée. Le mot « autopilot » n'apparaît sur aucune page capturée (`raw/clay.md` §6). Sequencer natif récent mais délivrabilité traitée en une phrase.

**C. Couche décision / agents** — Monaco, Actively AI, et les agents des plateformes (Duo, Jason, lemAgent).
Le produit vendu est la décision : quel compte, pourquoi maintenant, quoi écrire. Actively ne possède ni séquenceur ni délivrabilité — ils vendent le raisonnement et laissent l'envoi au stack du client (`raw/actively.md`, "Lecture Elevay"). Monaco vend le système tout-en-un anti-CRM avec un humain embarqué (« forward deployed sales executive », `raw/monaco.md` §2). Pattern dominant : HITL marketé comme feature de confiance — « Nothing goes out without your sign-off » (lemAgent), « Approval mode » (Jason), « You review and send » (Actively), boutons Reject/Start (Monaco).

Convergence 2026 remarquable : la distribution AI-native est devenue table stakes. 6 des 8 concurrents exposent un MCP server public (lemlist, LGM, Reply, Amplemarket, Clay, Actively) ; lemlist et Amplemarket font du SEO pour les réponses des LLM (pages /ai/claude, « Structured data for LLMs »).

---

## 2. Matrice de features

Légende : NATIF = feature première partie documentée ; PARTIEL = existe avec restriction notable ; ADD-ON = payant en sus ; TIERS = délégué à un partenaire ; ND = non documenté sur le site public. Sources : `raw/<slug>.md` (chaque cellule y est détaillée avec screenshot).

| Catégorie | Monaco | Lemlist | LGM | Clay | Amplemarket | Reply.io | Smartlead | Actively |
|---|---|---|---|---|---|---|---|---|
| TAM / ingestion | NATIF — TAM pré-construit day 1 par Monaco (« billions of data points » + historique email client) | NATIF — base 650M+, recherche NL via lemAgent | NATIF — 27M+ companies, lookalike | NATIF — cœur du produit, Audiences (lancé le 01/07) | NATIF — Searcher, base propriétaire | TIERS — 1B+ contacts « Powered by Generect » | PARTIEL — SmartProspect (leads gagnés : 3 emails envoyés = 1 lead) | ND — contexte TAM maintenu depuis le CRM client |
| Enrichissement | NATIF — auto-enrichment continu | NATIF — waterfall 25+ providers, pay-per-success (email 0,05 €) | NATIF — waterfall 9 providers nommés + double vérification | NATIF — waterfall 150+ providers, LE cœur | NATIF | NATIF + extensions Chrome | TIERS — délégué à Clay (partenariat) | ND |
| Signaux / intent | NATIF — signaux custom en langage naturel, colonnes Oui/Non avec Reasoning+Sources | NATIF — 6 types + custom (« scan the web daily »), payés au signal (0,20-4 €) | NATIF — 12 signaux dès Pro | NATIF — signal depuis n'importe quel enrichissement ; recettes clients (bail de bureaux, badge SOC2) | NATIF — catalogue 20+ signaux (Slack, G2, CRM, produit, web) | NATIF — hiring, tech, growth, LinkedIn | PARTIEL — une phrase, zéro détail | NATIF — détection par agent (funding, VP arrivé, champion parti) |
| Décision IA (qui/quand/canal) | NATIF — « Autopilot — Monaco decides who to enroll, when to start, and how to follow up » | PARTIEL — lemAgent construit, signal peut auto-enrôler ; l'humain valide | ND — l'humain configure ; l'intelligence est déléguée à Claude via MCP | PARTIEL — Sculptor conseille « who to prioritize, when and how » ; pas d'autopilot | NATIF — Duo scanne le marché quotidiennement, feed de recos ; copilot only | NATIF — Jason : autopilot & copilot, choix du canal par l'IA | PARTIEL — SmartAgents = orchestration ops (alertes, sync), pas décision | NATIF — LE produit : Per-Account Agents 24/7, raisonnement exposé |
| Personnalisation | PARTIEL — « Contextual relevance », profondeur non documentée | NATIF — recherche par lead, variables IA, clonage de voix | PARTIEL — Magic Messages, voice notes IA | NATIF — « entire email custom instead of just one field » | NATIF — Duo Copywriter | NATIF — AI Variables + sources liées par message (vérifiables) | PARTIEL — SmartAI Bot ; hyper-perso déléguée à Clay | NATIF — draft + « why now » écrit par compte |
| Séquenceur | NATIF — timeline verticale, waits explicites, pré-construit par Monaco | NATIF — conditions, A/B full-séquence, 37k templates communautaires | NATIF — drag & drop, vocabulaire de conditions le plus riche du panel | NATIF — récent, dès plan Free | NATIF — étapes conditionnelles temps réel | NATIF — conditionnel multicanal | NATIF — subsequences par intent | ND — pousse vers le séquenceur du client |
| LinkedIn outreach | ND — touches LinkedIn trackées dans l'UI (014), pas d'automatisation vendue | NATIF — visites, invitations, messages, voice notes clonées | NATIF — cœur historique, full-auto cloud + proxies mobiles 4G/5G dédiés | ND — source de signaux et destination Ads seulement | NATIF — social prospecting/automation | ADD-ON — 69 $/mois/compte, full-auto (invitations, InMails, voice IA) | TIERS — push vers outil LinkedIn externe | ND |
| Gifting | NATIF (UI) — étape cadeau physique native dans le sequencer (Veuve Clicquot, 011-app-ui-execute-sequences.png) ; jamais mentionné dans le texte marketing | TIERS — via API Sendoso/Handwrytten | ND | ND | ND | ND | ND | ND |
| Délivrabilité | ND — 0 occurrence sur 8 pages (grep deliverability/warm-up/spam/bounce) | NATIF — lemwarm inclus, hub, rotation, Deliverability Boost pré-envoi | PARTIEL — inbox rotation ; PAS de warmup email documenté | PARTIEL — une phrase (« Built-in warming, alias management, domain rotation ») | NATIF — pilier de nav : Booster (warmup), Domain Health Center, spam checker, ratio outbox/inbox | NATIF — infra complète : achat domaines/boîtes, DNS auto, warmup P2P illimité inclus (MailToaster), 30+ features | NATIF — LA référence : pool privé invite-only, SmartServers dédiés, SmartDelivery (seed lists, 400+ blacklists), marketplace mailboxes | ND |
| Traitement des réponses | PARTIEL — « Every interaction catalogued », suggested reply | NATIF — inbox unifiée + intent/OOO detection + réponses IA | NATIF — inbox multicanal, qualification 1 clic (tags → Won/Lost) | PARTIEL — « reply flows » | NATIF — Unibox ; Duo Inbox (drafts) en ADD-ON sur Growth | NATIF — Jason répond seul (mode auto) ou sur approbation | NATIF — Master Inbox, catégorisation entraînable | ND |
| Prise de RDV | ND — « generating new meetings » affirmé, mécanisme non documenté | ND | ND | ND | ND | NATIF — scheduler dans les séquences, Google Calendar, anti double-booking | PARTIEL — route vers « booking calendars » (leur propre démo = cal.com) | ND — briefs de meeting, pas de booking |
| Boucle d'apprentissage | OPAQUE — « improved over time » ; contractuellement le cross-client est permis (« Service Information », terms) mais jamais exposé | PARTIEL — mémoires lemAgent visibles/éditables ; pas de boucle outcome documentée | ND — « You optimize on gut feel » admis sur leur page MCP | ND — itération manuelle outillée (versions, rollback) | LA PLUS DOCUMENTÉE — 4 mécanismes nommés : apprend des dismiss (avec raison), propagation équipe, adaptation aux edits, HITL | PARTIEL — « AI-trained responses » sans explication | PARTIEL — claims génériques sans mécanisme | AFFIRMÉE partout, détaillée nulle part ; fine-tuning par client cité |
| RGPD / conformité | RIEN — 0 mention GDPR ; données « anywhere in the world » ; revente de Leads Data ; opt-out par email au CEO ; SOC 2 Type I | Badge « GDPR Compliant » + SOC 2 + DPA ; détails ND | Claims RGPD répétés + DPA ; pas de SOC2 ; CGU LinkedIn violées ET admises (« LinkedIn does explicitly forbid… ») | SOC 2 Type II + GDPR + CCPA + ISO 27001 + ISO 42001 | La plus argumentée : page GDPR commerciale, intérêt légitime, geo-fencing EU, exclusion lists auto (ML), footnote légale auto, SOC 2 Type II | DPO nommée, DPA électronique, formulaires de droits ; MAIS trust page citant encore le Privacy Shield (invalidé 2020) | Une phrase GDPR en FAQ ; pas de SOC2 trouvé | SOC 2 Type II, DPA EU, GCP/BigQuery |
| Pricing | Non public — /pricing = 404, « Request demo », Order Form négocié | 55-87 €/mois + crédits pay-per-success ; signaux payés à l'unité | 50-150 €/mois par « identité » ; répondants gratuits | Double compteur actions + data credits ; Free → $446/mo → custom ; top-ups +30% | $600/mois (2 users, annuel) puis custom | Actifs contacts : $49/mois (email) à $500-3000/mois (Jason = 10x le self-serve) | $32-315/mois au volume d'envoi ; toute la chaîne délivrabilité en add-ons | Non public — /pricing = 404, enterprise sales-led |

Faits saillants de la matrice :
1. **Personne ne couvre tout.** Les rails d'exécution n'ont pas de décision IA profonde ; les couches de décision (Monaco, Actively) n'ont pas de délivrabilité documentée ; Clay n'a pas d'autopilot.
2. **Le gifting natif n'existe que chez Monaco** — et uniquement dans leurs screenshots d'app, jamais dans leur texte marketing.
3. **La prise de RDV native n'existe vraiment que chez Reply.io.** C'est le trou le plus constant du panel.
4. **Le LinkedIn full-auto est la norme chez ceux qui le font** (LGM, Reply, lemlist, Amplemarket) — aucun ne propose de mode semi-auto « l'humain valide chaque action » ; LGM admet verbatim que LinkedIn interdit leurs outils et vend la furtivité (proxies mobiles dédiés).
5. **L'apprentissage niveau DÉCISION n'est occupé par personne.** Amplemarket apprend des préférences (dismiss/edits), Actively l'affirme sans le montrer, Monaco le cache. Aucun ne documente « quel persona × quel signal × quel angle × quel timing produit des RDV » exposé à l'utilisateur.

---

## 3. Patterns UX récurrents

### Builder de séquences
- **Timeline verticale à étapes numérotées + waits explicites** (« Wait 3 business days ») : Monaco (011-app-ui-execute-sequences.png), pattern repris par tous.
- **Branches conditionnelles visuelles** : LGM a le vocabulaire le plus riche (email opened/clicked/replied, connexion acceptée, profil re-visité, voice message répondu, « If Lead is already a relation » — `raw/lagrowthmachine.md` §sequencer) ; Reply et lemlist adaptent la séquence aux actions (« calling after no reply »).
- **Le builder devient l'OUTPUT d'un agent conversationnel** : lemAgent (« Your next campaign is one conversation away », campagne complète avec branching en <15 min), Duo (séquence par prospect), Jason (setup en 6 étapes), Sculptor. Le chat ne remplace pas le builder — il y débouche, et l'humain édite (« You are never locked into what it generates », lemlist FAQ).

### Scoring de signaux
- **Le pattern de référence est Monaco** : questions en langage naturel devenues colonnes Oui/Non de la table de comptes, popover « Reasoning | Sources » par cellule avec justification texte + cartes de sources à favicon (010-app-ui-overlay-signals.png — capture vérifiée). Score = grade lettre A/B + température « Burning », pas de score numérique.
- **Le signal comme carte pédagogique** : lemlist structure chaque signal en « What it means / Your move » ; Amplemarket matérialise le feed par un marquee de ~50 cartes-signaux concrètes (« Sam rated Competitor B 1-star on G2 »).
- **Le signal vendu par recette client** plutôt que par feature : Clay « Signals in the wild » (Density surveille l'expiration des baux de bureaux ; Vanta les postes CISO ouverts).

### Dashboards / cockpit
- **Le rituel du matin** : Monaco « Good morning, Sam » + « Your priorities today » (badge « Stalled 3 days », valeur $) ; Actively vend littéralement une « Day in the Life » (8:30am Scan → 11:00am Act → 2:00pm Review) et son Agent Inbox = « travail déjà fait au réveil, classé par urgence, avec le raisonnement visible ».
- **Feed de recommandations à 4 actions** : review / edit / regenerate / send (Duo).
- **L'IA toujours en contexte, jamais une page à part** : popover, panneau latéral, overlay de chat par-dessus le workspace (Monaco Ask AI) — constat du teardown antérieur confirmé (`raw/prior-research.md` §1.2).

### Confiance et contrôle (le pattern transversal)
- HITL affiché comme argument de vente chez 6/8 : approve/reject sous chaque contenu généré (Monaco), « Nothing goes out without your sign-off » (lemlist), « never sends without visibility » (Amplemarket), « Approval mode » (Reply), « You review and send » (Actively), write-actions à confirmation (LGM MCP).
- **Transparence des sources par message** : Reply/Jason (« direct links so you can verify everything »), Monaco (Reasoning+Sources). C'est la réponse du marché à la peur de l'hallucination.

### Pricing
- Unités de facturation divergentes : active contacts (Reply), identité automatisée (LGM — les humains qui répondent sont gratuits), crédits pay-per-success (lemlist — le signal est un consommable : 0,20 € la visite web, 1 € la levée), double compteur actions/data credits (Clay), volume d'envois (Smartlead).
- **L'agent est monétisé comme un employé** : Jason $500/mois pour un volume qui coûte $49 en self-serve (10x), comparé frontalement à un SDR à $8 000/mois.
- Les deux acteurs « décision » (Monaco, Actively) sont 100 % sales-led sans pricing public (/pricing = 404 chez les deux).

---

## 4. Deep-dive Monaco — et validation des prémisses du prompt maître

### Ce que Monaco est aujourd'hui (01/07/2026, site re-capturé)
- Positionnement : **« The first revenue engine for startups »** — plateforme AI-native qui remplace le CRM, en 6 étapes (Build TAM → Overlay signals → Execute sequences → Capture Activity → Track Pipeline → Ask Monaco). Cible : fondateurs sans background sales (Garry Tan, Peter Thiel, Ryan Petersen en social proof au-dessus du hero).
- La formule « right person, right company, right time, right message » **n'apparaît plus verbatim** ; le qualité-d'abord s'exprime par « prioritize who to reach out to, when, and why » et « Autopilot — without blasting your whole TAM » (002-product.png).
- **Humain embarqué confirmé et central** : « Each customer is paired with a forward deployed sales executive » ; le setup complet (TAM, scoring, signaux, séquences, pipeline) est fait PAR Monaco au day 1. Ils recrutent des « Forward-Deployed Account Executive » (page Ashby, `raw/prior-research.md` §1.2).
- Équipe : Sam Blond (ex-CRO Brex), CTO ex-Clari, CPO ex-Apollo — ils connaissent la donnée outbound de l'intérieur.
- Site vitrine minimal (7 pages), pas de pricing, pas de blog : toute la conviction passe par la démo.

### Les 4 axes de différenciation du prompt, confrontés aux preuves

| Prémisse du prompt maître | Verdict | Preuve |
|---|---|---|
| « Profondeur de délivrabilité (leur angle mort documenté) » | **CONFIRMÉ au 01/07** — mais à double tranchant | grep sur les 8 pages HTML : 0 occurrence de deliverability/warm-up/domain/spam/bounce/inbox placement (`raw/monaco.md` §4). ATTENTION : c'est un différenciateur vs Monaco uniquement — pour Smartlead/Reply/Amplemarket c'est le cœur de gamme. La profondeur délivrabilité est table stakes du camp exécution, pas un moat de marché. |
| « Multi-canal LinkedIn + gifting (ils sont email-only) » | **PARTIELLEMENT FAUX** | Le gifting est NATIF chez Monaco : étape cadeau physique dans leur sequencer (bouteille Veuve Clicquot, « Hi Alex - congrats on the recent fundraise! », 011-app-ui-execute-sequences.png). Les touches LinkedIn sont trackées dans leur UI (« Linkedin · 3 days ago », 014). Ce qui reste vrai : ils ne vendent PAS d'automatisation LinkedIn sortante. L'axe survivant est plus précis : LinkedIn semi-auto conforme CGU — différenciant à la fois vs Monaco (rien) ET vs LGM/Reply/lemlist (full-auto en violation CGU assumée — LGM écrit : « LinkedIn does explicitly forbid the use of tools that perform automated actions », `raw/lagrowthmachine.md` §5). |
| « Conformité RGPD native pour l'Europe » | **CONFIRMÉ vs Monaco, à préciser vs le marché** | Monaco : zéro mention GDPR, transferts « anywhere in the world », revente de Leads Data à des clients (« including in exchange for monetary consideration »), opt-out par email au CEO, conformité marketing intégralement reportée sur le client (`raw/monaco.md` §7). MAIS Amplemarket a une vraie doctrine publique (intérêt légitime, geo-fencing EU, exclusion lists auto-alimentées par ML) et Clay affiche SOC2 II + ISO 27001 + ISO 42001. Le gap réel du marché : personne ne fait de la conformité un MÉCANISME produit vérifiable (opt-out cross-canal, purge, registre) — c'est du badge + DPA. |
| « Boucle d'apprentissage transparente (vs boîte noire + humain embarqué) » | **CONFIRMÉ** — et c'est le gap le plus net du panel | Monaco : seule allusion « improved over time » ; leurs terms s'octroient les « Service Information » (données dérivées dé-identifiées) sans jamais exposer l'apprentissage comme feature. Le seul concurrent qui documente sa boucle est Amplemarket (4 mécanismes : dismiss-reasons, propagation, adaptation aux edits, HITL) — mais c'est de l'apprentissage de PRÉFÉRENCES, pas d'OUTCOMES. Personne n'expose « ce que le système a appris de vos résultats » dans l'UI. |

### Alerte naming (à trancher hors benchmark)
Le headline de Monaco est **« The first revenue engine for startups »**. « Revenue engine » est exactement le terme retenu en interne pour Elevay (directive du 25/06 : « revenue engine, jamais sales engine »). Collision frontale de positionnement verbal avec le concurrent de référence — à arbitrer avant tout copy public.

---

## 5. Ancrage brownfield — ce qui existe déjà dans Elevay (origin/main `79731970`)

Audit du 02/07/2026, chaque verdict cité file:line vérifié sur origin/main (détail complet : `raw/elevay-existing.md`). Chemins relatifs à `app/apps/web/src/lib/` sauf mention contraire.

| # | Module (vision du prompt maître) | Verdict | Preuve pivot | Gap principal vs la cible |
|---|---|---|---|---|
| 1 | Ingestion TAM & enrichissement | EXISTE | `icp/*`, `dedup/*`, `enrichment/field/waterfall.ts` | vérification email = domaine/MX seulement ; le vérifieur mailbox payant est « slotted in » mais absent (`mx-verify-provider.ts:6`) |
| 2 | Moteur de signaux | EXISTE | `record-signal.ts:94`, `signal-score-daily.ts`, `freshness.ts:31,81` | signaux en JSONB non normalisé, ≥6 taxonomies concurrentes, decay binaire frais/périmé (pas de décroissance graduelle) |
| 3 | Moteur de décision IA | PARTIEL | `autopilot/run.ts:1-13`, `sequence-router.ts:1-14`, `agent-reactor/decision-prompt.ts:20-33` | le timing (fenêtres statiques 08:00-18:00, `email-send-worker.ts:253-254`) et le canal (fixé par le template) ne sont PAS décidés par l'IA par prospect |
| 4 | Séquenceur & arrêts automatiques | EXISTE | `enrollment.ts:5-28` (arrêts : replied/bounced/complained/unsubscribed/deal_won), `templates/types.ts:30` (steps email/linkedin/phone) | pas de branchements conditionnels in-sequence (le vocabulaire LGM/Reply n'existe pas) |
| 5 | Délivrabilité & quotas | PARTIEL | `sending-gate.ts:214` (fail-closed, 5 chokepoints), `rate-limit.ts:104-109` (60/min, 600/h tenant), `outbound.ts:367` | **aucun cap 100/j/compte non contournable** : 20/j primary-only (`sending-identity.ts:95-107`), 50/j/mailbox = colonne DB configurable, et le mode `external-connected` n'est pas gated en volume (`:115-124` — « they're the provider's concern ») |
| 6 | LinkedIn semi-automatique | PARTIEL | `dispatch-step.ts:1-12`, `limits.ts:14-15` (20 connects/j, 100 msgs/j), `capacity.ts:1-12` (rampe) | l'infra pilote le compte DIRECTEMENT via Unipile ; le HITL est à l'enrollment, pas de file de validation par action — **conflit frontal avec la vision 5 du prompt** (semi-auto conforme CGU) |
| 7 | Gifting | ABSENT | seule occurrence = contenu docs (`docs/steps/run.ts:471`) | tout à construire |
| 8 | RDV & classification des réponses | EXISTE | `reply/classify.ts:9-13` (sentiment+intent+confiance), `route.ts:59-66` (positive → hot-lead + halt), `reply-handler.ts` (slots de meeting injectés) | pas de classe « objection » routable ; pas de revue humaine des cas à faible confiance |
| 9 | RGPD | PARTIEL | `compliance/dsar/*`, `api/gdpr/{delete,erase,export}`, `data-retention.ts` (purge 30 j), suppression cross-canal (spec 22) | lawful-basis gate OFF (backfill non fait) ; pas de registre des traitements |
| 10 | UI charte | EXISTE* | `globals.css:25` (44px conforme) MAIS `:74,95,257,275` | ***design-language.md est PÉRIMÉ*** : accent réel #2C6BED/#60A5FA ≠ #6366f1 documenté ; un light mode existe alors que la charte dit dark-only |
| 11 | Taxonomie outcomes & tracking | PARTIEL | `outcomes/resolve.ts:6-18`, `create-watcher.ts:4-30` | **l'open rate EST utilisé comme signal d'apprentissage** (`resolve.ts:12` poids 0,1 ; `signal-outcomes.ts:67` prior 1,15) — interdit par la cible ; hiérarchie inversée (meeting_booked 0,9 < replied_positive 1,0) ; l'outcome « RDV honoré » n'existe pas |
| 12 | Boucle self-improvement | PARTIEL | `flywheel.ts:1-15`, `traced-ai.ts:90-308` (seam getLearnedContext), `canary-ramp.ts`, `distillation/pipeline.ts` | bandits : 0 occurrence ; reward model : inexistant ; l'unité d'apprentissage actuelle = message/trace, pas la DÉCISION (persona × signal × angle × timing) |
| 13 | Quality gates bloquants | PARTIEL | `fabrication-gate.ts:1-22` câblé dans `sequence-generator.ts:11` ; `copy/variants/index.ts` | **zéro gate de contenu au transport** (`evaluateSend` ne vérifie que destinataire/quota) ; **le QC gate spec-20 (`runQc`/`sendEligible`, spam-links + brand checks) est construit et testé mais a 0 call-site** ; les envois manuels bypassent le gate factuel (G2) |

Synthèse brownfield en une phrase : **l'ossature des 13 modules existe à ~70 %, mais les pièces maîtresses de la vision (cap architectural, gates au transport, apprentissage niveau décision) sont soit de la config soit du code orphelin — le chantier dominant est du câblage et du durcissement, pas du build.** Le gifting (module 7) est le seul greenfield pur.

Acquis confirmés antérieurement et toujours valides (`raw/prior-research.md` §3) : citation-gate fail-closed à T-0 (unique sur le marché audité), contrat « jamais auto-send » structurel, inbox de réponses classe-leader, gate stack conformité fail-closed, hygiène de signaux anti-« tell of automation ».

---

## 6. Gaps / opportunités de différenciation

1. **L'apprentissage au niveau décision, exposé à l'utilisateur.** Inoccupé sur les 8 sites. Le prompt maître (module 12 : « l'unité d'apprentissage est la DÉCISION, pas le copy ») vise exactement ce vide. Amplemarket est le plus proche et n'apprend que des préférences du rep.
2. **La qualité comme contrainte architecturale visible.** Personne ne vend un pipeline de quality gates bloquants avec logs exposés (« pourquoi ce message a été bloqué »). Reply a une « triple verification » marketing d'une ligne. Un cap quotidien ASSUMÉ (« un jour à 12 envois excellents est un succès ») est un positionnement contre-courant crédible face à des concurrents structurellement volume (mailboxes illimitées partout) — et aligné avec les exigences bulk-sender Gmail/Yahoo.
3. **LinkedIn semi-auto conforme CGU.** Le marché n'offre que deux options : rien (Monaco, Clay, Actively) ou full-auto furtif hors CGU (LGM, Reply, lemlist, Amplemarket). La file de validation 1-clic (l'IA prépare, l'humain exécute) est une troisième voie inoccupée — défendable juridiquement et vendable aux équipes qui ont peur du ban (l'objection n°1 d'après le marketing de LGM lui-même).
4. **La prise de RDV native.** Trou quasi universel (Reply seul). Le prompt l'exige (module 8) ; c'est aussi le « payoff moment » du produit.
5. **RGPD comme mécanisme, pas comme badge.** Marché européen : Monaco est inutilisable en l'état pour un prospect EU soucieux de conformité (revente de données, zéro GDPR). Opportunité : opt-out cross-canal démontrable, purge, registre des traitements visibles dans le produit.
6. **Le cockpit de confiance.** Les meilleurs patterns du panel — Reasoning+Sources par signal (Monaco), sources liées par message (Jason), raisonnement d'agent dans l'inbox (Actively) — combinés avec nos quality gates loggés donneraient la transparence de décision la plus complète du marché.
7. **Souveraineté EU des signaux.** Les 8 concurrents sont US-centric sur la donnée. Les sources registres FR/EU (BODACC, Sirene, SEC Form D pour les US) identifiées dans la recherche interne restent un edge inexploité par le marché (`raw/prior-research.md` §4.3).

## 7. Cinq recommandations concrètes (brownfield)

Chaque recommandation croise un gap de marché (§6) avec l'état réel du code (§5). Ordre = levier décroissant.

### R1. Câbler le pipeline de quality gates au transport — le « 5 gates » cible est déjà construit à ~60 %
Le QC gate spec-20 (`runQc`/`sendEligible` : spam-words, ratio liens, brand checks) est fini, testé, et branché nulle part (0 call-site). Le fabrication-gate (vérification factuelle) tourne à la génération sur certains chemins seulement, et `evaluateSend` — le chokepoint unique fail-closed par lequel passent les 5 chemins d'envoi (`sending-gate.ts:214`) — ne vérifie aujourd'hui que destinataire et quota, jamais le contenu. Action : insérer les gates de contenu dans `evaluateSend`, router les envois manuels par G2+G5 minimum (règle permanente ligne 131 du prompt). Aucun concurrent du panel ne vend un pipeline de gates bloquants avec logs visibles (§6.2) : c'est le différenciateur signature, et c'est majoritairement du câblage, pas du build.
Trade-off : latence ajoutée au moment de l'envoi (les gates LLM coûtent ~1-3 s/message) — acceptable à ≤100 envois/jour, à concevoir en pipeline asynchrone (Phase 2).

### R2. Implémenter le cap 100/j/compte comme invariant architectural dans `evaluateSend` — il n'existe pas aujourd'hui
État réel : 20/j en mode primary-only (`sending-identity.ts:95-107`), 50/j/mailbox en colonne DB configurable, rate limit tenant 60/min+600/h (`rate-limit.ts:104-109`), et le mode `external-connected` (boîtes Instantly) passe SANS gating de volume (`sending-identity.ts:115-124`). Rien ne correspond à « cap non contournable par compte utilisateur ». Le point d'insertion est tout trouvé : `evaluateSend` couvre déjà les 5 chokepoints sans modification des call-sites (précédent : le rate limit tenant y a été ajouté exactement ainsi). Positionnement : le marché entier est structurellement volume (mailboxes illimitées chez Smartlead/Reply/lemlist) ; un cap assumé et non contournable est l'anti-« blasting » crédible que Monaco ne fait qu'affirmer.
Trade-off : un tenant multi-utilisateurs légitime peut vouloir >100/j agrégés — le cap est PAR compte utilisateur, la sémantique exacte (compte email vs utilisateur applicatif) est à trancher en Phase 1. [Périmètre TRANCHÉ par le founder le 02/07 : le cap est PAR TENANT — cette recommandation est remplacée par requirements.md INV-1 ; implémenté PR #615.]

### R3. Corriger les deux violations d'apprentissage, puis déplacer l'unité d'apprentissage vers la DÉCISION
Violations directes des règles permanentes détectées dans le code : (a) l'open rate alimente l'apprentissage (`outcomes/resolve.ts:12` poids 0,1 ; `signal-outcomes.ts:67` prior 1,15) — interdit (Apple MPP) ; (b) la hiérarchie d'outcomes est inversée (meeting_booked 0,9 < replied_positive 1,0) et « RDV honoré » n'existe pas. Corrections ponctuelles (2 fichiers). Ensuite, le vrai chantier : l'enregistrement de décision (persona, signal + fraîcheur, angle, canal, timing, position) comme unité d'apprentissage — le seam existe (`traced-ai.ts:90-308`), le flywheel et le canary existent, mais tout apprend au niveau message/trace. C'est le gap de marché le plus net (§2.5 : personne n'apprend des outcomes exposé à l'utilisateur ; Amplemarket n'apprend que des préférences).
Trade-off : le decision-record enrichi ajoute ~10 champs à tracker dès le MVP — coût faible maintenant, impossible à rattraper rétroactivement (les paliers 2-3 en dépendent).

### R4. LinkedIn : pivoter vers la file de validation par action — décision founder requise
Conflit stratégique, pas technique : l'infra Unipile est complète (quotas 20 connects/100 msgs par jour `limits.ts:14-15`, rampe `capacity.ts:1-12`, dispatch `dispatch-step.ts`) mais elle PILOTE le compte directement — exactement ce que la vision 5 du prompt interdit. Le benchmark montre une troisième voie inoccupée : Monaco/Clay/Actively n'automatisent rien, LGM/Reply/lemlist/Amplemarket font du full-auto hors CGU (LGM admet verbatim que « LinkedIn does explicitly forbid » leurs outils et vend la furtivité par proxies mobiles). Une file de validation par action (l'IA prépare visite/invitation/message, l'humain exécute en 1 clic — UX à spécifier en Phase 1bis avec raccourcis clavier/batch) est défendable juridiquement et adresse l'objection n°1 du marché (le ban). Recommandation : garder Unipile comme exécuteur, insérer la file de validation entre décision et exécution.
Trade-off : débit LinkedIn divisé par la disponibilité humaine (~5 min/jour pour ~30 actions) ; c'est le prix de la conformité CGU et il est cohérent avec « copilote → autopilote progressif ».

### R5. Compléter la délivrabilité au niveau table-stakes AVANT de la revendiquer comme axe vs Monaco
L'axe « profondeur délivrabilité » n'est crédible que si l'on atteint le standard du camp exécution (Smartlead/Reply/Amplemarket l'offrent dès l'entrée de gamme). Manquent aujourd'hui : vérification email mailbox-level (le provider est « slotted in » mais absent, `mx-verify-provider.ts:6` — domaine/MX seulement), tests de placement inbox (seed lists), monitoring de blacklists, et le warmup existe mais reste admin-triggered non câblé au send-path. Existant à valoriser : sending-gate fail-closed 5 chokepoints, SPF/DKIM/DMARC checks, suppression cross-canal — déjà au-dessus de Monaco (qui n'a RIEN de documenté). Cible : le minimum viable est vérifieur mailbox + placement tests ; le warmup mutualisé façon Smartlead (pool privé) est un investissement multi-semaines à séquencer après le MVP.
Trade-off : chaque brique délivrabilité externe (vérifieur, seed lists) est un coût variable par envoi — à intégrer au module métering/budget existant plutôt qu'en abonnement fixe.

### Note transversale (alimente la Phase 1bis, pas une reco produit)
Les patterns de confiance gagnants du panel — Reasoning+Sources par signal (Monaco, 010), sources liées par message (Jason), raisonnement d'agent dans l'inbox (Actively) — combinés aux logs de gates de R1 donneraient la transparence de décision la plus complète du marché. À spécifier comme principe d'expérience n°1 en Phase 1bis (le prompt maître l'exige déjà : « chaque message affiche pourquoi ce prospect, pourquoi ce message, quel signal »).

---

## 8. Points founder — TRANCHÉS le 2026-07-02

1. **Naming « revenue engine »** : ASSUMÉ. Elevay reste un « revenue engine » malgré le headline identique de Monaco. (« On est également revenue engine. »)
2. **LinkedIn** (R4) : la file de validation est le mode par défaut, ET **le but est de pouvoir activer un mode automatique**. Décision founder qui AMENDE la vision 5 du prompt maître (« aucune automatisation qui pilote directement le compte ») : le produit doit offrir les deux modes — semi-auto par défaut (file de validation 1 clic), automatique activable explicitement par l'utilisateur (l'infra Unipile existante sert ce mode ; le risque CGU est porté par l'activation volontaire). Les requirements Phase 1 spécifieront les deux modes + les conditions d'activation de l'auto.
3. **Charte** : mise à jour FAITE le 02/07 — `_harness/design-language.md` réécrit depuis les tokens réels d'origin/main (light « Clear Mode » par défaut, accent #2C6BED/#60A5FA, table rows 44px, invariant header 44px/contrôles h-7, règles éditoriales baseline). Les wireframes Phase 1bis s'appuieront dessus.
4. **Cap 100/jour** (R2) : **par TENANT** (« les 100 sont par tenant »). Simplifie l'implémentation : `evaluateSend` est déjà tenant-scoped (précédent : rate limit 60/min+600/h tenant, même point d'insertion). La sémantique EARS en Phase 1 : « le tenant ne peut pas dépasser 100 emails d'outreach par jour calendaire, invariant architectural non configurable par l'UI ».
