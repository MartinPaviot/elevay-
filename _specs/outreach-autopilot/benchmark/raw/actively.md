# Benchmark concurrentiel — Actively AI (actively.ai)

Date de capture : 2026-07-01. Pages publiques uniquement (aucun login). Aucun blocage anti-bot rencontré (headless Chromium, 9 pages en 200).
Preuves : `_specs/outreach-autopilot/benchmark/screenshots/actively/*.png` + `_specs/outreach-autopilot/benchmark/html/actively/*.html` (+ `sitemap.xml`).

## Pages capturées

| # | Fichier | URL |
|---|---------|-----|
| 1 | 001-home | https://www.actively.ai/ |
| 2 | 002-products-overview | https://www.actively.ai/products |
| 3 | 003-product-agent-inbox | https://www.actively.ai/products/agent-inbox |
| 4 | 004-product-watchtower | https://www.actively.ai/products/watchtower |
| 5 | 005-product-assistant | https://www.actively.ai/products/assistant |
| 6 | 006-customers | https://www.actively.ai/customers |
| 7 | 007-security | https://www.actively.ai/security |
| 8 | 008-solution-sdr | https://www.actively.ai/solutions/sdr |
| 9 | 009-manifesto-intelligence-led-revenue | https://www.actively.ai/blog/intelligence-led-revenue |

Page pricing : **inexistante** — `https://www.actively.ai/pricing` renvoie 404 ("Not Found | Actively", vérifié le 2026-07-01) et n'apparaît pas dans le sitemap.

## Positionnement (citations verbatim)

- Hero homepage : **« Revenue at Infinite scale. »** — « Per-Account Agents™ work every account 24/7, guide your team on what to do next, and help them do it. Even when your sellers are asleep. » (001-home.png)
- **« Human-led revenue has a ceiling. We removed it. »** (001-home.png)
- **« An AI agent for every account. »** — « Every account gets its own dedicated agent working proactively 24/7/365 throughout the entire prospect and customer lifecycle. […] You go from one seller reactively covering 200 accounts to 200 agents working every single one across SDRs, AEs, AMs, and Leaders simultaneously. » (001-home.png)
- Catégorie revendiquée : **« Intelligence-Led Revenue »** (manifesto cofondateurs Mihir & Anshul, 20 avril 2026) : « We're introducing a new paradigm for go-to-market: a persistent AI agent for every account. » (009-manifesto)
- Termes marketing propriétaires : **« Per-Account Agents™ »** (001-home), **« GTM Superintelligence »** (006-customers : « Ramp drove 10s of million in closed-won revenue with 23% higher win rates using Actively AI's GTM Superintelilgence across sales. » — sic, typo sur leur site), **« reasoning engine »** (006-customers : « Verkada 2x's rep productivity with Actively AI's reasoning engine. »).
- Cible affichée : **enterprise / scale-ups** — « HELPING THE BEST ENTERPRISE GTM TEAMS OUTRUN THE REST » (001-home.png). Logos : Verkada, Ramp, Ironclad, Attentive, Samsara, Harness, Justworks, Spring Health, Abnormal, Greenhouse (001-home.png).
- Modèle de déploiement service-heavy : « Agent Product Managers and Forward-Deployed Engineers embed with your team to ensure success. » (001-home.png)
- Funding (affirmé par le site) : Series B **$45M** co-lead TCV + First Harmonic, participation Bain Capital Ventures, First Round Capital, Alkeon ; total **$68M** (009-manifesto). « Forbes recently profiled Actively as part of a new wave of companies challenging legacy systems like Salesforce » (009-manifesto).

Angle stratégique : ce n'est PAS un outil d'outreach volume ; c'est une couche de raisonnement/priorisation au-dessus du stack existant. Manifesto : « Teams are left stitching together 15 different tools across the sales process » ; la réponse = agents persistants par compte qui décident quoi faire, préparent le travail, et l'humain approuve.

## Produits / Features par catégorie

### ai-decisioning (cœur du produit)
- Per-Account Agents™ : un agent persistant par compte, 24/7/365, sur tout le cycle prospect + client ; « Does real work without being prompted. » (002-products-overview.png)
- Priorisation : « Beyond completed work, Agent Inbox surfaces what requires human judgment, ranked by urgency, and with the agent's reasoning and supporting work already prepared. » (003-product-agent-inbox.png) — le **raisonnement de l'agent est exposé** au rep.
- Scoring-first / quel compte et pourquoi : « Actively agents work every prospect in your territory, monitoring signals, drafting outreach, and surfacing the right accounts at the right moment. » (008-solution-sdr.png) ; « Agents don't just flag triggers, they prepare the game plan. Research done. Email drafted. "Why now" written. You review and send. » (008-solution-sdr.png). Preuve d'efficacité affirmée : « 3.7x higher closed-won rates on Actively-recommended contacts » (Justworks, 006-customers.png).
- Human-in-the-loop systématique : « Your team reviews and approves. » (003) ; « You review and send. » (008). Aucun envoi autonome revendiqué sur les pages publiques.

### signals-intent
- Exemples de signaux cités : « Series B just announced, new VP Sales just started » (008-solution-sdr.png, timeline "Day in the Life") ; côté deals : « Champion gone dark. Competitive mention. Usage drop. Missed follow-up. Agents detect it the moment it happens, and tell you how to course correct. » (004-product-watchtower.png).
- « Agents monitor signals, prioritize accounts, and draft outreach […] All before you open your laptop. » (001-home.png, carte Sales Development)

### personalization
- Brouillons d'outreach générés avec justification « why now » écrite et contexte complet du compte : « When reps login, agents have done research, drafted emails, and prioritized new opportunities across every account. » (003-product-agent-inbox.png) ; « Add one personal line. Send. » (008-solution-sdr.png).
- Tagline footer récurrente : « Build outbound agents that access full prospect context before every touch. » (007-security.html, page 404)

### sequencer
- **Pas de séquenceur propre documenté.** La page SDR dit « Agents have already done the research so you just review and add to the sequence » (008-solution-sdr.png) — ce qui suggère l'ajout à un séquenceur existant (tiers), pas un moteur d'envoi Actively. Aucune page cadence/steps/A-B test sur le site public.

### multichannel-linkedin
- Non documenté sur le site. Seul l'email (brouillons) est explicitement montré. Aucune mention LinkedIn/appels/SMS sur les 9 pages capturées.

### learning-analytics (boucle d'apprentissage)
- Assistant : « **Continous learning and memory.** Learning across the org what is working and using that to drive better content, outcomes, and recommendations. » (sic, typo « Continous » sur leur site) (005-product-assistant.png)
- Manifesto : « a scalable system that continuously builds context across every account, learns from every interaction, and shares those learnings across the system to compound growth » ; « With tens of millions of per-account agents already in production for our customers, we are continuously learning what's most impactful » (009-manifesto).
- Watchtower côté coaching : « Agents continuously evaluate deals to understand what's working, which reps are executing best practices, and where coaching has the most leverage. » (004-product-watchtower.png)
- Citations clients sur le fine-tuning : « ability to fine-tune its agents » / « the agents keep improving as they learn our business » (001-home.png, Ironclad) ; variante 006 : « ability to fine-tune its revenue optimization models ».
- **Transparence de la boucle : marketing, pas technique.** Aucun détail public sur le mécanisme (features, données d'entraînement, fréquence, éval). Le seul élément de transparence produit : le raisonnement de l'agent affiché dans Agent Inbox (003).

### tam-ingestion / enrichment
- Pas d'ingestion TAM self-serve documentée (pas de CSV, pas de « build your list »). Ce qui existe : « Build on a scalable foundation of continuously updated context across your TAM » (001-home.png, carte Internal AI Teams) — le contexte TAM est maintenu par la plateforme, alimentée par le CRM et les outils du client : « secure subprocessors […] to connect to your Salesforce and other sales software tools from which we read or write data » (007-security.png). La recherche par compte est faite par les agents (008).

### reply-handling / booking / gifting / deliverability
- **Non documentés sur le site.** Les case studies affirment « Reps booked quality meetings on day one » (001/006) mais aucune feature de booking/scheduling n'est décrite. Rien sur warmup, domaines, spam, délivrabilité. Rien sur le gifting. Rien sur le traitement des réponses.

### Surfaces produit (other)
- **Agent Inbox** : « Where agent-completed work surfaces. Prioritized, prepared, ready to act on. » Diffusion dans les outils : « Agent Inbox can surface completed work directly in tools like **Salesforce, Slack, and Claude** ». (003-product-agent-inbox.png)
- **Assistant** : interface conversationnelle — « Ask anything. Get a finished asset back, not just an answer. » (002) ; « Ask about any account, and agents do the work, draft an email, prep a meeting brief » (005).
- **Watchtower** (surface leader/CRO) : « a live, agent-driven view of every account, every customer, and every risk » ; « based on what agents are observing, not last Friday's update ». (004-product-watchtower.png)
- **API Platform** : « Embed agent intelligence into any tool, workflow, or internal build. » (002-products-overview.png) — Samsara « accelerating their internal AI GTM roadmap on Actively's API — while saving millions in compute and token costs » (009-manifesto).
- **MCP server** (produit de premier rang dans la nav) : « Instant access to agents that do work in any AI tool. » (002) ; « Actively's MCP ensures every rep has instant access to agent intelligence, no matter the surface area. » (005).

## Pricing

**Non documenté sur le site.** `/pricing` = 404 (vérifié), absent du sitemap. Motion 100% sales-led : chaque CTA = « Request a demo » / « See demo », bouton « Sign In » pour clients existants, aucun signup self-serve, aucun free trial, aucun tier, aucune unité de facturation publiée. Cohérent avec le positionnement enterprise + Forward-Deployed Engineers (001-home.png).

## Patterns UX observés

- Hero avec carte produit flottante style notification : « 3 new contacts found at Notion » + liste de contacts (VP of Engineering, Director of IT…) — le produit est montré comme un flux de recommandations, pas comme une table (001-home.png).
- Module plateforme à onglets Agent Inbox / Assistant / Watchtower / API avec mockup « Good morning, Sarah. » — l'inbox agent comme rituel du matin (001-home.png).
- Page SDR : timeline « **Day in the Life** » (8:30am Scan → 11:00am Act → 2:00pm Review) — vend un workflow quotidien, pas des features (008-solution-sdr.png).
- Navigation par rôle (CRO / AE / SDR / Internal AI Teams / Sales Leader) en plus de la nav produit (001-home.png).
- Cartes clients metric-forward : chiffre géant + une ligne (2x, 23%, >$10M, >2x, 35%, 50%) (006-customers.png).
- Aucun screenshot produit détaillé : mockups stylisés uniquement ; le produit réel n'est jamais montré en entier sur le site public.
- Bandeau d'annonce Series B en haut de page (001-home.png).

## Canaux couverts

- **Email** : brouillons rédigés par les agents, l'humain relit et envoie (003, 008). Seul canal explicitement montré.
- Meetings/briefs de rendez-vous préparés par l'Assistant (005) — préparation, pas booking.
- LinkedIn, téléphone, SMS, gifting : non documentés sur le site.

## Discours IA

- « AI is transforming nearly every business function. We now have Cursor and Claude Code for coding, Decagon and Sierra for support, and Harvey and Legora for legal. Sales is the most expensive function in most companies – 30 to 40 cents of every dollar of revenue goes back into GTM. And yet it's the function AI has barely transformed. » (009-manifesto)
- « Go-to-market is exactly the kind of problem goal-directed agents are built for […] It's continuous, context-heavy, and constantly changing. » (009-manifesto)
- Citation client (Greenhouse CRO) : « This isn't AI-assisted selling; it's AI-native GTM » ; « handling the research, reasoning, and action planning that used to consume 50% of our reps' time » (006-customers.png).
- Anti-pattern qu'ils attaquent : « static spreadsheet workflows or one-off recommendations » (009), « one seller reactively covering 200 accounts » (001), fragmentation en 15 outils (009).

## Délivrabilité

Non documentée sur le site (aucune mention warmup, domaines, inbox placement, throttling).

## Boucle d'apprentissage (transparence)

Affirmée partout, détaillée nulle part. Claims : apprentissage cross-org de « what is working » réinjecté dans contenu/recos (005), « learns from every interaction » + partage des learnings dans tout le système (009), fine-tuning par client (citations 001/006), évaluation continue des deals pour le coaching (004). **Aucune documentation publique du mécanisme** (pas de docs techniques, pas de page méthodologie). Élément de transparence réel : le raisonnement de l'agent est montré au rep dans Agent Inbox (003).

## RGPD / conformité (007-security.png)

- **SOC 2 Type II** (catégorie Security), audité annuellement, rapport sur demande.
- **GDPR** : « We comply with GDPR data retention requirements, and offer a data processing agreement (DPA) for customers in the EU. »
- **CCPA** : conformité affirmée.
- Infra : Google Cloud (data centers SOC 2, ISO 27001, HITRUST) ; TLS en transit ; **AES-256** au repos ; données clients stockées dans **Google BigQuery** ; sous-processeurs sécurisés pour lire/écrire dans Salesforce et autres outils sales.
- Politique de divulgation responsable (`/responsible-disclosure`) + contact security@actively.ai.

## Faits notables

- Series B $45M (TCV + First Harmonic), total levé $68M (009-manifesto — affirmé par le site).
- « tens of millions of per-account agents already in production » (009-manifesto — affirmé, invérifiable).
- Métriques case studies (affirmées) : Samsara 2x conversion sur l'outreach piloté par Actively ; Ramp +23% win rate, dizaines de M$ closed-won ; Ironclad >$10M pipeline qualifié ; Verkada >2x productivité rep ; Justworks +35% rev attainment, 3.7x closed-won sur contacts recommandés ; Greenhouse +54% pipeline/rep, ramp time divisé par 2 (006-customers.png).
- Le MCP server et l'API Platform sont des produits de premier rang (nav) — distribution de l'intelligence agent dans Claude/Slack/Salesforce et dans les builds internes des équipes AI clientes (002, 003, 005). Une page solution dédiée « Internal AI Teams » existe.
- Ressources de thought leadership : `gtm-ai-maturity-model`, `fieldnotes`, ~30 posts de blog dont « AI SDR tools: per-account agents vs. sequence bots » — ils se définissent explicitement CONTRE les « sequence bots » (sitemap.xml).
- Aucun challenge anti-bot rencontré ; site Webflow, tout le contenu est server-rendered.

## Lecture Elevay (facts only → implications)

- Actively ne vend PAS l'exécution d'outreach (pas de séquenceur, pas de délivrabilité, pas de multicanal) : ils vendent la **décision** (quel compte, pourquoi maintenant, quoi écrire) et laissent l'envoi au stack du client. C'est l'inverse exact des Smartlead/lemlist, et un chevauchement direct avec la couche signaux/priorisation/drafting d'Elevay — mais à cible enterprise, sales-led, avec des ingénieurs déployés chez le client.
- Leur pattern « Agent Inbox = travail déjà fait au réveil, classé par urgence, avec le raisonnement visible » est le benchmark UX le plus proche du modèle HITL d'Elevay (drafts → review → send).
