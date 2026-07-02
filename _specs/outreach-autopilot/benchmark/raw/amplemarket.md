# Benchmark concurrentiel — Amplemarket (www.amplemarket.com)

Date de capture : 2026-07-01. Pages publiques uniquement, aucun login. Aucun blocage anti-bot rencontré (8/8 pages capturées en headless).

Preuves :
- Screenshots : `_specs/outreach-autopilot/benchmark/screenshots/amplemarket/001-home.png` … `008-legal-gdpr.png`
- HTML brut : `_specs/outreach-autopilot/benchmark/html/amplemarket/001-home.html` … `008-legal-gdpr.html`

| # | Page | URL |
|---|------|-----|
| 001 | Homepage | https://www.amplemarket.com |
| 002 | Duo Copilot (AI copilot) | https://www.amplemarket.com/duo |
| 003 | Intent Signals | https://www.amplemarket.com/signals |
| 004 | Deliverability Booster (warmup) | https://www.amplemarket.com/email-deliverability-booster |
| 005 | Domain Health Center | https://www.amplemarket.com/domain-health-center |
| 006 | Multichannel Sequences | https://www.amplemarket.com/multichannel-selling |
| 007 | Pricing | https://www.amplemarket.com/pricing |
| 008 | GDPR | https://www.amplemarket.com/legal/gdpr |

---

## 1. Positionnement

Plateforme tout-en-un « Human + AI » pour équipes de vente, centrée sur un copilot IA (Duo) explicitement **human-in-the-loop** — c'est un copilot, PAS un autopilot autonome.

Citations verbatim (001-home.png) :
- H1 : **« Step into the future of sales: Human + AI »**
- Sous-titre : **« Empower reps, uncover opportunities, and grow revenue with an all-in-one AI platform. »**
- Badge répété sur toutes les pages : **« Generative AI Cool Vendor by »** [Gartner] (lien blog : « Amplemarket recognized as a Gartner® Cool Vendor™ in Generative AI for Sales »).
- Transcript vidéo homepage : **« Duo is the first AI sales agent that helps sales teams find and connect with their next customers. »**
- Transcript vidéo homepage (onboarding auto) : **« as soon as you sign up for Duo, it will go through your website, the web, and your CRM to learn everything about your company. It then creates a common brand for your entire sales team. A library of information about your competitors, target personas, case studies, value propositions, and even how to handle sales objections. »**
- Transcript : **« Duo learns every time you give it feedback like a coworker. »**

Page Duo (002-duo-ai-copilot.png) :
- H1 : **« Give every rep their own personal AI assistant »** — « Duo works alongside your reps to help them focus on the right buyers and win with confidence. »
- Slogan de section : **« AI-powered, human refined »**
- **« Human in the loop by design — Reps stay in control at every step. Duo suggests, learns, and improves, but never sends or changes things without visibility. »**
- FAQ : **« Under the hood, Duo Copilot is powered by multiple AI agents working together across signals, research, and outreach. »**

Angle commercial dominant : la **consolidation d'outils** — logos clients annotés « Migrated off Apollo », « Migrated off ZoomInfo + Outreach », « Migrated off Salesloft » (001-home.png, 007-pricing.png) ; citation « By cutting licenses and consolidating into Amplemarket, we cut tooling costs by about 56% » (007-pricing.png). Pages comparatives dédiées : vs ZoomInfo, Apollo, Lusha, Cognism, Outreach, Salesloft.

## 2. Features par catégorie

### Intelligence (pilier nav) — Duo (4 sous-produits)
- **Duo Copilot** : agents IA qui scannent le marché quotidiennement (« Duo uses AI agents to scan your market daily for buying signals and surface the exact people to contact ») ; agents de recherche pour le contexte (« Duo's AI research agents gather context behind each signal ») ; création de séquences multicanal par prospect. Feed de recommandations avec review/edit/regenerate/send en un clic (002).
- **Duo Copywriter** : « Create hyper-personal first-touches » ; se place comme un « stage » dans une séquence (006).
- **Duo Inbox** : « Automatically get draft replies for every prospect email » — Add-On sur le tier Growth, inclus en Elite (007-pricing.png).
- **Duo Voice** : « Send AI voice messages at scale » ; transcript homepage : voice notes personnalisées « leveraging your voice and using AI » (voice cloning, confirmé par témoignage « the voice cloning feature is surprisingly advanced », 001).
- Extras Duo (002) : **Custom signals** (« Bring your own signals from your CRM or via API »), **Account insights**, **Mailbox rotation** auto, **Territories** (« Route signals and prospects to the right reps using territories and other distribution rules »).
- Chiffres revendiqués Duo (002, attributs `data-target-number` dans le HTML — le rendu affiche des compteurs animés) : **100+** buying signals trackés par rep/semaine, **66%+** open rate sur leads Duo, **20%+** leads Duo « showing interest », **3.2x** more replies, **10h+** économisées par rep/semaine.

### Lead Generation & Signals
- **Searcher** : « AI that finds leads, backed by quality data » ; base B2B propriétaire, « 30+ filters » CRM base filters (007) ; claim « 200M real-time verified mobile numbers » (007, ligne Phone Number Credits).
- **Intent Signals** (003) : « Track buying signals others miss ». Catalogue de 20+ signaux groupés par source : **Slack** (membres + messages de communautés), **G2** (reviews négatives de concurrents), **Job changes** (ICP job changes), **Company activity** (funding, job openings, news), **CRM** (past customer/prospect job changes, closed-lost reactivation, custom CRM signals), **Website activity** (high-intent page visits, content downloads, abandoned form, inbound multithreading, account-level interest surge, produits interactifs), **Product usage** (trial ending, feature adoption velocity, team invites, usage spike/drop), **CRM activity** (lead score threshold, ghosted opportunity, renewal-based upsell 60-90 j avant), **Events** (webinar, conference MQLs), **Paid campaigns**, **Email activity** (surge d'opens, engagement sans reply), **External tools** (« Intent from Demandbase, 6sense and more », Dealfront/SimilarWeb via CRM).
- FAQ (003) : « First-party intent comes from your own properties… Third-party intent comes from external sources… Amplemarket combines both. »
- **Job Change Alerts** : produit dédié ; quotas 500/1 000/2 000 contacts suivis selon tier (007).
- **Competitive Intelligence** : « See exactly who's ready to buy now » (nav 001).
- **Data Enrichment** + **Email Validation** temps réel + **Calendar Enrichment** (« Cut down on meeting prep time with contact insights », 007).

### Multichannel Engagement
- **Multichannel Sequences** (006) : « Automate outreach across email, phone, and social » ; « AI builds your first multichannel sequence draft in seconds » ; **étapes conditionnelles** : « Set rules based on lead data: "no email → send social message" or "has phone → call next" — the sequence automatically adapts in real time » ; **A/B testing** ; **templates** ; **WhatsApp & iMessage** (« Send quick, personal follow-ups to warm prospects in one click ») ; **Parallel Dialing** (« Connect your dialer to run calls alongside email and social outreach ») ; FAQ : cadence typique « 8 to 12 touchpoints over three to four weeks, mixing email, social, phone, voice, and video messages ».
- **Unibox** (006) : « Amplemarket's Unibox centralizes all replies from email and social DMs into a single inbox ».
- **Social Prospecting** / **Social Automation** : « Engage leads directly from social media », « Save hours on click-heavy tasks » (nav 001) ; témoignages citent LinkedIn Sales Navigator comme l'outil remplacé.
- **Workflows + Workflow Recipes** : bibliothèque de recettes d'automatisation (sitemap : enforce-do-not-contact, stop-outreach-when-an-account-engages, switch-channels-on-bounce, respect-hard-no-replies, revive-closed-lost-deals, win-back-no-shows, multi-thread-after-a-booking, chase-interested-replies, act-on-rising-scores, route-inbound-leads, nurture-non-responders…).
- **Analytics** : « Monitor your outbound from every angle » ; FAQ signals (003) : « Amplemarket's analytics show how signals influence engagement and closed deals ».
- **Outbound Dialer** natif (007).

### Deliverability Optimization (pilier entier de la nav — 4 produits)
- **Deliverability Booster** (004) : warmup automatique — « Healthy email threads are started and replied to automatically across a network of accounts » ; ramp-up graduel ; Gmail/Google Workspace + Microsoft Outlook ; récupération de mailbox flaggée spam ; « All activity happens within a controlled network and is never sent to real prospects ».
- **Domain Health Center** (005) : dashboard unique — statut **SPF, DKIM & DMARC** par domaine ; **tests spam automatiques hebdomadaires** + **blacklist monitoring** ; **ratio outbox-to-inbox** (« A healthy ratio is below 4 ») ; suivi du Booster ; indicateurs par mailbox. Stats revendiquées : « 78%+ avg. open rate, 3.2x avg. reply rate, <3% avg. bounce rate, 25% avg. interested rate, <2% avg. spam rate ».
- **Email Spam Checker** : « Spot delivery issues before they escalate » (nav) ; **Inbox Placement Tests** (page dédiée dans le sitemap).
- **Mailbox Recommendation** : « Use the right mailbox every time » / « Select mailboxes that guarantee inbox delivery » (007).
- Claim agressif (005, FAQ) : « scoring **21 out of 21 in deliverability** in independent feature evaluations. Most competing sales platforms score zero in this category » — auto-évaluation, non vérifiable.

### Boucle d'apprentissage (002 — section « Built to learn from every action your reps take »)
Transparence inhabituelle : 4 mécanismes nommés.
1. **« Learns from what reps dismiss »** — « When reps dismiss a recommendation as the wrong company or not the right person, Duo learns why and avoids similar leads in the future. » (le rep donne la raison du dismiss dans le feed)
2. **« Learnings applied across signals & personas »** — « Feedback on one recommendation helps improve others, so teams don't have to fix the same issues repeatedly. » (propagation à toute l'équipe)
3. **« Messaging that adapts to your edits »** — « When reps consistently edit Duo's suggested sequences, Duo picks up those patterns and updates messaging preferences automatically. »
4. **« Human in the loop by design »** — « never sends or changes things without visibility ».

## 3. Pricing (007-pricing.png)

Modèle : **plateforme par paliers, prix par équipe avec users inclus + crédits data par user/an**. « All plans include a free trial » (bouton Startup : « Request 14-day trial » ; Growth/Elite : « Book a demo »). Un seul prix public.

| | **Startup** | **Growth** (POPULAR) | **Elite** |
|---|---|---|---|
| Prix | **$600/mo (annual term)** | **Custom** | **Custom** |
| Users inclus | 2 (users additionnels achetables) | 4 | 10 |
| Contacts | 27 000 | 140 000 | 400 000 |
| Email credits / user / an | 13 500 | 35 000 | 40 000 |
| Phone credits / user / an | 600 | 5 000 | 9 600 |
| Custom data requests | 0 | 4 | 12 |
| Job change alerts | 500 contacts | 1 000 | 2 000 |
| Mailboxes / user (à partir de) | 2 | 4 | 8 |
| Duo Copilot / Copywriter / Signals / Competitive Intel | oui | oui | oui |
| Duo Voice | non | oui | oui |
| Duo Inbox | non | **Add-On** | oui |
| CSM | Scaled + Community onboarding | Dedicated + Personalized onboarding | Dedicated + Personalized |
| SSO | non | non | oui |

Multichannel Sequences, Workflows, Analytics, Outbound Dialer, et TOUTE la suite délivrabilité (Domain Health Center, Booster, Spam Checker, Mailbox Recommendation) sont cochés sur les 3 tiers.

## 4. Patterns UX observés

- **Nav méga-menu en 4 piliers produit** : Intelligence / Lead Generation & Signals / Multichannel Engagement / Deliverability Optimization — la délivrabilité est promue au rang de pilier de premier niveau (001).
- **Marquee de cartes-signaux défilantes** (~50 exemples concrets : « Sam rated Competitor B 1-star on G2 », « Closed-lost prospect Bill is looking for solutions », « Champion Dan changed jobs recently ») pour matérialiser le feed de signaux — sur home ET page Duo (001, 002).
- **Sections « How sales teams use X »** : questions à la 1re personne (« Can Duo learn from my feedback? ») + walkthrough numéroté en 3 étapes + vidéo produit chapitrée (002, 005, 006). Vend le workflow, pas la feature.
- **Compteurs animés** pour les stats de preuve (`data-target-number` dans le HTML ; le texte statique affiche des placeholders) (002, 005).
- **FAQ accordéon SEO-heavy** en bas de chaque page produit, avec réponses très concrètes (ratio < 4, 8-12 touchpoints…) (003, 004, 005, 006).
- **Capture d'email dans chaque section CTA** avec validation « Please enter a valid business email » (toutes pages).
- **Preuve par migration** : logos clients systématiquement annotés « Migrated off <concurrent> » (001, 007).
- **Wall of Love** : mur massif de citations clients verbatim, réutilisé sur home et pricing (001, 007).
- **Pricing 1 prix public + 2 tiers custom** avec table comparative complète organisée par les 4 piliers produit (007).
- **« Ask AI about Amplemarket »** dans le footer + pages dédiées /ai/chatgpt, /ai/claude, /ai/gemini, /ai/grok, /ai/perplexity (SEO pour les réponses des LLM) + blog « AI citation-share leaderboard » (001).
- Page GDPR rédigée comme un **argumentaire commercial** (« complying with data protection means better business ») et non comme une page légale sèche (008).

## 5. Canaux couverts

Email (multi-mailbox + rotation), LinkedIn/social (connexions, DMs, social prospecting/automation — « social » générique sur le site, les témoignages parlent de LinkedIn/Sales Navigator), téléphone (dialer natif + parallel dialing), WhatsApp, iMessage, voice notes IA (Duo Voice, sur les canaux sociaux). FAQ 006 mentionne aussi « video messages » dans les cadences. Gifting : non documenté sur le site.

## 6. Discours IA

- Duo = « **the first AI sales agent** » (transcript 001) mais l'exécution est **copilot human-in-the-loop** : « Duo suggests, learns, and improves, but never sends or changes things without visibility » (002). Pas de mode full-autopilot documenté sur le site public — le rep approuve (« You just have to approve it, and that's it », transcript 001).
- Architecture revendiquée : « multiple AI agents working together across signals, research, and outreach » (FAQ 002).
- Onboarding IA automatique : crawl du site web + web + CRM → « common brand », bibliothèque concurrents/personas/case studies/value props/objections (transcript 001).
- Différenciation revendiquée vs autres outils IA : intent au **niveau contact individuel** (pas seulement account-level), séquences multicanal complètes (pas juste des emails), apprentissage par feedback (FAQ 002).
- Nouveauté blog 16 juin 2026 : « pre-meeting intelligence in your calendar, **MCP sequence creation** » — support MCP (Model Context Protocol) pour créer des séquences.

## 7. Délivrabilité (résumé)

Suite native à 4 produits + monitoring : warmup par réseau contrôlé (Booster), Domain Health Center (SPF/DKIM/DMARC, spam tests hebdo, blacklists, ratio outbox/inbox < 4), spam checker/inbox placement tests, mailbox recommendation, mailbox rotation, multi-mailbox par user (2/4/8 selon tier). AI scheduling mentionné sur home (« Boost your open rates by up to 50% with AI scheduling, deliverability testing, and smart warmup », 001). C'est LE différenciateur qu'ils martèlent (« 21 out of 21 … Most competing sales platforms score zero », 005 — claim auto-scoré).

## 8. RGPD / conformité (008-legal-gdpr.png)

- Base légale assumée : **intérêt légitime** (« Consent is not the only option. Legitimate interest is a valid legal ground for B2B outbound prospecting »).
- Mécanismes produit : **geo-fencing / « Lead fencing mechanism for the EU »** (exclure des régions entières de la base accessible), **exclusion lists** uploadables, **ML qui ajoute automatiquement les opt-outs aux exclusion lists**, **liens unsubscribe forcés** dans toutes les séquences, **footnote légale automatisée** dans les emails (exemple verbatim fourni : « P.S.: I reached out because I genuinely think you might benefit from what we do… »), réponse aux Data Subject Requests.
- Sécurité : **SOC 2 Type II** audité annuellement, pen test annuel tiers (rapports sur leur Trust Center), chiffrement transit + repos, uptime ≥ 99,5 %, RTO/RPO < 24 h, data centers US, **Data Privacy Framework** certifié, OAuth pour intégrations (Google, Microsoft, Salesforce, Hubspot).
- Note CCPA : « we may be considered a **Data Broker** instead of a data processor » (US). Data strictement B2B (« Our data is strictly business-oriented »). Contact : privacy@amplemarket.com. Pages légales : /legal/ccpa, /legal/do-not-sell-my-info, /legal/security, /legal/data-broker-privacy-notice.

## 9. Faits notables

1. **Gartner « Cool Vendor in Generative AI for Sales »** — badge affiché sur chaque section CTA de chaque page.
2. Le **pilier Deliverability entier est inclus dès le tier Startup** — utilisé comme arme anti-Apollo/Outreach.
3. **Duo Inbox (draft replies) vendu en Add-On** sur Growth — la génération de réponses est monétisée séparément.
4. Boucle d'apprentissage **documentée publiquement avec 4 mécanismes nommés** (dismiss-reasons, propagation équipe, adaptation aux edits, HITL) — rare chez les concurrents.
5. **Custom signals via CRM ou API** + intent tiers (Demandbase, 6sense) ingéré — le moteur de signaux est ouvert.
6. **Territories/règles de distribution** pour router les signaux vers le bon rep — orienté équipes, pas solo founder.
7. **MCP sequence creation** annoncé (blog, 16 juin 2026) — ils s'ouvrent aux agents externes.
8. Play **LLM-SEO** : pages /ai/claude, /ai/chatgpt… + « Ask AI about Amplemarket » + leaderboard « AI citation-share » sur le blog.
9. Persona « founder-led sales » explicitement ciblé : tier Startup « Perfect for small businesses, startups, & founder-led sales teams » + page /amplemarket-for-founders — concurrence frontale avec le cœur de cible Elevay.
10. Chiffres d'efficacité revendiqués (non vérifiables) : jusqu'à 100 % more replies, +50 % open rates, 60 % meetings bookés en plus, 10 h/semaine économisées (001, 002).

## 10. AFFIRMÉ vs VÉRIFIABLE

- VÉRIFIÉ (visible sur le site) : structure produit, catalogue de signaux, tiers pricing et quotas, mécanismes RGPD décrits, existence des 4 produits délivrabilité, discours HITL.
- AFFIRMÉ non vérifiable : tous les chiffres de performance (66 % open rate, 3.2x replies, « 21/21 deliverability », 200M mobile numbers, 56 % de réduction de coûts), la réalité de l'apprentissage de Duo, la qualité de la base de données. Le « 21 out of 21 » provient de leur propre index auto-scoré (blog « B2B data providers ranked… the 2026 self-scored index »).
- Non documenté sur le site public : prix Growth/Elite, coût du Add-On Duo Inbox, prix des users additionnels, gifting, scheduler/booking natif (seuls des workflow recipes autour des bookings existent), détails du modèle ML.
