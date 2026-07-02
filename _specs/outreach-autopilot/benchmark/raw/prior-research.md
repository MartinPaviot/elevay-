# Recherche concurrentielle anterieure — distillation (rapports du 21 au 27/06/2026)

Distillation fidele des rapports internes deja produits. Rien de re-invente : chaque fait et chaque
recommandation est extrait tel quel, avec sa source. Les faits marches (produits/pricing concurrents)
datent de fin juin 2026 et sont a considerer comme **potentiellement perimes** (possiblyStale).
Les faits sur l'etat du code Elevay sont des snapshots au 21-27/06 — beaucoup ont ete cables depuis
(cf. memoire projet) ; ne pas les re-citer comme etat actuel sans re-verification.

Sources lues integralement :
- `_reports/monaco-depth-inside-the-100-gap-2026-06-26.md`
- `_reports/outbound-competitive-gap-analysis-2026-06-26.md`
- `_reports/orion-differentiation-2026-06-27.md`
- `_reports/signals-world-class-2026-06-27.md`
- `_research/ui-teardown/monaco-design-tokens.md`, `monaco-components.md`, `monaco-layouts.md`
- `_research/ai-outreach-audit/RAPPORT.md` (audit 14 agents du 21/06)

---

## 1. Monaco — faits etablis

### 1.1 These et moat produit (source : `_reports/monaco-depth-inside-the-100-gap-2026-06-26.md`)

- Sam Blond est le CEO de Monaco. Citation verbatim (via `transcript-sam-blond-monaco-gtm.md:27`) :
  *"the outreach was the easier part — finding the right people at the right time took all the labor"*.
- Le moat de Monaco = **SELECTION + COMPOSITION en amont de la copie**, pas la redaction :
  une sequence DIFFERENTE par trigger × persona × ICP × stage (matrice estimee ~50-200 templates).
  Exemple cite : "23 comptes funded <30j → sequence Post-Funding", structurellement differente
  (ex. etape cadeau/gifting).
- Chaque message mappe un signal **benefique au destinataire** a un angle + un fait verifiable
  hyperlinke.
- La cadence multi-touch **branche sur des evenements reels** (if-replied/opened/clicked) ;
  multi-canal LinkedIn + email + phone + gifting dans UNE sequence ("1+1=4") — presente comme
  "le plus gros levier de reply". Chaque follow-up doit ajouter une valeur neuve.
- Signal→PERSONNE : le signal designe QUI contacter (l'auteur du post, le hiring manager),
  pas le top-seniority par defaut.
- Regles d'angle : job-posting → "on automate ce role" ; funding = JAMAIS un pitch "vous avez
  leve" (spam deguise), seulement congrats/cadeau, fenetre ≤180j.
- Boucle INSIGHTS persona-geo (la piece maitresse) : coupe le closed-won par buyer × geo ×
  vertical et reoriente TOUS les premiers touches. Exemple Brex : la persona finance convertit
  4× les controllers → reallocation du top-of-funnel.
- Bloc "origin-story founder" dans la copie ("j'ai cree X apres avoir vu mon pere…") — un
  commercial salarie ne peut pas le dire.
- Timing de cadence par ICP (J+0/3/7/14/30 par vertical), intervalles tunes par segment.
- Variants A/B pilotant les envois LIVE (templates testes sur reply/positive).
- Flag honnete du rapport : l'orchestration multi-stakeholder n'est PAS un move outbound
  demontre chez Monaco.
- Positionnement (via `_reports/outbound-competitive-gap-analysis-2026-06-26.md`) : Monaco =
  deal coaching + auto-tuning/promotion du variant gagnant, barre concurrente pour le hot-lead→CRM.

### 1.2 Produit / UX observes (teardown screenshots)
(sources : `_research/ui-teardown/monaco-components.md`, `monaco-layouts.md`, `monaco-design-tokens.md`)

- **TAM table** dense (rangees ~36-40px, 8+ colonnes simultanees) : Account, Status, Score,
  Industries, Connected to, puis colonnes SIGNAUX binaires "Common Investor?", "Sales-led
  growth?", "YC Company?" en badges Yes/No (vert/rouge).
- **Score = grade lettre (A/B) + emoji feu + label "Burning"** — pas de score numerique visible.
  Systeme apparent : grade de fit + niveau de "chaleur" (timing/urgence).
- **Popover de raisonnement de signal** : clic sur "Yes" → onglets "Reasoning" | "Sources",
  texte d'explication IA + cartes sources (favicon + domaine + titre d'article). Ex. verbatim :
  "Judgment Labs common investors with Monaco include Founders Fund."
- **Rangee de compte expandable** → liste de contacts suggeres (nom + titre + "Suggested" vert).
- **Sequence builder** : timeline verticale ("Sam Blond to Alex Shan (Co-Founder)") avec etapes
  numerotees + noeuds d'attente ("Wait 3 business days") ; demo = sequence gifting fundraise
  (etape 1 "Fundraise gifting" avec cadeau physique Veuve Clicquot, 2 "Gift reminder",
  3 "Final message") ; preview email a droite.
- **HITL explicite** : boutons Reject (pouce bas) + Start (pill blanche) sous chaque sequence
  IA — l'humain approuve ou rejette avant lancement.
- **Thread email rendu en chat** : bulles entrantes/sortantes, badge canal "Email",
  "Suggested reply" pre-remplie en bas — toutes les communications traitees comme une
  conversation unifiee.
- **Meeting recorder** : split video (~60%) + notes IA (~40%) qui se structurent en sections
  progressives (Key Points, Budget and Team Size) ; les champs du compte (CRM actuel, budget,
  taille equipe sales) s'auto-populent depuis la conversation avec etat "Updating...".
- **Pipeline** : liste verticale de cartes deal (logo + nom + valeur $) — PAS un kanban
  horizontal ; panneau Overview a droite avec resume IA + timeline datee des interactions.
- **Ask AI / CRO copilot** : coaching brutal et direct, ex. verbatim de titre : "You Lost
  Control - This Demo Was About You, Not Their Pain" ; feedback actionnable en bullets.
- **Dashboard** : "Good morning, Sam" + stats semaine ("45 sequences, 12 responses, 2 meetings,
  8 opportunities") ; colonne "Your priorities today" (taches avec badge "Stalled 3 days",
  valeur $, due dates) + meetings du jour + draft de nudge pre-compose.
- **Design system** : dark-only exclusif (aucun light mode), palette restreinte (~90% neutre ;
  vert/rouge reserves aux signaux binaires, orange au "Burning"), Inter-like, coins doucement
  arrondis, esthetique "data cockpit / ops center". Densite tres superieure aux CRM classiques
  (whitespace ~15% vs ~35-40%, 15+ comptes par ecran, 1-2 clics vers toute donnee).
- Principes de layout : split panels plutot que navigation pleine page ; contenu IA TOUJOURS
  en contexte (popover/panneau lateral), jamais une "page IA" separee ; approve/reject en bas
  du contenu genere ; desktop-only (1440px+).
- Embauches (page Ashby, snapshot) : 8 postes ouverts SF on-site, dont "Forward-Deployed
  Account Executive" et "Founding Account Manager".

---

## 2. Autres concurrents outbound — faits etablis

### 2.1 Leaders execution/copie/deliverabilite
(sources : `_research/ai-outreach-audit/RAPPORT.md` + `_reports/outbound-competitive-gap-analysis-2026-06-26.md`)

- **Clay / Claygent** : agent web multi-hop reel (visite, navigue, suit les liens, lit PDF,
  formulaires via Navigator vision) sur 150+ providers en waterfall (couverture ~30%→80%+) ;
  paradigme table-as-runtime, agent-in-a-cell ; cell-detail montre provider exact + raisonnement
  + source tracable.
- **AiSDR** : >323 sources + activite LinkedIn dans la recherche prospect.
- **Octave** : personnalisation concept-driven (pain reelle → value prop → proof point depuis
  une Library structuree), choix d'angle PAR message ; ~18% reply en perso avancee vs ~7% template.
- **Lavender** : score 0-100 a CHAQUE frappe, modele entraine sur le reply-rate observe,
  suggestions ligne par ligne. **Twain** : linter NLP (filler, exclamations, conditionnels mous).
- **Smartlead / Instantly** : reseau de warmup mutualise (>1M boites), simulation d'engagement
  (open/reply/mark-important/rescue-from-spam) = signal n°1 de reputation ; UN moteur d'envoi
  unique (rotation, rate-limit, fenetres coherentes, jitter realiste) ; tests d'inbox placement ;
  experiments A/B subject/body avec attribution par variante.
- **Amplemarket** : spam-check proactif pre-envoi + selection de mailbox pilotee IA ;
  "Duo" = copilot-feed signal-driven re-entraine au feedback.
- **Warmly / Unify / Common Room** : warm outbound declenche par intent reel (visite pricing,
  de-anon person-level, G2, funding) — ~80% open / 5% reply vs 30% / <1% en cold classique ;
  person-level > company-level. Chiffres prod Warmly : ~65% match company / ~15% person (US).
- **Common Room** : Person360 (identity resolution + waterfall), 100+ signaux ; API ingest-only
  (on ne pompe pas leurs signaux) ; a partir de ~2100$/mo.
- **Jason AI (Reply)** : toggle Copilot/Autopilot. **Artisan** : approbation par defaut puis
  autopilot ; onboarding conversationnel ~10 min. **11x** : "Alice's Brain" auto-ingere le
  positioning depuis site/docs. **LangChain Agent Inbox** : file approve/edit/reject/respond.
- Piege partage par 11x/Jason releve par l'audit : traiter des traits statiques (YC,
  funding-seul) comme des triggers — le "tell of automation".

### 2.2 Couche data/signaux amont — Fiber AI / Orange Slice / Lopus
(source : `_reports/orion-differentiation-2026-06-27.md` ; le rapport marque lui-meme VERIFIE vs SUPPOSE)

- **Fiber AI** (FAIT VERIFIE dans le rapport) : a pivote d'un "AI SDR autonome" (YC S23) vers une
  plateforme de **data-APIs agent-native** ("the freshest data APIs for AI sales, recruiting &
  growth") ; 100+ providers agreges (LinkedIn, Crunchbase, BuiltWith, SemRush, Apollo) ; 40M+
  entreprises / 850M+ personnes ; contact reveal waterfall 16+ providers avec "0% bounce
  guarantee" ; API publique 200+ ops, MCP, webhooks Tracker. Fraicheur snapshot : entreprises
  2-3 sem, jobs 2-3 j, personnes 1-2 mois. **Detecte des signaux mais ne les interprete pas**
  (evenements bruts, pas de why-now, pas de compound) ; pas de serie temporelle/velocite ;
  US+LinkedIn-centric. Pricing $300/$900/$2400 = NON VERIFIE (repertoires tiers). N'envoie pas.
- **Orange Slice** (YC S25, VERIFIE) : "spreadsheet d'enrichment agentique ou chaque colonne
  execute du TypeScript genere par IA" — Clay-killer pour devs ; orchestrateur de providers
  commerciaux revendus (OpenAI, Firecrawl, Apify, BetterContact, FullEnrich, BuiltWith,
  PredictLeads), rien de proprietaire ; peut envoyer basiquement (colonne LLM → Instantly/
  HeyReach/Gmail/Slack) mais **mail-merge LLM sans grounding** (risque hallucination) ;
  stateless (pas d'historique/velocite) ; equipe de 2 (key-person risk). Endpoints/auth = SUPPOSE.
- **Lopus** (YC W25, VERIFIE) : pivot net, deux visages — **Beacon** (lead discovery par intent
  social Reddit/X/forums, deprioritise) et **Probe** "Operations Data Platform" (analytics
  RevOps interne, focus actuel, pas du signal→outbound). Aucune API publique documentee
  (docs.lopus.ai ne resout pas) — NON VERIFIE.
- Constat transversal du rapport : les trois occupent le quadrant "niveau achete + perso de
  surface" ; aucun ne fait (1) la derivee historisee, (2) le compound why-now verifie au
  contenu, (3) le scoring calibre outcomes + identite resolue. Sur les 8 dernieres lignes de la
  table de valeur (SEC Form D pre-annonce, BODACC, hiring velocity, tech-churn, adoption OSS en
  derivee, crt.sh, investor-overlap/warm-path, compound why-now, scoring calibre, grounding
  citableFacts/doNotClaim, brief) — Orion est seul.

### 2.3 Fournisseurs de signaux/intent — etat et pricing (snapshot fin juin 2026)
(source : `_reports/signals-world-class-2026-06-27.md`, section 2)

- Doctrine convergente du marche (Clay, Common Room, Unify, Apollo, 30MPC, Monaco) :
  **3-5 signaux, pas 40** ; classes fit/intent/timing/warm-path ; decay par categorie ; dedup
  sur une identite ; declenchement uniquement a convergence 2+ sources. Le moat est la logique
  de decision, pas le vendor (twelfth.agency).
- **Job-change = warm signal n°1, convertit 3-5× le cold.** UserGems Core 2750$/mo ; Coresignal
  des 49$/mo + webhooks ; Champify. **Proxycurl mort** (injonction LinkedIn 2025). FR gratuit :
  changement de dirigeant via BODACC.
- Stacking : 3+ signaux ~2.4× ; multi-signaux 5-10× ; reply 25-40% vs 3-5%. Regle Apollo :
  2 sources independantes avant haute priorite. Decay : halve /30j, drop >60j ; SLA high ≤4h.
- Pricing/etat des sources (tous possiblement perimes) : Crunchbase plus de free tier (2025),
  SaaS 99-199$/mo, full API ~50k$/an ; ZoomInfo API ~50k$/an ; BuiltWith Basic 295$ → Team
  Ultra 6000$/mo (×6 en 2026), l'historique tech-churn paywalle (~995$/mo) ; Wappalyzer Starter
  39$/mo ; Bombora ~25-60k$/an+ ; G2 Buyer Intent add-on 40-50k$ list ; Apollo Basic 49$/Pro
  79$/Org 119$ user/mo ; Unipile ~5€/compte/mois min 49€ ; PhantomBuster ~69$/mo (zone grise
  ToS/RGPD).
- De-anon visiteur : **Koala MORT** (shutdown sept 2025, rachat Cursor) ; **Clearbit Reveal
  sunset** (HubSpot-only/Breeze) ; RB2B (webhook push only, Pro+ 149$/mo) ; Vector (Reveal
  399-999$/mo, US) ; Warmly (Data Only 499$/mo → 19-45k$/an) ; Snitcher (company only, EU-friendly) ;
  Factors.ai (des 399$/mo). Reference honnete de match prod : ~65% company / ~15% person (US).
- RGPD (cible EU/FR) : le person-level web est legalement inexploitable en EU (consentement +
  DPIA + Art.14) et plafonne ~15% meme aux US → couche EU = company-level (interet legitime) ;
  le person-level defendable = first-party consenti (PQL). LinkedIn via compte connecte
  (Unipile), pas de scraping.
- Sources gratuites hard-to-get identifiees comme l'edge (aucun wrapper ne les a) : ATS publics
  JSON (Greenhouse/Lever/Ashby → stack + intent + velocite d'embauche), SEC EDGAR Form D/8-K
  (financement US pre-annonce J+0 vs Crunchbase ~J+30), BODACC/recherche-entreprises FR
  (dirigeant/financement, souverain, la ou UserGems coute 2750$/mo), adoption open-source en
  derivee (npm/PyPI/Docker/GitHub), tech-churn par diff de snapshots proprietaires, crt.sh/DNS
  (lancement produit/infra), investor overlap (cap-table tenant), PQL first-party.

---

## 3. Ou Elevay etait DEJA devant (fin juin — a ne pas perdre)
(sources : `_reports/outbound-competitive-gap-analysis-2026-06-26.md` + `_research/ai-outreach-audit/RAPPORT.md`)

1. **Citation-gate fail-closed a T-0** : re-verification de chaque URL a l'instant d'envoi +
   RECALL du draft si lien mort (`sequence-drafts/citations.ts`). **Aucun leader audite ne fait
   ca** — differenciateur anti-mensonge unique.
2. **Contrat "jamais auto-send" structurel** (`autonomy-hub.ts`, ceiling 'suggest' en dur) —
   garantie plus forte que les toggles Autopilot des leaders.
3. **Inbox de reponse classe-leader** (lanes priorisees, j/k/e/r, Cmd+K, evidence-quote,
   prepared-draft) — le plus mur de tout l'outreach audite.
4. **Reply mining anti-hallucination** (`email-intelligence.ts`).
5. **Gate stack conformite LIVE fail-closed** (opt-out → suppression → email-status →
   lawful-basis → targeting → sending-identity) — plus rigoureux que la plupart des concurrents.
6. **Hygiene de signaux anti-"tell of automation"** : TTL par type, refus explicite de traiter
   YC/funding-seul comme trigger — exactement le piege que 11x/Jason ratent.
7. State machine des drafts (concurrence optimiste, bulk atomique) + strategy layer deterministe
   et teste — plus auditable que la plupart des concurrents.

---

## 4. Axes de differenciation & recommandations DEJA emises

### 4.1 Vs Monaco — construire la selection de sequence d'abord
(source : `_reports/monaco-depth-inside-the-100-gap-2026-06-26.md`)

- Diagnostic : Elevay est l'INVERSE de Monaco — copie par message riche (best-in-class) mais
  intelligence de sequence plate/dormante ; l'autopilot enrolait chaque prospect dans UNE
  sequence statique (`LIMIT 1`), variation limitee au corps du mail.
- **Reco n°1 : rewirer l'autopilot sur le primitive de selection existant**
  (`pickSequenceForSignal`/`pickIcpScopedSequence`, jamais cable a l'autopilot) au lieu de
  `LIMIT 1`, + seeder une librairie de templates trigger × persona × stage. Levier anormalement
  eleve (rewire ~3j) ; convertit Elevay de "une cadence reformulee" a "une sequence par why-now".
- Ordre de build recommande : **#1 selection/composition → #2 cadence branchee sur events
  (emettre opened/clicked, le moteur de decision dormant existe) → #5 lint benefice-destinataire
  + reframe congrats/cadeau du template funding (4-6j) → #4 signal→personne (personHint sur
  chaque signal) → #3 multi-canal dans une sequence (dispatchStep existe, non cable) → #6 boucle
  insights persona-geo (apres volume)**. Bonus medium : founderStory (3-4j), delayDays par ICP
  (3-5j, bundle avec #1), variants A/B live (1.5-2 sem). NE PAS sur-investir le
  multi-stakeholder (pas un move Monaco demontre).

### 4.2 Cabler avant de construire — Bucket A puis Bucket B
(source : `_reports/outbound-competitive-gap-analysis-2026-06-26.md`)

- Meta-constat : "le probleme n'est pas construire plus, c'est cabler ce qui est construit" —
  ~13 features best-in-class dormaient en BUILT-not-wired/shadow/orphan ; ~24-38 dev-jours de
  cablage = le meilleur ROI du produit.
- Sequence recommandee (chemin critique) : **1) A1+A2** (envoi Instantly cable + verif email —
  prealable absolu pour qu'un tenant manage puisse envoyer) → **2) A3** (moteur copie fort
  spec-19/20 en live = parite Octave/Clay) → **3) A7+A6** (warmup-readiness gate + anti-collision
  enforce, proteger la reputation avant de scaler) → **4) A5+A9** (hot-lead→CRM/Slack + pipeline
  reply canonique = parite Lightfield/Monaco) → **5) A4** (LinkedIn multi-canal) → **6) A8**
  (A/B auto-promote + UI optimizer) → **7) Bucket B** dans l'ordre B1 (warmup mutualise +
  engagement simule = LE moat deliverability, multi-semaines) > B2 (scoring temps-reel entraine
  reply-rate + back-test, gated sur volume) > B3 (recherche agentique multi-hop/waterfall) >
  B4 (de-anon intent person-level) > B5 (cockpit outbound unifie, porter le paradigme call-mode).
- Trade-off assume : cabler d'abord (fonctionnel et au-niveau) avant le moat (imbattable) ;
  risque accepte = B1 reste ouvert quelques semaines de plus.
- Etat d'avancement note au 26/06 : A2 FAIT (#426), A1a FAIT (#427), A5-Slack FAIT (#430),
  A9 FAIT (#431) ; A1b differe (gate humain), A5-CRM = decision founder. [Snapshot — perime.]

### 4.3 Positionnement amont vs les wrappers data (Orion)
(source : `_reports/orion-differentiation-2026-06-27.md`)

- These : occuper la couche **signal → interpretation → grounding en AMONT de l'envoi** ; ne se
  battre ni sur l'enrichissement contact brut (Fiber 4-10× moins cher), ni sur l'execution
  spreadsheet (Orange Slice), ni sur l'analytics interne (Probe). La couche non-commoditisable =
  signal→brief (why-now compose, date, HEAD-verifie, citableFacts[]/doNotClaim[], priorite
  calibree sur les outcomes du tenant).
- Coopetition/export : les traiter comme consommateurs du brief (Fiber = INPUT enrichissement +
  push d'audiences a surveiller ; Orange Slice = OUTPUT brief en custom fields via webhook ;
  Lopus = source best-effort jamais dependance) ; export `toInstantlyCustomVariables` / brief
  generique vers l'agent Elevay.
- Le moat non-copiable (5 elements) : donnees historisees proprietaires (la derivee n'existe
  qu'avec l'historique snapshote — irrattrapable retroactivement), identite resolue du corpus
  tenant, outcomes calibres (multipliers appris sur closed-won reels), graphe warm-path
  (multiplicateur 3-5×, non-achetable), grounding compose verifie-au-contenu.
- Priorisation data : Tier 0/1 = table stakes (Fiber les a) ; **Tier 2 hard-to-get = l'edge**
  (ATS JSON, SEC Form D, BODACC, adoption OSS derivee, tech-churn, crt.sh, job-change champion,
  investor overlap, PQL). Plafonner 3-5 signaux actionnables, convergence 2+ sources, classement
  par correlation closed-won — l'inverse du reflexe wrapper.
- Avantage geo : les 3 concurrents sont US-centric ; la couche registre FR/CH (Sirene, Pappers,
  Zefix, BODACC) donne un sujet plus propre sur l'Europe.

### 4.4 Signaux world-class — architecture + framework conseil
(source : `_reports/signals-world-class-2026-06-27.md`)

- Defaut #1 PROUVE (au 27/06) : trois taxonomies de types incompatibles → le scorer quotidien
  lookup `multipliers["funding_recent"]` alors que les multipliers sont indexes `funding` →
  undefined → plancher 1.0× partout ; le moteur d'attribution Bayesian (la piece la mieux
  construite) etait silencieusement court-circuite.
- Reco architecture : **table `signals` normalisee derriere un signal bus + taxonomie canonique
  via alias-map + dual-write → flip reads** (pas de big-bang). Steps 0-5 ≈ 11.5 j-h closent le
  defaut #1 ; coeur complet ~15-19 j-h ; world-class (person-grain job_change + 2 sources
  gratuites) ~35-45 j-h. Ensuite : decay graduel, convergence gate 2 sources, suppression des
  signaux negatifs, sources gratuites tier-S (ATS breadth, SEC Form D, BODACC).
- Framework "expert conseil" a rejouer pour tout client : checklist de qualification (motion,
  ACV — LE chiffre qui dit si un signal a 30-150k$/an se rentabilise —, surface first-party,
  10-20 closed-won pour la correlation) ; arbre de decision par profil. **Profil A founder-led
  (le cas Elevay/Pilae)** : job-change champion + investor overlap + levee <6 mois + hiring
  spike ; NE PAS acheter Bombora/6sense/G2 sans surface first-party (cause n°1 d'echec).
- Mapping signal→angle→canal→TTL (Kairos) : levee = pic 48-72h TTL 180j ; job-change 30-60j ;
  investor overlap sans peremption ; hiring 30j ; tech-stack change 90j ; leadership change 120j
  (70% du budget engage dans les 100 premiers jours) ; visite pricing 24-48h.
- Pari hackathon retenu : **Compound Signal Agent** a la demande sur 1 company froide (fan-out
  parallele ATS + GitHub + Apollo jobs + tech-detect + Crunchbase, chaque preuve citee et
  HEAD-verifiee, synthese Sonnet en why-now source + draft d'opener). Incarne la these que tout
  le marche valide : le moat est la couche de jugement, pas la donnee ; near-free la ou
  Clay+UserGems+Bombora coutent 6 chiffres.

### 4.5 Backlog qualite/agentique (audit du 21/06)
(source : `_research/ai-outreach-audit/RAPPORT.md`)

- P0 emis : P0-1 fermer le bypass anti-ICP+HITL de l'autopilot d'enrollment (defaut de securite) ;
  P0-2 brancher le brief de recherche (riche mais jete) dans la generation ; P0-3 gate qualite
  gradeEmail sur le path BULK (celui qui emaile de vrais prospects skippait tout gating) ;
  P0-4 cabler le spam-check pre-send ; P0-5 suppression-list globale hard-bounce/complaint ;
  P0-6 fermer la boucle rejection-insights → generation ; P0-7 List-Unsubscribe RFC-8058 sur le
  path worker (exigence bulk-sender Gmail/Yahoo 2026).
- P1 emis : P1-8 auto-pause de l'enrollment au reply (le pire tell d'automation) ; P1-9 agent de
  recherche en boucle (AI SDK v6, stopWhen/prepareStep, facon Claygent) ; P1-10 Apollo en premier
  palier de waterfall ; P1-11 citations phrase-par-phrase + re-verif a l'approbation + freshness
  des faits non-URL ; P1-12 LLM-judge semantique de perso calibre + back-test score→reply ;
  P1-13 unifier les 3 chemins d'envoi + bugs TZ/jitter (gap 45s fixe = signature robotique) ;
  P1-14 verif DNS SPF/DKIM/DMARC pre-envoi + vrai complaintRate ; P1-15 cockpit "Outbound du
  jour" calque sur call-mode ; P1-16 memoire schema-less par prospect (style Mem0, dedup
  insert/update/discard, faits sources).
- P2 emis : P2-17 variantes A/B + attribution reply-rate ; P2-18 warmup avec simulation
  d'engagement + ramp unifie ; P2-19 monitoring de placement reel via seed-list.
- [Snapshot — plusieurs P0 ont ete traites depuis (cf. §4.2 et la memoire projet) ; re-verifier
  l'etat de chaque item avant de le re-citer.]

---

## 5. Caveats de fraicheur

- Tous les faits concurrents (pricing, pivots, capacites produit, matchs de de-anon, morts
  d'API) = snapshot 21-27/06/2026. A re-verifier avant toute citation client ou decision d'achat :
  le rapport Orion marque deja explicitement SUPPOSE/NON VERIFIE les regles Tracker Fiber, les
  endpoints Orange Slice et l'existence meme d'une API Lopus.
- Le teardown Monaco est base sur des screenshots marketing/hero video — les couleurs sont
  approximatives, la sidebar est reconstruite par inference, et le produit a pu evoluer.
- Les faits "Elevay aujourd'hui" (file:line) des quatre rapports sont des etats de code au
  moment de l'audit ; une grande partie des gaps a ete cablee depuis fin juin (autopilot,
  flywheel, capture, etc.) — l'etat courant vit dans la memoire projet et sur origin/main.
