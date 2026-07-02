# Benchmark concurrentiel — Smartlead (smartlead.ai)

Date de capture : 2026-07-01. Méthode : Playwright headless (Chromium 1.60), viewport 1440x900, UA Chrome 131, pages publiques uniquement. Aucun blocage anti-bot rencontré (blocked=false).

Éditeur : 521 Products Pty Ltd t/a Smartlead.ai, produit Five2One, "Made with love in Sunny Sydney, Australia" (001-home.png, footer).

## Pages capturées

| # | URL | Screenshot | HTML |
|---|-----|-----------|------|
| 1 | https://www.smartlead.ai/ | screenshots/smartlead/001-home.png | html/smartlead/001-home.html |
| 2 | https://www.smartlead.ai/pricing | screenshots/smartlead/002-pricing.png | html/smartlead/002-pricing.html |
| 3 | https://www.smartlead.ai/email-warmup | screenshots/smartlead/003-email-warmup.png | html/smartlead/003-email-warmup.html |
| 4 | https://www.smartlead.ai/cold-email-infrastructure | screenshots/smartlead/004-cold-email-infrastructure.png | html/smartlead/004-cold-email-infrastructure.html |
| 5 | https://www.smartlead.ai/email-deliverability-test | screenshots/smartlead/005-email-deliverability-test.png | html/smartlead/005-email-deliverability-test.html |
| 6 | https://www.smartlead.ai/unified-inbox | screenshots/smartlead/006-unified-inbox.png | html/smartlead/006-unified-inbox.html |
| 7 | https://www.smartlead.ai/sales-automation | screenshots/smartlead/007-sales-automation-smartagents.png | html/smartlead/007-sales-automation-smartagents.html |

## Positionnement

Cold email à l'échelle + délivrabilité comme moat, avec un pivot marketing récent vers "AI outbound" / suite d'agents.

Citations verbatim (001-home.png) :
- Title tag : "Smartlead | Cold Email Software for Sales Teams That Run Outbound at Scale"
- Hero : "Unlock the Full Power of AI Outbound — Automate prospecting and close more deals with AI agents and a deliverability infrastructure built to land emails in the inbox."
- "Trusted by 100,000+ Businesses, from Best agencies to Fortune 500 Companies"
- CTA récurrent bas de page : "Let's build your intelligent enterprise outreach engine — Get AI-native operating system for your enterprise sales team"
- "Powerful automated workflows that drive sales. Try Smartlead's AI-led outbound system today."
- Bandeau promo : "GET: Unlimited contact storage + free verified prospects."

Architecture produit (mega-menu "Products", 001-home.png) : SmartProspect (leads vérifiés), SmartAgents (agents IA GTM), SmartInfra (serveurs dédiés), SmartDialer ("New" — appels IA multicanal), Ultra Premium Warmup ("New"), SmartSenders (achat de mailboxes), SmartDelivery (tests de placement), Unified Master Inbox, Email Verification, Email Follow-Up Automation, APIs, app mobile (iOS + Android).

Cible : agences lead-gen d'abord (white-label, workspaces clients, témoignages quasi exclusivement de fondateurs d'agences — 001-home.png), puis sales teams / enterprise ("Recruiters", "Sales Leaders", "Marketing Agencies" dans le footer Solutions).

## Stack délivrabilité (LA référence de profondeur — c'est leur coeur)

### 1. Mailboxes illimitées + rotation (001-home.png, 002-pricing.png)
- "Add unlimited mailboxes and store unlimited leads — no storage fees; pay only for what you send." (001-home.png)
- FAQ pricing : "All Smartlead plans include unlimited email accounts at no extra cost." (002-pricing.png)
- Rotation : "Smartlead automatically rotates sending across all connected mailboxes within a campaign. This distributes send volume evenly, protects individual sender reputation, and improves deliverability by avoiding high-volume spikes from a single address." (FAQ 002-pricing.png)
- FAQ home : "unique IP rotating for each campaign, and dynamic ESP matching" + "Real-time AI learning refines strategies based on performance, optimizing deliverability without manual adjustments." (001-home.png)
- Preuve sociale d'échelle : "1.5M cold emails/month, 7,767+ inboxes managed" (Eric Nowoslawski, Growth Engine X, 001-home.png).

### 2. Warmup "Ultra Premium" (003-email-warmup.png)
- Hero : "Ultra-premium Warmup Pool For Improved Inbox Placement — runs automatically from the moment you connect a mailbox. Private pool. Human-like sending patterns. No manual setup."
- Pool privé, sur invitation/récompense : "Only vetted senders make it into our private pool, no public sign-ups or bad actors, so your reputation isn't diluted" ; "Access is reward-based" ; "Warm premium domains together — Risky accounts move to a safe lane."
- Détail technique cité : "MX record blockers now 6x faster for proactive cleanups" ; "Reply-balancing limits — Pause an inbox after it hits safe reply thresholds, then re-join automatically."
- Simulation humaine : "Our AI sends, opens and replies to warm-up emails, even moving them from spam to the inbox" ; "Subject lines, copy and send times shuffle constantly to mimic real user behaviour."
- Guardrails auto : "Adaptive scaling — Warm-ups start small and scale automatically when ESPs trust you, using daily caps and per-domain limits" ; "Auto-pause on risk — Bounce spikes, spam flags or invalid inboxes trigger a pause and cool-down" ; "Self-recovering pools — Bad accounts are removed immediately."
- Moteur "self-healing" : "A self-healing warmup engine that fixes problems before you notice them" + dashboard temps réel (sends/opens/replies/reputation scores) + "Actionable alerts — Spot spam rescues, hard bounces."
- Multi-mailbox : "Each mailbox gets its own ramping profile and safety rails" ; Gmail, Outlook ou SMTP ; "Manage unlimited mailboxes from one dashboard."
- Durées recommandées (FAQ) : compte existant >= 2 semaines ; nouveau domaine 1 à 2 mois.
- Le pool warmup est TIERÉ par plan (002-pricing.png) : Base = "Foundation tier", Pro = "Growth tier" (les deux avec add-on $59/mois — vraisemblablement l'accès Ultra Premium), Smart/Prime = "Premium (Eligible for Ultrapremium)" inclus FREE.

### 3. SmartInfra / SmartServers — infrastructure privatisée (004-cold-email-infrastructure.png)
- Hero : "SmartServers — Privatised Infrastructure for Unmatched Deliverability. Own your servers. Control your IPs. Predict your reply rates."
- Clusters multi-serveurs : "Intelligent routing of every sequence through dedicated IP pools" ; "Isolate every sequence in single-tenant clusters for full control and zero cross-domain interference" ; "Auto-scales to match campaign throughput" ; "Failover-ready architecture".
- Monitoring : "Real-time blacklist monitoring for your servers" + "Auto-alerts to adjust server reputation so campaigns are always sending."
- Géo/SLA affichés : "Stable, siloed servers across the US and Europe — 99.98% uptime globally."
- Agences : "Smartlead allows agencies to assign dedicated servers to individual clients... one client's campaign performance or reputation issues cannot affect another client's deliverability" (FAQ).
- Prix : SmartServers Pro $39/serveur/mois ("Dedicated IP", "24/7 priority support") — 002-pricing.png. Urgence commerciale : "Early Bird Pricing Ends July 9th" (004).

### 4. SmartDelivery — tests de placement inbox (005-email-deliverability-test.png)
- Hero : "Know Where Your Emails are Landing. Test deliverability, monitor reputation and fix issues before your campaigns go live."
- Seed lists : "Send to curated seed lists — Run unlimited tests across Gmail, Outlook, Yahoo and more to see exactly where your emails land" ; distingue primary / promotions / spam ; "Automated alerts — Get notifications if a sending account starts landing in spam."
- Analyse contenu : filtres "industry-standard" (SpamAssassin, Google, Barracuda cités en FAQ), score + recommandations, check des attachments/images/headers d'authentification.
- Blacklists : "Check 400+ blacklists — Monitor your domains and IPs against hundreds of blacklists and get notified if you're listed."
- Auth : check SPF/DKIM/DMARC instantané + "Step-by-step guidance... even if you're not technical" + "View DMARC reports showing which sources send on your behalf" (anti-spoofing).
- Tests programmables ("schedule them to run automatically"), rapports exportables (partage client), KPI maison "Placement Rate" ("expert-vetted industry benchmark" — FAQ).
- Prix add-on (002-pricing.png) : Growth $49/mois (120 tests de séquence, 50 comptes/test) ; Pro $174/mois (tests illimités, 200 comptes/test, "Placement Optimised Copy", "Campaign Copy Warmup", full API, full whitelabel) ; Export $599/mois (500 comptes/test).
- "Campaign Copy Warmup" = warmup du copy de campagne lui-même avant l'envoi (nom de feature affiché, mécanique non détaillée sur le site).

### 5. SmartSenders — achat de mailboxes done-for-you (001-home.png, 002-pricing.png)
- "We handle domains, DNS, SPF, DKIM and DMARC automatically, so you're ready to send right away." ; "Clean US IPs" ; "Spread your campaigns across Google and Outlook to avoid deliverability bottlenecks."
- Marketplace multi-fournisseurs affichée avec prix (002-pricing.png) : Google Fresh (Zapmail) $13/domaine/an + $4.5/mailbox/mois ; Outlook Fresh (Zapmail) idem ; Outlook Fresh (InfraInbox) $16/dom/an + $5/mb/mois ; SMTP Fresh (Mailreef) $19/dom/an + $3.99/mb/mois ; SMTP (AeroSend) $13/dom/an + $4.2/mb/mois ; Google/Outlook PRE-WARMED (Zapmail) $18/dom/an + $9/mb/mois. Achat "in 2 clicks".

### 6. Vérification d'email (001-home.png, 002-pricing.png)
- "Each prospect is verified across three independent sources to keep bounce rates low" (SmartProspect, 001-home.png).
- Add-on crédits de vérification : à partir de $33.00 pour 6k crédits, paliers 6k→960k, one-time ou mensuel (-17%) (002-pricing.png).
- Boîte à outils gratuite SEO-driven : SPF/DKIM/DMARC/CNAME/SSL checkers + generators, blacklist checker, spam checker, calculateurs bounce/open/CTO/spam-complaint (001-home.png, footer Tools).

## Features par catégorie

- **tam-ingestion / leads** : SmartProspect — "Get 3X verified leads for your cold outbound" ; modèle original : "Every three emails you send earns you a verified lead — so your pipeline scales as you do" (001-home.png). Crédits leads inclus au plan (2k → 170k/mois selon tier, 002-pricing.png).
- **signals-intent** : "Advanced filters and live intent signals pinpoint prospects who are actually ready to buy" (001-home.png). Aucun détail sur les sources/types de signaux — non documenté au-delà de cette phrase.
- **enrichment** : pas d'enrichissement natif documenté ; le site renvoie au partenariat Clay : "Partnered with Clay... enrichment from over 50 data providers, and real-time scraping" (FAQ 001-home.png).
- **ai-decisioning / agents** : SmartAgents — "Describe a task in plain English and it builds an AI agent that runs your outbound, syncs leads to your CRM, and pushes results to your stack automatically. No code, no setup." (007). Templates affichés : Campaign Reply Rate Alert (Slack), Daily LinkedIn Lead Auto-Push (vers un outil LinkedIn tiers, ex. Aimfox), Daily Stale Reply Monitor (relances oubliées >24h), Reply Sync to Airtable, Client Performance Daily Report (007). "Agents optimize send times, classify replies and loop objections back into new outreach" (001-home.png).
- **personalization** : champs de personnalisation + spintax + "SmartAI Bot creates persona-specific, high-converting sales copy" ; "You can train the AI bot to achieve 100% categorisation accuracy" (FAQ 001-home.png). Hyper-perso déléguée à Clay.
- **sequencer** : "subsequences based on lead's intentions" (FAQ 001), Email Follow-Up Automation (page produit dédiée), "Trigger custom workflows when keywords like 'interested' appear", "Route leads into follow-up sequences or booking calendars" (006-unified-inbox.png). Drip-feed de leads dans les campagnes actives (FAQ 001).
- **multichannel-linkedin** : PAS de canal LinkedIn natif — l'agent "pushes them into your LinkedIn outreach tool automatically" (007, outil tiers). Le multicanal Smartlead = email + téléphone (SmartDialer : "Make AI multichannel calls with full context", "parallel dialing and local-presence numbers", "call transcripts, summaries and performance analytics", "Automatically verify numbers, skip voicemails and dial tones" — 001-home.png).
- **reply-handling** : Master Inbox — catégorisation auto par intent, détection OOO/bounce/unsubscribe, bulk actions (tag/assign/archive/reply/forward), notes internes, assignation par teammate, "An AI reply manager prioritises hot leads, triggers next steps and syncs everything back to your CRM" (001 + 006). Temps réel + alertes Slack + sync Google Sheets/CRM.
- **booking** : "Route leads into follow-up sequences or booking calendars" (006) — pas de scheduler natif documenté ; leur propre démo passe par cal.com (lien "Book a Demo", 001-home.html).
- **crm** : CRM intégré Kanban "drag-and-drop board fully synced with your Master Inbox", timeline d'activité, sync temps réel (001-home.png). CRM Access = à partir du plan Pro (002-pricing.png).
- **learning-analytics** : affirmations d'apprentissage : "Real-time AI learning refines strategies based on performance" (FAQ 001) ; "agents... loop objections back into new outreach" (001) ; SmartServers "tracks bounce rates, spam flags and reputation signals in real time and adjusts automatically" (001). Aucune métrique, dashboard ou mécanisme d'apprentissage exposé publiquement — boucle non transparente.
- **compliance** : GDPR mentionné une fois : "It also complies with GDPR, ensuring your data privacy rights are respected" + "Smartlead doesn't store your emails, and it uses advanced encryption methods" (FAQ 003-email-warmup.png). Footer : Privacy Policy, Ts & Cs, Fair Use Policy, DPA, "Don't Sell My Data" (CCPA). Pas de page sécurité/SOC2 trouvée dans la nav publique.
- **pricing-model** : cf. section pricing.
- **other** : white-label complet pour agences ($29/mois/client-workspace, FAQ 002) ; API + webhooks mis en avant partout ("We came for the unlimited inboxes, and we stayed for the API") ; app mobile iOS/Android ; Smartlead University (formation) ; bibliothèque de prompts ; 7 pages comparatives SEO (vs Lemlist, Outreach.io, Mailshake, Apollo, Klenty, Quickmail, Saleshandy).

## Pricing (002-pricing.png — vérifié sur le rendu)

Modèle : abonnement par tier + volume d'envoi. AUCUN coût par mailbox/siège ("Do I have to pay per email account or mailbox? No."). 2 compteurs distincts : lead credits (contacts stockés) vs email credits (envois). Essai gratuit 14 jours sans CB. -17% en annuel. Pas d'engagement ("no lock-in contracts").

| Plan | Mensuel | Annuel (par mois) | Contacts | Envois/mois | Emails vérifiés/mois | Warmup pool |
|------|---------|-------------------|----------|-------------|----------------------|-------------|
| Base | $39 | $32 | 2 000 | 6 000 | 2 000 | Foundation tier (+ add-on $59/mois) |
| Pro | $94 | $78 | 30 000 | 90 000 | 30 000 | Growth tier (+ add-on $59/mois) |
| Unlimited Smart ("MOST POPULAR") | $174 | $144 | Illimités | 150 000 | 50 000 | Premium inclus, "Eligible for Ultrapremium" |
| Unlimited Prime | $379 | $315 | Illimités | 500 000 | 170 000 | Premium inclus + "3 SmartServers + OAuth" + 3 workspaces clients |

Lignes de la matrice (002-pricing.png) : Contacts Storage, Emails Sent Per Month, Verified Prospect Emails, Warmup Pool, CRM Access (Pro+), CSM Call Access, Private Infrastructure (add-on $39 sur Pro/Smart ; 3 inclus sur Prime), Clients/Workspace (add-on $29), API & Webhooks, Dedicate Manager, Private Slack Channel (tiers hauts).

Add-ons (002-pricing.png) :
- SmartSenders (achat mailboxes) : $13–19/domaine/an + $3.99–9/mailbox/mois selon provider et fresh/pre-warmed.
- SmartDelivery : Growth $49/mois, Pro $174/mois, Export $599/mois.
- Email Verification : dès $33 (6k crédits), one-time ou mensuel (-17%).
- SmartServers : $39/serveur/mois.
- White-label : $29/mois par client/workspace (FAQ).

## Patterns UX observés

- Pricing = matrice interactive : toggle Monthly/Yearly ("17% OFF"), slider horizontal de volume en tête (6K→510K sends), tableau comparatif 4 colonnes avec badges "MOST POPULAR", puis carrousel d'add-ons à onglets (SmartServers/SmartSenders/SmartDelivery/Email Verification) avec leurs propres cartes de prix (002-pricing.png).
- Marketplace de mailboxes intégrée au pricing : cartes provider (Google/Outlook/SMTP) avec logos, badges "Fresh"/"Pre-warmed" et "Powered by Zapmail/InfraInbox/Mailreef/AeroSend" — l'infra est en partie revendue/partenaire, assumé publiquement (002-pricing.png).
- Homepage = long-scroll par sous-produit avec nav par onglets (Scalability / SmartInfra / Deliverability / SmartProspect / SmartSenders / SmartAgents / Master Inbox / SmartDialer), chaque section = 3 bénéfices + mockup produit (001-home.png).
- Mega-menu produits à 12 entrées + hub "Resources" massif (University, case studies, ebooks, prompt library) + ~20 outils gratuits SEO (checkers/generators/calculateurs) qui alimentent le funnel délivrabilité (001-home.png).
- Mur de ~24 témoignages nominatifs (fondateurs d'agences) réutilisé à l'identique sur toutes les pages produit ; case studies chiffrées en nav ("$30M with Smartlead", "10,000 sales meetings") (001-home.png).
- SmartAgents présenté comme galerie de templates d'agents avec statut ("Agent Status") et pitch "From prompt to running agent, in seconds" (007).
- Urgence commerciale : bannière promo sticky en header + "Early Bird Pricing Ends July 9th" (004).
- FAQ accordéon riche en bas de CHAQUE page — c'est là que sont les vrais détails (prix, rotation, durées de warmup, GDPR).
- CTA duals systématiques : "Book a Demo" (cal.com) vs "Start Free Trial" (self-serve).
- Newsletter footer : "Get 1 hot deliverability tip each week" — le contenu marketing est mono-thème délivrabilité.

## Canaux couverts

- Email (coeur, illimité en comptes).
- Téléphone : SmartDialer "New" — appels IA, parallel dialing, numéros local-presence, transcripts + coaching (001-home.png). Non détaillé sur une page dédiée capturée.
- LinkedIn : PAS natif — push des leads vers un outil LinkedIn tiers via SmartAgents (ex. Aimfox, 007).
- Pas de SMS/WhatsApp/courrier/gifting documentés sur le site public.

## Discours IA

Pivot visible de "cold email tool" vers "AI-native operating system" : "Unlock the Full Power of AI Outbound", "AI agents", "Your GTM engineers on autopilot", "Replace a team of SDRs — A single agent stack can handle the workload of multiple reps at a fraction of the cost, keeping your pipeline full 24/7" (001-home.png) ; "One prompt can do the work of an entire ops team" (007). L'IA revendiquée : warmup conversationnel ("maintains AI conversations"), catégorisation d'intent entraînable ("train the AI bot to achieve 100% categorisation accuracy"), copywriting (SmartAI Bot), reply manager, agents no-code prompt-to-workflow. À noter : les templates d'agents montrés (007) sont surtout de l'orchestration ops (alertes Slack, sync Airtable, rapports) — plus proche d'un Zapier verticalisé que d'un SDR autonome ; l'écart entre le claim "Replace a team of SDRs" et les exemples montrés est réel.

## Transparence de la boucle d'apprentissage

Faible. Affirmations génériques ("Real-time AI learning refines strategies based on performance, optimizing deliverability without manual adjustments", FAQ 001 ; "loop objections back into new outreach", 001) sans aucune explication du mécanisme, des données utilisées, ni d'UI d'inspection. Le seul apprentissage "visible" promis : entraîner le bot de catégorisation des replies (FAQ 001). Non documenté au-delà.

## RGPD / conformité

- "It also complies with GDPR" + "Smartlead doesn't store your emails" + chiffrement (FAQ 003-email-warmup.png) — affirmation, aucun certificat/audit cité.
- DPA public (/dpa), Fair Use Policy, "Don't Sell My Data" (CCPA) au footer (001-home.png).
- Pas de mention SOC 2 / ISO 27001 sur les pages capturées ; pas de page trust/security dans la nav. Non documenté sur le site public.
- Société australienne (521 Products Pty Ltd) ; serveurs "US + EU server grid" (004) — la localisation EU des serveurs d'ENVOI est affichée, pas celle du stockage des données.

## Faits notables

1. Volume/échelle assumés : 100k+ businesses, témoignage "1.5M cold emails/month, 7,767+ inboxes managed" (001-home.png) — le produit est conçu pour l'envoi de masse multi-mailbox.
2. Le warmup pool est un actif à tiers de qualité (Foundation/Growth/Premium/Ultrapremium) monétisé en add-on $59/mois sur les petits plans — le pool privé "invite-only, reward-based" est présenté comme un moat (003, 002).
3. Verticalisation infra complète : ils vendent les domaines, les mailboxes (via partenaires Zapmail/Mailreef/InfraInbox/AeroSend), les serveurs dédiés ($39/mois), les tests de placement et la vérification — toute la chaîne délivrabilité est monétisée en add-ons au-dessus d'un abonnement d'entrée à $39.
4. "SmartDelivery Placement Rate" positionné comme benchmark industrie "expert-vetted" (FAQ 005) ; 400+ blacklists monitorées ; rapports DMARC exposés dans le produit (005).
5. Incohérences mineures du site : la FAQ home cite encore "31,000 businesses" quand le hero dit 100k+ ; la FAQ décrit un "Custom Plan ($174/month)" qui s'appelle en fait Unlimited Smart ; footer "What's New" pointe vers /privacy-policy et "Careers" vers les T&C (001-home.html) — le site évolue plus vite que son contenu.
6. Pas d'enrichissement natif ni de LinkedIn natif : les deux sont explicitement délégués (Clay pour l'enrichment, outils tiers pour LinkedIn) — Smartlead reste un rail d'exécution email/téléphone.
7. La cible agence structure tout : white-label $29/client, serveurs dédiés par client, "Client Performance Daily Report" comme template d'agent, master inbox multi-clients (006, 007, 002).
8. Croissance produit récente visible : SmartDialer et Ultra Premium Warmup taggés "New", early-bird SmartInfra jusqu'au 9 juillet (004) — expansion agressive au-delà de l'email.
