# Benchmark concurrentiel — Clay (clay.com)

Date de capture : 2026-07-01. Méthode : Playwright chromium headless (UA Chrome 131, 1440x900), pages publiques uniquement, aucun login. Aucun blocage anti-bot rencontré (`blocked=false`).

Preuves :
- Screenshots : `_specs/outreach-autopilot/benchmark/screenshots/clay/001-home.png` … `007-sculptor.png`
- HTML brut : `_specs/outreach-autopilot/benchmark/html/clay/001-home.html` … `007-sculptor.html`

Pages capturées :
| # | URL | Screenshot |
|---|-----|------------|
| 1 | https://www.clay.com | 001-home.png |
| 2 | https://www.clay.com/claygent | 002-claygent.png |
| 3 | https://www.clay.com/waterfall-enrichment | 003-waterfall-enrichment.png |
| 4 | https://www.clay.com/signals | 004-signals.png |
| 5 | https://www.clay.com/sequencer | 005-sequencer.png |
| 6 | https://www.clay.com/pricing | 006-pricing.png (repris sans bannière cookies) |
| 7 | https://www.clay.com/sculptor | 007-sculptor.png |

---

## 1. Positionnement (verbatim du site)

- Titre de la homepage : **"Build systems to grow revenue"** ; sous-titre : **"Infrastructure to get any data, run agentic workflows, and launch GTM plays."** (001-home.png)
- **"Trusted by more than 500,000+ leading GTM teams of all sizes."** (001-home.png)
- Section signature : **"GTM engineers build on Clay"** — Clay crée activement la catégorie "GTM engineer" (articles de blog liés en footer : "The rise of the GTM engineer", "Finding GTM alpha", "Clay reaches 100M ARR", "Series C: The GTM engineering era begins now") (001-home.png).
- Citation client mise en avant : **"Clay has become the orchestration layer for everything GTM. Salesforce for record-keeping, Snowflake for product data, and Clay for turning it all into automated action."** (Kyle Ketchum, Marketing Operations) (001-home.png)
- Bandeau nav : **"Article – NY Times: Clay allows employees to sell shares at a $5b valuation."** (001-home.html)
- 4 piliers sur la home : **Data** ("Get data from the most complete data marketplace — One contract to buy data from 200+ data and AI vendors"), **Agents** ("Create agents who mimic your best reps"), **Orchestration** ("Orchestrate workflows across tools in real time"), **Execution** ("Launch new plays as fast as you have ideas") (001-home.png).

Lecture : Clay ne se positionne PAS comme un outil d'outreach mais comme l'**infrastructure/couche d'orchestration data GTM** sur laquelle on construit des "plays". L'exécution (Sequencer, Ads) est une extension récente de ce socle.

## 2. Features par catégorie

### tam-ingestion
- Use case "TAM Sourcing" : **"Find every account in your TAM in one place."** (001-home.png)
- Nouveau produit **Audiences** (bannière "Launching today: Audiences — Centralize your GTM data") : "Centralize your first and third party data sources in Clay" ; recherche illimitée + imports CRM/data-warehouse (250k sur Growth, illimité sur Enterprise) (001-home.png, 006-pricing.png).
- Prompt-box homepage "What do you want to build?" avec exemples : "Find companies with 30+ sales reps, $10M+ in revenue, and a free trial button on their website", "Find companies with 3+ open roles that mention international expansion in the job descriptions" (001-home.png).
- Cas client : "Mistral AI cut the time to map their TAM and score accounts from 2 months to 10 days." (001-home.png)

### enrichment (waterfall — cœur du produit)
- **"Why use one contact database when you can use them all?"** — "With waterfall enrichment, you can access 150+ databases to maximize your coverage of contact info — or any other data point." (003-waterfall-enrichment.png)
- Fonctionnement : **"Search multiple providers sequentially to maximize data quality and coverage… until you find a valid match. This routinely triples our customers' data coverage and quality!"** (003-waterfall-enrichment.png)
- Providers cités nommément : emails pro = "Prospeo, DropContact, Datagma, Hunter, PeopleDataLabs, Nimbler, Apollo, Lusha, Snov, & more" ; emails perso = "Nimbler, Retention.com, Mixrank" ; mobiles = "People Data Labs, ContactOut, Selligence & more" (003-waterfall-enrichment.png).
- **"Waterfall enrichment for any data point — from technology stacks to job openings"** ; "Try 20+ waterfalls for free" (003-waterfall-enrichment.png).
- Data marketplace : "Buy data from 150+ providers in one place" (nav) / "200+ data and AI vendors" (home) — les deux chiffres coexistent sur le site (001-home.html).
- Économie : "If an enrichment returns no result, you're not charged Data Credits or Actions." et BYO API key = 0 Data Credit (FAQ pricing, 006-pricing.png).
- Preuve client : "Anthropic 3x'd their enrichment rate with Clay's data marketplace." (001-home.png)

### signals-intent
- Page dédiée : **"Track signals your competitors aren't even looking for yet"** — "Beat the market by tracking custom signals others aren't looking for — and enriching every signal with context they're lacking." (004-signals.png)
- **Signaux custom depuis N'IMPORTE quelle donnée** : "Turn any of Clay's 200+ enrichments or a AI agent query into a signal. That can include first-party product usage, tech stack changes, Claygent analyses of website content changes, and more." (004-signals.png)
- Types documentés : job changes/promotions/new hires ("Track career movement"), news ("from security breaches to product launches to new company investments"), social listening ("Monitor content with keywords on LinkedIn, Reddit, & YouTube"), web intent ("Track when high-value accounts visit key pages on your website… automatically alert your sales reps") (004-signals.png).
- Recettes clients concrètes ("Signals in the wild") : Vanta surveille 4 signaux (annonces SOC2, changements de site liés compliance, funding, postes CISO ouverts) ; Density surveille la **date d'expiration des baux de bureaux** des prospects ; Cursor écoute LinkedIn/YouTube/Reddit ; Rippling géolocalise les job changers pour du direct mail (004-signals.png).
- Approche multi-signaux : "Use a custom, multi-signal approach… Enrich each signal with superior context and pair it with the right automated or manual actions on your CRM, email, Slack, or other platforms." (004-signals.png)
- Gating pricing : job change/news/social dès Launch ; web intent + webhooks dès Growth (006-pricing.png).

### ai-decisioning
- **Sculptor** (v1.0), "Clay's AI copilot" : "It takes your business context and guides workflow setup, recommends enrichments, and provides insights on your data — all using natural language." ; "Chat with Sculptor to find common patterns in your data and **know who to prioritize outreach to, and when and how you should reach out to them**." (007-sculptor.png)
- Lead scoring/routing en use case : "Enrich, score, and route every lead to the right rep in minutes." ; "Prioritize the highest-converting leads using real-time intent and engagement signals." (001-home.png)
- Cas : "Lovable booked 50% more qualified meetings per rep by routing prospects to best-fit rep based on firmographics and current company priorities." (001-home.png)
- Note : la décision reste orchestrée par l'utilisateur (workflows/tables) — pas d'autopilot de bout en bout revendiqué.

### personalization
- Sequencer : **"The most data-driven AI Copy in the market. Imagine if your entire email was custom instead of just one field. Use Claygent and 150+ data providers craft messaging tailored to each lead."** — "Key benefit: Outbound that feels 1:1 at scale." (005-sequencer.png)
- Home : "Write 1:1 messaging for every prospect programmatically." ; cas Rippling : "2x'd cold email performance by automatically tailoring email copy based on persona and enriched account data." (001-home.png)

### sequencer
- **Clay Sequencer**, "The native campaign engine inside Clay" — "helps Growth Marketing and Demand Gen teams build campaigns combining the right time, the right person, and the right message." ; "it unifies always-updated data, intent signals, and AI-powered copy" (005-sequencer.png).
- Angle différenciant affiché : "Simplified stack — Centralized data + native sequencer = fewer tools, stronger attribution." et "Replace multiple point-solutions with one flexible GTM platform." (005-sequencer.png)
- Envoi natif dès le plan Free ("Send emails with Clay sequencer") ; intégrations vers sequencers externes = plan payant (006-pricing.png).

### multichannel-linkedin
- Pas de séquenceur LinkedIn (DM/invitations) documenté sur le site public — **non documenté sur le site**.
- Multicanal via : **Ads** ("Sync targeted ad audiences to Linkedin, Meta, and Google") (001-home.html, 006-pricing.png : "Push audiences to ads platforms… Includes 1 Ads audience" sur Growth, illimité Enterprise) ; actions CRM/Slack/email déclenchées par signaux (004-signals.png) ; direct mail évoqué uniquement comme pratique client (Rippling) et livestream "How Clay Uses Clay: ABM campaigns / direct mail" (001-home.html).
- Social listening LinkedIn/Reddit/YouTube côté signaux (004-signals.png).

### gifting
- Non documenté sur le site (Sendoso apparaît comme client, pas comme feature).

### deliverability
- Sequencer : **"Best-in-class deliverability — Built-in warming, alias management, and domain rotation."** — "Key benefit: Personalized campaigns land in the inbox, not spam." (005-sequencer.png)
- Pas de page dédiée délivrabilité, pas de détails (pools, taux, monitoring) — au-delà de cette phrase, non documenté.

### reply-handling
- Sequencer : **"Flexible reply flows — Custom, automated logic that adapts to how leads engage. Meet reps where they are, whether it be Slack or their inbox."** (005-sequencer.png)
- Cas Verkada : "2x'd warm lead replies by automatically analyzing email replies to route to the right nurture campaign." (001-home.png)

### booking
- Non documenté sur le site (aucune feature de prise de RDV/calendrier trouvée sur les pages capturées ni dans la nav).

### learning-analytics
- Attribution : "Enjoy enhanced attribution with integrated data and sequencer capabilities, leading to clearer reporting." ; "Better attribution — Data + sequencer in one system makes reporting clean." (005-sequencer.png)
- Sculptor : "instant insights — from health checks and pipeline snapshots to deeper analysis" (007-sculptor.png)
- Credit reporting dashboard inclus sur tous les plans (006-pricing.png).
- **Boucle d'apprentissage auto-améliorante (outcomes → copy/ciblage) : non documentée sur le site.** L'itération des agents est manuelle/outillée : "Test outputs across different model or prompt changes and roll back to any prior version" (002-claygent.png).

### compliance
- Badges sur la page pricing : **SOC 2 Type II** ("Request our SOC 2 in our Trust Center"), **GDPR** ("Go to market anywhere in the world — let us handle compliance with local laws."), **CCPA** ("Support your customer base with opt out and DNC support."), **ISO 27001**, **ISO 42001** (norme de management de l'IA) (006-pricing.png).
- Trust Center : trust.clay.com (lien nav "Security at Clay") ; footer "Do not sell my data" ; "Custom CSA and DPA" réservé Enterprise (006-pricing.png).

### pricing-model (détaillé en §3)

### other — Claygent (agent IA de recherche)
- Page /claygent : **"Scale your competitive edge with AI agents for GTM — Claygents research the web, orchestrate workflows, and create content to execute plays – all connected to your first and third party data."** (002-claygent.png)
- **"The data other providers can't find, but Claygent can"** — "SDRs often spend hours on personalized research… Claygent automates finding data other providers can't at scale." (002-claygent.png)
- **Navigator** : "Claygents don't just read pages — they interact with them. Apply filters, fill out search forms, click buttons, and retrieve structured data from sites that don't make it easy to access." (002-claygent.png)
- **"Access all frontier models"** : "Run Claygent on any of the frontier models or on Claygent-tuned models… Use your own API key or Clay-managed keys." (002-claygent.png)
- **Claygent Builder** : "Describe what you want your agent to do in natural language using Sculptor… turns it into a production-ready prompt. Refine conversationally, track versions, and revert anytime. No prompt engineering expertise required." ; "Test your agent on real data without burning credits… Know your agent is production-ready before you deploy it at scale." ; "Deploy once, update everywhere… Update the prompt in one place and it propagates to every deployment." (002-claygent.png)
- How it works en 4 étapes : DESCRIBE WHAT YOU WANT → ADD YOUR CONTEXT (upload de documents, business context, toggle contacts & jobs) → TEST AND ITERATE → DEPLOY EVERYWHERE (002-claygent.png).
- Exemples : "Intercom uses Claygent to find companies that have a public support database", "Canva analyzes brand uniformity of the website of potential prospects", "OpenAI used Clay to fully automate pre-call prep" (001/002).
- Autres briques : Clay MCP, Functions, AI formatting, Clay for Salesforce, Reverse ETL, intégrations data-warehouse natives "Snowflake, Fivetran, Postgres, Databricks, and BigQuery" (Enterprise) (001-home.html, 006-pricing.png).

## 3. Pricing (006-pricing.png + FAQ de la même page)

**Modèle à double compteur** (verbatim : "Usage-based pricing — Actions measure platform usage: enrichment & GTM execution. Data credits buy data & AI from vendors in Clay's marketplace.") :
- **Actions** = travail plateforme (enrichir, lancer une table, appeler un modèle IA, pousser vers un outil tiers, exporter). "Actions start at less than $0.01 each and get cheaper with scale." Reset chaque cycle, **pas de rollover**.
- **Data Credits** = achat de data/IA au marketplace. "Data Credits start at $0.05 each and become more cost-effective as you grow." **Rollover** : jusqu'à 2x le montant mensuel (Launch/Growth) ; 15% de l'année précédente (Enterprise). Top-ups : "Buy more at a 30% premium" (Launch/Growth).
- BYO API key (data ou IA) : "you skip Data Credits entirely and only use Actions".
- IA : "80% of models in Clay continue to cost a flat number of Data Credits per task" (fixed-price) ; modèles token-intensifs ("e.g., GPT-5.1 and Claude 4.6 Sonnet") en **variable, facturés au token consommé "with no markup… frontier models at true cost"** ; les modèles variables affichent une estimation "~" et "75% of runs cost less than the estimate" ; "AI runs are 2x faster using Clay's API keys… because of the higher rate limits that Clay has negotiated".

**Tiers (toggle Annual ∙ Save 10% affiché ; prix cartes = annuel)** :
| Plan | Prix affiché (annuel) | Prix FAQ (départ) | Actions | Data credits | Points clés |
|------|----------------------|-------------------|---------|--------------|-------------|
| Free | Free | — | 6,000 actions/yr (FAQ : 500/mo) | 1.2K/yr (FAQ : 100/mo) | Seats et tables illimités, waterfalls, Claygent, sequencer email, 200 lignes/table, pas de téléphones |
| Launch | **$167/mo** ("Starts at $54/mo, expand anytime") | "starting at $185/mo" | 180,000/yr, extensible : 30K/yr ($113/mo), 72K ($261), 120K ($414), 240K ($792), 600K ($1,913) | 30K/yr | + téléphones, signaux (job change, news, social), Audiences search illimité, 50K lignes/table, campagnes email via intégrations |
| Growth | **$446/mo** (Recommended, "Starts at $185/mo") | "starting at $495/mo" | 480,000/yr | 72K/yr | + auto-sync CRM/DWH, HTTP API, webhooks signaux, web intent, 1 ads audience, support prioritaire |
| Enterprise | Custom | "custom pricing with annual commitment" | 200,000+/mo (FAQ) | 100,000+/mo (FAQ) | + ads audiences illimitées, imports illimités, SSO, RBAC (budget crédits par workbook), DWH syncs, CSA/DPA custom, growth strategist dédié, bulk data en add-on, sync 15 min (vs 1 jour) |

- Essai : "Start 14-day trial" sur Free/Launch/Growth ; "Start for free today. No credit card required."
- Écart cartes vs FAQ ($167 vs $185 ; $446 vs $495) : cohérent avec la remise annuelle de 10% ($185×0.9=$166.5 ; $495×0.9=$445.5) — les cartes affichent le prix annualisé, la FAQ le prix de départ mensuel.
- "Pricing calculator" proposé en CTA (non exploré, derrière la même page).

## 4. Patterns UX observés

1. **Prompt-box conversationnelle sur la homepage** : "What do you want to build?" + exemples cliquables de requêtes de sourcing en langage naturel + toggles "Find people data / Find company data / Find jobs data" — l'entrée produit est un prompt, pas un formulaire (001-home.png).
2. **Carrousel d'use cases à onglets** : TAM Sourcing / Automated Inbound / Lead Scoring / Automated Outbound / CRM Enrichment / Launch Ads / Rep Productivity, chaque onglet = 1 phrase de valeur (001-home.png).
3. **Preuve par métrique client omniprésente** : cartes "métrique + logo" partout (+140% outbound pipeline Intercom, +50% win-rate Hex, 2x cold email Rippling, +25% revenue/rep Pump, 2.5x pipeline-to-cost Merge, 2x SDR capacity Harmonic) (001-home.png, 006-pricing.png).
4. **Agent-builder en 4 étapes avec test avant scale** : Describe → Add context → Test (sur échantillons, sans consommer de crédits, comparaison de versions/modèles, rollback) → Deploy everywhere (propagation centralisée) — pattern de CI/CD pour prompts (002-claygent.png).
5. **Pricing à géométrie variable dans la carte** : dropdown de paliers d'actions DANS la carte du plan (30K→600K/yr avec prix/mois recalculé), + tableau comparatif complet + FAQ très détaillée sur l'économie des crédits (006-pricing.png).
6. **"Signals in the wild"** : la page signaux vend par recettes clients ultra-concrètes (bail de bureaux qui expire, badge SOC2, posts CISO) plutôt que par liste de features (004-signals.png).
7. **Direction artistique claymation 3D ludique** (personnages pâte à modeler, piscine à balles en footer, badges-fleurs pour les certifs) + "Born in Brooklyn" — anti-corporate assumé (toutes captures).
8. **⌘K command palette dans la nav marketing** (001-home.png).
9. Détail : la méga-nav contient des placeholders Webflow non remplis ("Link long form description will go in this slot here.") répétés sur toutes les pages (001-home.html).

## 5. Canaux couverts

- **Email** : natif (Clay Sequencer, dès le plan Free) + intégrations vers sequencers externes (payant) (005/006).
- **Ads** : audiences synchronisées vers LinkedIn, Meta, Google Ads (001/006).
- **CRM / Slack** : actions automatiques sur signaux ("automated or manual actions on your CRM, email, Slack") (004-signals.png).
- **Téléphone** : enrichissement de numéros seulement (pas de dialer documenté) (003/006).
- **LinkedIn outreach (DM/invitations)** : non documenté sur le site — LinkedIn n'apparaît que comme source de signaux/social listening et destination Ads.
- **Direct mail** : pratique client documentée (Rippling), pas une feature produit.

## 6. Discours IA

- "run **agentic workflows**" (hero) ; Claygents = "AI agents for GTM" qui "**mimic your best reps**" (001/002).
- Accès à "**all frontier models**" + "Claygent-tuned models, optimized for high quality output at the best price" ; choix Clay-managed keys vs BYO keys (002).
- **Sculptor** = copilot IA en langage naturel ("No prompt engineering expertise required") qui construit workflows, recommande des enrichissements et analyse les données (002/007).
- Transparence des coûts IA revendiquée : modèles frontier "at true cost… no markup" (006, FAQ).
- Certification **ISO 42001** (management de l'IA) mise en avant à côté de SOC2/ISO27001 (006).
- Positionnement : l'IA est un outil d'exécution entre les mains d'un humain ("GTM engineer") — pas un autopilot autonome. Le mot "autopilot" n'apparaît sur aucune page capturée.

## 7. Délivrabilité

- Une seule mention substantielle : "Built-in warming, alias management, and domain rotation" + "land in the inbox, not spam" (005-sequencer.png). Pas de page dédiée, pas de chiffres, pas de détail sur les boîtes/domains fournis — non documenté au-delà.

## 8. Transparence de la boucle d'apprentissage

- Non documentée en tant que boucle automatique : rien sur du learning à partir des réponses/outcomes. Ce qui existe est de l'**itération manuelle outillée** : test de Claygents sur échantillons, comparaison de sorties entre versions/modèles, rollback, propagation centralisée (002-claygent.png) ; et de l'**attribution/reporting** côté Sequencer (005-sequencer.png).

## 9. RGPD / conformité

- SOC 2 Type II (rapport via Trust Center), GDPR ("let us handle compliance with local laws"), CCPA (opt-out + DNC), ISO 27001, ISO 42001 (006-pricing.png) ; trust.clay.com ; "Do not sell my data" en footer ; DPA/CSA custom en Enterprise (006-pricing.png).

## 10. Faits notables

- **$5B de valorisation** (référence NYT affichée dans la nav) ; blog "Clay reaches 100M ARR" et "Series C: The GTM engineering era begins now" (001-home.html).
- **"500,000+ leading GTM teams"** (claim du site, non vérifiable).
- Logos clients de premier plan : OpenAI, Anthropic, Mistral AI, Figma, Canva, Cursor, Rippling, Intercom, Vanta, Verkada, Hex, ElevenLabs, Lovable, Pendo, Google (001/002/004/006).
- **Audiences lancé le jour de la capture** ("Launching today") — consolidation 1st/3rd party data.
- **Sequencer natif = mouvement récent vers l'exécution** : Clay passe de "data pour vos outils d'outreach" à "remplacez vos outils d'outreach" ("Replace multiple point-solutions with one flexible GTM platform").
- Écosystème très développé : Clay University (cours, cohortes), communauté Slack, programme d'experts certifiés, job board "GTME", conférence propre (Sculpt, oct 2026 SF), Clay Cup (001-home.html).
- Clay MCP dans la nav produit (agents externes peuvent piloter Clay) — page non capturée.
- Top-ups de crédits facturés **+30% de premium** — le modèle pousse vers l'upgrade de tier (006).

## 11. Ce que le site NE documente PAS (pertinent pour Elevay)

- Pas de séquenceur LinkedIn natif (DM/connexions), pas de dialer, pas de booking/calendrier, pas de gifting.
- Pas d'inbox unifiée / gestion de réponses au-delà des "reply flows".
- Pas de boucle d'apprentissage automatique sur les outcomes.
- Pas d'autopilot de bout en bout : tout est construit table par table, workflow par workflow, par un opérateur ("GTM engineer") — c'est un outil d'expert, l'opposé du "zero config" d'Elevay.
- Délivrabilité traitée en une ligne — pas un axe de vente.
