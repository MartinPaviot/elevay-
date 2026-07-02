# Benchmark concurrentiel — Lemlist (www.lemlist.com)

Date de capture : 2026-07-01. Méthode : Playwright chromium headless (UA Chrome 131, 1440x900, locale en-US), pages publiques uniquement, aucun login. Aucun blocage anti-bot rencontré (titres de pages normaux, pas de challenge Cloudflare).

Preuves :
- Screenshots : `_specs/outreach-autopilot/benchmark/screenshots/lemlist/001..007*.png`
- HTML brut : `_specs/outreach-autopilot/benchmark/html/lemlist/001..007*.html`

Pages capturées :
1. `001-home` — https://www.lemlist.com
2. `002-pricing` — https://www.lemlist.com/pricing
3. `003-lemagent` — https://www.lemlist.com/product/lemagent
4. `004-multichannel-sequences` — https://www.lemlist.com/product/multichannel-prospecting
5. `005-intent-signals` — https://www.lemlist.com/product/intent-signals/
6. `006-inbox-delivery` — https://www.lemlist.com/product/inbox-delivery
7. `007-ai-smart-messaging` — https://www.lemlist.com/product/ai

---

## 1. Positionnement

Citations verbatim (001-home.png / 001-home.html) :
- Hero : **« The AI Outbound Platform for Relevant Outreach at Every Scale »**
- Sous-titre hero : **« Cover your TAM with AI agents that research, personalize, and engage prospects on autopilot. Run multichannel outreach for strategic accounts powered by real context and intent signals. »**
- Section : « From full TAM coverage to your top accounts, run outreach that still feels 1:1 »
- FAQ : « lemlist is an AI-powered sales engagement platform that finds leads, personalizes outreach, and runs multichannel campaigns (email, LinkedIn, calls, WhatsApp, SMS) - all in one place. »
- Social proof : « & 20,000+ other sales teams run their entire outbound in lemlist » ; « Recognized by G2. Trusted by thousands. 4.7 / 5 based on 1,396 reviews | GDPR Compliant ».

Pricing (002-pricing.png) : **« The all-in-one platform for precise outbound, at any scale »**.

Lecture : Lemlist a pivoté d'un « cold email tool » vers une plateforme outbound « AI agents » couvrant tout le funnel (TAM → signaux → enrichissement → multicanal → délivrabilité). Le mot « autopilot » est utilisé explicitement dans le hero. Cibles affichées : Sales Reps, RevOps, Sales Leaders, Founders (nav « lemlist for »). Éditeur : lempire (footer « © 2026 lempire »).

## 2. Features par catégorie (avec preuves)

### TAM / ingestion
- Base de leads **« 650 M+ Lead Database »** (nav produit, 001-home) — le copy du home dit aussi « Use the 600M+ lemlist database and smart filters to find accounts that match your ICP » (incohérence 600M/650M sur le même site).
- Import « Upload leads from your CRM or CSV » (001-home, bloc 01).
- « Account-based prospecting », « Unlimited contacts », « Centralized contact management », « Unlimited LinkedIn leads export », « CSV leads export » (table comparative, 002-pricing).
- lemAgent : recherche de la base en langage naturel — « Searches the lemlist database using plain language. Describe who you're looking for, it returns a list, and you refine it in the same conversation. » (003-lemagent).

### Enrichment
- Email Finder & Verifier + Phone Number Finder — « enrich them with verified emails and phone numbers from the market's top data providers » (001-home) ; « Find reliable emails and phone numbers from top 25+ data providers » (002-pricing) → waterfall multi-providers.
- Affirmation : « Get 80% of leads' emails with Email Finder » (004-multichannel-sequences) — non vérifiable.
- **Data Enrichment Agents** : « pull structured insights from LinkedIn, websites, CRM data, Claap sales recordings, and other internal sources » (001-home, bloc 03). Claap = produit lempire (call recording).
- « AI leads data cleaning », « AI web search enrichment », « Unlimited LinkedIn enrichment » (002-pricing, table).
- Facturation au succès : « Pay per success with rechargeable lemlist credits (1 credit = 0.01€) » — email vérifié 5 crédits (0,05 €), téléphone 20 crédits (0,20 €) ; « 1k credits - 200 emails or 50 phones - 10€ » (002-pricing.png).

### Signals / intent
- **Intent Signal Agents** (page dédiée 005-intent-signals) : « AI agents that spot when leads are ready & trigger outreach ».
- Signaux listés : Company is hiring / Company visited my website / Company raised funds / Contact changed jobs / Engaged with LinkedIn profile, company, or topic / Company changed tech stack (005-intent-signals.png).
- Détection (FAQ 005) : « tracking website visits (via IP matching), LinkedIn engagement, and job postings from sources such as LinkedIn, ATS platforms (Lever, Greenhouse, Workable, etc.), and company career pages ». Le signal web-visiteurs exige un snippet de tracking sur le site.
- Signaux custom : « Need more specific signals? Ask lemlist a question and let it scan the web daily for relevant updates » (005).
- « lemlist radar » : watchlist temps réel — « The moment a tracked action happens, you get a real-time update in your watchlist. Act on it at your pace, or **let lemlist push new leads into campaigns and trigger outreach on autopilot** » (005).
- Signal → contexte : « key event insights are captured as variables. Use those variables to prompt AI-generated icebreakers » (005).
- Prix par signal (002-pricing.png) : visite web 20 crédits (0,20 €), hiring & job changes à partir de 100 crédits (1 €), levée de fonds 100 crédits (1 €), engagement LinkedIn à partir de 400 crédits (4 €). Signaux disponibles sur tous les plans, payés en crédits (FAQ 005).
- « Leads scoring » listé dans « Data & Lead Generation — Included in all plans » (002-pricing) + prompt IA « Score how well lead fits your ICP » (007) — aucun détail public sur un modèle de scoring ML.
- FAQ différenciation : « Unlike intent-only tools (like Bombora or 6sense), lemlist doesn't just show signals - it helps you act on them instantly. Everything happens in one place: detect → personalize → outreach. » (005).

### AI decisioning
- **lemAgent** (nouveau, page 003) : constructeur de campagne conversationnel — « Chat with lemAgent to find buyers, enrich contacts, create multichannel sequences, or improve messaging. Then let it execute directly in lemlist. » Titre : « Your next campaign is one conversation away ».
- Part du but, pas du template : « lemAgent starts from your goal, not from a blank template » ; génère « the full sequence with branching logic, every message across every channel ».
- **HITL explicite** : « lemAgent builds the campaign. You still run the show. **Nothing goes out without your sign-off.** » et « You validate. You launch. Done. » (003).
- Mémoire : « Company context » (positionnement/produit, set once), « Team memories » (ICPs partagés équipe), « My memories » (« Add it manually or let it learn from your conversations ») (003).
- Analyse : « Reads your active and past campaigns, looks at open and reply rates across each step, and surfaces specific suggestions on what to fix » (003).
- Temps annoncé : « Most campaigns are ready in under 15 minutes » (FAQ 003).
- Décision automatique côté signaux : enrôlement auto en campagne sur détection de signal (005, voir ci-dessus).
- Table pricing « AI-powered Outbound — Included in all plans » : lemAgent, Intent signal agents, URL-scraping agent, LinkedIn agents, Claap agents, AI reply intent detection, AI out-of-office detection, AI-generated replies (002-pricing).

### Personalization
- **Smart Messaging / lemlist AI** (007) : « Engage with leads in a human way, at machine speed ».
- Variables IA + nettoyage de data : « Normalize dates, capitalize names, clean job titles, remove emojis » ; segmentation IA (company size, seniority, job openings, fundraising) (007).
- Recherche par lead : « gathering key insights like competitor data and top pain points from LinkedIn bios, websites, and more » (007).
- **Clonage de voix** : « Let lemlist AI clone your voice from one recording. Add a script with smart variables and turn it into 1000s of custom notes » → « AI personalized LinkedIn voice notes » (007 + table 002-pricing, plan Multichannel).
- « Ask AI » assistant de réécriture (ton, longueur, impact) (FAQ 007).
- Personnalisation historique lemlist : « Adapt email copies, graphics, and even landing pages on autopilot » (004) — images et landing pages personnalisées ; « Liquid Syntax », « Custom text & images » (002-pricing).
- Fait notable (007, FAQ) : « lemlist AI sources data via your OpenAI account, which you can link to your lemlist » → au moins une partie des features IA historiques tourne en **BYO clé OpenAI** (page probablement plus ancienne que lemAgent).

### Sequencer
- Séquences multicanal depuis « one synced campaign » (004) ; « Conditioned next steps » / « advanced conditions » : « auto-adjust campaign steps based on lead interactions, like calling after no reply » (004).
- « Campaign scheduling », « Campaign auto-launch », « Auto-stop campaign », « Campaign review », « Step preview », « Multi-threading », « Manual steps » avec rappels (002-pricing table + 004).
- A/B testing de séquences entières : « A/B test full sequences with different channel mixes » (FAQ 004).
- Bibliothèque de templates communautaires : « Duplicate best-performing campaigns from 37k+ lemlisters » avec open/reply rates affichés (ex. « Get reply from CEOs using WhatsApp — 91% open, 55% reply ») (004).

### Multichannel / LinkedIn
- Canaux natifs : **email, LinkedIn (visite de profil, invitation, message texte, message vocal), appels (dialer natif + Aircall/Ringover), SMS, WhatsApp (add-on)** (nav produit + 004 + table 002-pricing).
- WhatsApp : « built-in warm-up to keep your number safe » (004).
- Appels : « Every conversation is tracked, summarized, and shareable » ; « AI sales call summaries » (Enterprise, table 002-pricing).
- Extension Chrome : « find contacts, enrich leads, personalize messages, or launch outreach directly from LinkedIn, Gmail, or CRM » (FAQ 002-pricing).
- Canaux additionnels via API : « Integrate tools like Sendoso for corporate gifts, Handwrytten for personalized notes, or Mailinbox to drop voicemail messages » (004).

### Gifting
- Pas natif : uniquement via API/intégration Sendoso (cadeaux) et Handwrytten (notes manuscrites) (004). « Non documenté » comme feature première partie.

### Deliverability
- Sous-marque **lemwarm** incluse dans tous les plans : « lemwarm, our automated warm-up and deliverability booster » (FAQ 001-home).
- **Deliverability Hub** centralisé : « Monitor mailbox and domain health, spot issues before performance drops, and get actionable recommendations from one centralized hub » (001-home, bloc 05).
- **Inbox rotation** : « Rotate across inboxes automatically and keep your campaigns running safely at scale » (006).
- Smart sending algorithm : « lemlist spaces emails naturally, caps volume per inbox, and sends within your prospects' timezone so your patterns always look human » (006).
- **Deliverability Boost** (pré-envoi) : « checks your copy, your technical setup, and your inbox placement signals. You see exactly what to fix and why, before it reaches a single prospect » (006).
- Vérification d'emails intégrée pour éviter les bounces (006).
- Table 002-pricing (tous plans) : Google/Microsoft/SMTP, achat de domaines in-app, achat d'emails in-app, rotating IPs, custom tracking domain, DNS setup test, deliverability testing, sending limits management, unsubscribe link, deliverability alerts.

### Reply handling
- **Unified Inbox** multicanal : « Keep all multichannel conversations in lemlist's Unified inbox, and reply by email, LinkedIn, WhatsApp, or call » (004).
- « AI reply intent detection » (« Interest Detector »), « AI out-of-office detection », « AI-generated replies » — tous plans (002-pricing table + FAQ 007).

### Booking
- Pas de scheduler/booking natif documenté sur les pages publiques capturées. Le CTA récurrent est « A calendar full of opportunities starts here » (toutes pages) mais aucune feature de prise de RDV n'est décrite. → **non documenté sur le site**.

### Learning / analytics
- « Smart reporting » cross-canal + « Custom reporting » (FAQ 004 + table 002-pricing).
- lemAgent analyse les campagnes passées et suggère des réécritures (003).
- Mémoires lemAgent : « let it learn from your conversations » (003) ; « After that, lemAgent already knows your company, your audiences, and what has worked before » (003).
- **Aucune boucle d'apprentissage automatique sur les outcomes n'est documentée** (pas de claim type « le système apprend de vos réponses pour améliorer les prochaines campagnes tout seul ») — l'amélioration passe par des suggestions à valider par l'humain. → transparence de la boucle : faible/non documentée.
- « Activity logs » (Enterprise, 002-pricing).

### Compliance
- Badge « GDPR Compliant » accolé à la note G2 (001-home + 002-pricing).
- « lemlist is SOC 2 certified » (FAQ 001-home).
- Footer légal : Terms, Privacy Policy, **Sending Policy**, **Anti-abuse protection**, **DPA** (toutes pages).
- Two-factor authentication (tous plans) ; SSO/SAML, custom roles & permissions, custom terms of use (Enterprise) (002-pricing).
- FAQ 007 « Is AI-based prospecting compliant with regulations? » : la réponse affichée est un copié-collé erroné de la réponse OpenAI (bug de contenu sur leur site) — pas de vraie réponse compliance sur cette page.

### Pricing model
Voir section 3.

### Other
- **lemlist MCP + Claude Skills** : « lemlist from Claude », « MCP server access » inclus dans tous les plans (nav + table 002-pricing) ; page footer « Structured data for LLMs » (/ai-info) → SEO/GEO pour LLMs.
- Intégrations : « Explore 500+ integrations » ; natives citées : Salesforce, HubSpot, Pipedrive, Attio, Zapier, Make, n8n, Clay, Aircall, Ringover, Claap (001-home + 002-pricing).
- « Use lemlist from your CRM » (Enterprise) ; « Work in lemlist from LinkedIn/Gmail » (Multichannel).
- lemcoach (1:1 training), lemlist Academy, free tools, cold-email templates (footer).

## 3. Pricing détaillé (002-pricing.png / 002-pricing.html)

Modèle : abonnement par plan + **crédits rechargeables pay-per-success** (1 crédit = 0,01 €) pour enrichissement, vérification, signaux, IA, minutes d'appel. Toggle Monthly / Quarterly (-10%) / Yearly (-20%). Devises $, €, £.

| Plan | Prix mensuel | Prix annuel (par mois) | Unité | Inclus (extraits) |
|---|---|---|---|---|
| **Email** | 69 € | 55 € | **Unlimited users** ; 50 000 emails/mois | Unlimited users & email senders, Email & Phone Finder, base 650M+, contacts illimités, lemAgent, AI Agents, lemlist MCP, Unified Inbox, Deliverability Hub & warm-up, CRM integrations & API |
| **Multichannel** (POPULAR) | 109 € | 87 € | **par user** ; emails & messages illimités | Tout Email + 5 senders/user, LinkedIn automation, SMS automation, WhatsApp add-on, dialer natif & VoIP, task management, extension Gmail & LinkedIn |
| **Enterprise** | Custom | Custom | 5+ users | Tout Multichannel + ≥5 senders/user, lemlist depuis le CRM, custom roles & permissions, dedicated AM, custom ToU, SSO/SAML, 1:1 onboarding, priority support |

Add-ons à crédits :
- « Find emails & phone numbers » : emails vérifiés **5 crédits/email**, téléphones **20 crédits/numéro** ; pack 1k crédits = 200 emails ou 50 téléphones = **10 €**.
- « Track buying intent signals » : visite web **20 crédits/signal**, hiring & job changes **à partir de 100 crédits**, levée de fonds **100 crédits**, engagement LinkedIn **à partir de 400 crédits**.

Essai : 14 jours, plan Multichannel complet, sans CB (FAQ 002-pricing). Des landing referral affichent des essais 30 jours (bandeaux partenaires, 001/002).

## 4. Patterns UX observés

- **Hero = démo interactive de lemAgent** : un chat avec le prompt « Find CFOs in B2B SaaS companies in the US » qui déroule un affinage guidé (chips de tailles d'entreprise 50-200, etc.) directement sur la homepage (001-home.png). Le produit se vend par sa surface conversationnelle.
- Onglets hero : « Let AI handle it / Find & enrich leads / Spot buying intent / Engage on multi-channels / Avoid spam » (001-home).
- **Narratif scrollytelling numéroté 01→05** couvrant le funnel complet (leads → intent → enrichissement → multicanal → délivrabilité) (001-home).
- **Pricing 3 cartes + toggle période**, plan populaire en carte sombre inversée, add-ons crédits en cartes séparées, puis **table comparative géante par catégories** (Data & Lead Gen / Deliverability / Multichannel / AI-powered Outbound / Operations / Extensions / Support) (002-pricing.png).
- **Cartes signaux pédagogiques « What it means / Your move »** pour chaque type de signal (005-intent-signals.png) — éducation + produit dans le même bloc.
- **Templates avec métriques réelles** : carrousel de campagnes communautaires affichant open rate / reply rate / nombre de duplications (« 91% open, 55% reply, 826 duplications ») (004).
- **Bandeaux referral personnalisés** (« Welcome, Secret users 👋 », « Roxane t'a donné 1 mois gratuit ») → co-marketing affilié détecté à l'arrivée (001/002).
- Social proof systématique : bandeau « & 20,000+ other sales teams », badges G2 « Top 50 / Top 100 2026 », citations G2 in-extenso avec notes (001-home).
- FAQ accordéon sur chaque page produit ; footer multilingue EN/FR/DE/ES ; page « Structured data for LLMs ».
- Anti-objection lemAgent : FAQ « What if I don't like what it built? » → « edit the campaign directly in the builder. You are never locked into what it generates » (003) — le chat n'est pas un remplacement du builder, il y débouche.

## 5. Canaux couverts

Email, LinkedIn (visits/invites/messages/voice notes), appels téléphoniques (natif + Aircall/Ringover), SMS, WhatsApp (add-on), + canaux étendus via API (Sendoso gifting, Handwrytten, voicemail). Inbox unifiée cross-canal.

## 6. Discours IA

- Marque ombrelle « The AI Outbound Platform » ; vocabulaire « AI agents » partout : lemAgent (chat builder), Intent Signal Agents, Data Enrichment Agents, URL-scraping agent, LinkedIn agents, Claap agents.
- « on autopilot » est revendiqué (hero + signaux) MAIS le garde-fou humain est explicite et marketé : « Nothing goes out without your sign-off » (003).
- Positionnement AI-native distribution : MCP server + « lemlist from Claude » + Claude Skills — utiliser lemlist depuis Claude est un argument de vente en nav principale.
- Trace d'ancienne génération : Smart Messaging documente un fonctionnement « via your OpenAI account » (BYO key) (007) — le site mélange ancienne IA (variables/prompts) et nouvelle IA (agents).

## 7. Délivrabilité (discours)

Pilier majeur, produit dédié : lemwarm (inclus partout), Deliverability Hub, inbox rotation, smart sending (espacement humain, cap par inbox, timezone du prospect), Deliverability Boost (audit pré-envoi copy+technique+placement), vérification d'emails, achat domaines/inboxes in-app, rotating IPs, alertes. Claim : « Send more, land better, and never burn a domain doing it » (006).

## 8. Transparence de la boucle d'apprentissage

- Documenté : mémoires lemAgent visibles et éditables (Company context / Team memories / My memories), analyse de campagnes avec suggestions.
- **Non documenté sur le site** : toute boucle fermée outcome→amélioration automatique (pas de claim d'auto-apprentissage sur les réponses/conversions). L'amélioration reste « suggestions à valider ».

## 9. RGPD / conformité

- Badge « GDPR Compliant » (001, 002 — accolé à la note G2, sans certification citée).
- « lemlist is SOC 2 certified » (FAQ 001-home).
- Pages légales publiques : DPA, Privacy Policy, Sending Policy, Anti-abuse protection (footer).
- 2FA tous plans ; SSO/SAML + activity logs + custom roles en Enterprise (002-pricing).
- Détail des mesures RGPD (rétention, sous-traitants, bases légales par canal) : non documenté sur les pages capturées.

## 10. Faits notables

1. **lemAgent est LE lancement en cours** (badge « New » en nav) : chat → campagne complète avec branching logic, exécutée dans lemlist, validation humaine obligatoire. Recouvrement frontal avec le positionnement chat-first d'Elevay.
2. **Auto-enrollment sur signal** : « let lemlist push new leads into campaigns and trigger outreach on autopilot » (005) — la boucle signal→campagne→outreach existe, en opt-in.
3. **Monétisation des signaux à l'unité** (20 à 400+ crédits/signal) — le signal est un consommable payant, pas une capacité incluse.
4. Base 650M+ leads + waterfall 25+ providers pay-per-success intégrés — TAM sourcing natif dans le sequencer.
5. Plan Email à « unlimited users » (55 €/mois entreprise entière) vs Multichannel par siège (87 €/user/mois annuel) — le multicanal est le vrai étage payant.
6. Distribution AI-native : MCP + Claude Skills en nav principale + page « Structured data for LLMs ».
7. Écosystème lempire : Claap (recordings) branché comme source d'enrichissement et « Claap AI call agent » (002-pricing).
8. Incohérences de contenu repérées : 600M vs 650M leads ; FAQ compliance IA (007) avec une réponse copiée-collée du mauvais sujet — vitesse d'itération marketing > relecture.
9. 20 000+ équipes clientes revendiquées ; G2 4.7/5 (1 396 reviews) ; templates communautaires de « 37k+ lemlisters ».
10. Pas de booking/scheduler natif ni de CRM-pipeline documentés sur le site public — la sortie reste « conversations », pas « deals ».
