# Benchmark concurrent — Reply.io (2026-07-01)

Capture : 8 pages publiques, aucune authentification. Screenshots dans
`_specs/outreach-autopilot/benchmark/screenshots/replyio/`, HTML brut dans
`_specs/outreach-autopilot/benchmark/html/replyio/`.

Note anti-bot : le crawl headless a passé la homepage et /features, puis Cloudflare
("Just a moment...") a bloqué les pages suivantes. Retente en Chrome headed
(`channel: 'chrome', headless: false`) : toutes les pages sont passées. `blocked = false`.

## Pages capturées

| # | URL | Screenshot |
|---|-----|-----------|
| 001 | https://reply.io/ | 001-home.png |
| 002 | https://reply.io/features/ | 002-features.png |
| 003 | https://reply.io/jason-ai/ | 003-jason-ai.png |
| 004 | https://reply.io/linkedin-automation/ | 004-linkedin-automation.png |
| 005 | https://reply.io/reply-email-infrastructure/ | 005-email-infrastructure.png |
| 006 | https://reply.io/data/ | 006-data.png |
| 007 | https://reply.io/pricing/ | 007-pricing.png |
| 008 | https://reply.io/trust-page/ | 008-trust-page.png |

## 1. Positionnement (citations verbatim)

- Title homepage : "Reply.io | AI Sales Outreach & Cold Email Platform" (001-home.png).
- Hero : **"Supercharge your sales team with AI"** — "Generate leads with multichannel
  sequences, automate follow-ups to book more meetings, or hire Sales AI agents to handle
  prospecting for you – all within Reply." (001-home.png)
- Sous le hero : "Unlimited mailboxes and warm-ups / No credit card required / Top email
  deliverability" (001-home.png).
- Double posture assumée, humain OU agent : "Run outreach your way: stay in control when
  you want to, or hand it off to Jason AI SDR on autopilot — the choice is yours." avec
  deux colonnes "Human-led — Sales Outreach" vs "AI-led — Jason AI SDR Agent" (001-home.png).
- Page features : "New level of full-cycle sales engagement solutions, now with AI",
  structurée en 3 étapes **Discover / Engage / Convert** (002-features.png).
- Jason AI : **"Jason, AI SDR Agent: Feels Human, Works Superhuman"** — "Jason is a sales
  agent who knows your product inside out, adapts to your strategy, defines your ICP, and
  finds the right leads in 1B+ real-time data… to book meetings with your ideal prospects
  at the quality and control of your best rep" (003-jason-ai.png).
- Preuves sociales : "Trusted by 3,000+ businesses", "10+ years helping sales teams sell
  smarter", "4.6/5 rating on G2", "1,480 reviews on G2" (001-home.png). Jason revendique
  "Trusted by 250+ companies" (003-jason-ai.png) — noter l'écart 3 000 vs 250.
- Lettre du fondateur (Oleg Bilozor) en bas de homepage : "boutique business by design"
  (001-home.png).

## 2. Features par catégorie

### TAM / ingestion
- "Real-Time Data" **Powered by Generect** (partenaire tiers, pas une base propriétaire) :
  "Access 1+ billion global contacts with live prospecting data and intent signals" ;
  chiffres : 1 Md contacts, 150+ pays, 60M+ comptes, 220M+ contacts US, 15M+ profils
  d'entreprises US, "<3% Bounce Rate" (006-data.png).
- Recherche en 5 étapes avec **16 filtres** ("Use 16 filters to define your ideal
  audience", 006-data.png) — la page features dit "14 filters" (002-features.png) :
  incohérence du site.
- LinkedIn prospecting : "Pull contacts directly from LinkedIn or Sales Navigator into
  Reply – with full profile data included. Use native LinkedIn filters" (001-home.png).
- Import/export CSV, "Account List Search", recherche en langue locale (006-data.png).
- Jason : "AI-created ICP" ("Jason analyzes your value proposition and product to define
  your ICP") et "AI web search" ("Describe your ICP in plain language and Jason finds
  matching prospects across the web. No filters, just a prompt.") (003-jason-ai.png).
- "Targeting on account level: Target specific companies by uploading your own account
  lists." (003-jason-ai.png).
- Website Visitor Tracking : "Reveal companies and people visiting your website in real
  time… Automatically push visitors into sequences" (002-features.png).

### Enrichment
- Contact enrichment : "Add details to contact records on autopilot — phone numbers,
  LinkedIn profiles… bulk contact enrichment" + sync CRM (002-features.png).
- Findy (extension Chrome) : emails vérifiés depuis LinkedIn, "unlimited bulk email
  searches" (002-features.png).
- Name2Email (extension Chrome) : email par nom+domaine depuis Gmail (002-features.png).
- Email & phone validation intégrée ("Validate emails with top accuracy… validate phone
  numbers globally") (002-features.png) + add-on payant (007-pricing.png).

### Signals / intent
- "Intent Signals: Track hiring activity, LinkedIn engagement, tech stack changes, and
  company growth so your outreach lands at the right moment." (001-home.png).
- Jason : "tracks real-time intent signals such as hiring activity, technology usage,
  company growth, LinkedIn engagement, and behaviors like website visits and competitor
  following" (003-jason-ai.png).
- Filtres d'intent dans la base : "Hiring Intent Filter", technographie (006-data.png).
- Website visitors : jusqu'à 200 reveals/mois inclus sur les plans classiques ; "Unlimited
  lead-level Website visitor reveals" sur les plans AI SDR (007-pricing.png).

### AI decisioning
- Jason AI SDR = agent complet : "Autopilot & copilot modes" (007-pricing.png) ; pipeline
  en 6 étapes : 1 Outreach Strategy Setup, 2 Intelligent Targeting ("generates leads
  24/7"), 3 Multichannel engagement, 4 Content Generation & Personalization, 5 Reply
  Handling, 6 Meeting Booking (003-jason-ai.png).
- Choix de canal par l'IA : "AI-powered outbound sales sequences… selecting the best
  channels for each prospect" (001-home.png) ; "Jason strategically adds call steps to
  your sequence when most effective" (003-jason-ai.png).
- **AI model selection : "Pick your AI engine – Claude, Gemini, Mistral, OpenAI. Different
  models, different strengths."** (003-jason-ai.png).
- Configuration de l'agent : Playbooks, Offers, Knowledge base, Tone & language
  (003-jason-ai.png).
- "Approval mode: Review and approve messages before sending" — pattern HITL mis en avant
  partout (nav Jason, pricing agence "Fully autonomous or Approval Mode") (003-jason-ai.png,
  007-pricing.png).

### Personalization
- AI Variables (page produit dédiée /ai-variables/) : "AI writes unique details for each
  prospect so you stand out and stay out of spam" + bibliothèque de prompts éprouvés
  (001-home.png, 002-features.png).
- Recherche par prospect : "Jason researches each prospect across LinkedIn, company
  websites, and other available sources" ; "Choose personalization points — You control
  what data Jason uses to personalize" (003-jason-ai.png).
- **Source transparency : "Review all the sources Jason used to craft the messages. He
  provides direct links so you can verify everything."** (003-jason-ai.png).
- "Triple-verification: Validate messages to protect reputation" / "AI-generated emails go
  through triple verification, ensuring no errors" (003-jason-ai.png nav, 002-features.png).
- Multilingue : "Jason engages prospects in 50+ languages… adapts to local business tone
  and cultural nuance" (003-jason-ai.png).
- Spintax, custom fields, liquid syntax, contenu dynamique (005-email-infrastructure.png,
  007-pricing.png).

### Sequencer
- "Multichannel Conditional Sequences: emails and follow-ups, LinkedIn touchpoints,
  WhatsApp, SMS, calls, or any other channel connected via Zapier – all adapt based on
  replies and actions, not scripts." (001-home.png).
- Branches conditionnelles selon actions/données du prospect, A/B testing des étapes
  email, horaires custom (002-features.png).
- "AI generated sequences" ; "Evergreen sequences" (007-pricing.png, encart Jason).
- Triggers & automations (routage de contacts, retrait auto sur réponse/bounce/opt-out)
  (002-features.png).
- Task Flow : les étapes semi-automatisées (calls, social, manual emails, SMS, WhatsApp)
  génèrent des tâches exécutables depuis l'UI/extension Chrome (002-features.png).

### Multicanal / LinkedIn
- LinkedIn automation (page dédiée) : actions automatisées = "sending connection requests,
  messages, voice messages, viewing profiles, endorsing skills, following profiles",
  "Automate 'Like Recent Posts' to warm up your leads" ; + actions manuelles
  semi-automatisées (004-linkedin-automation.png).
- **AI Voice Messages : "AI voice messages – where Jason generates personalized recordings
  in your own voice"** (002-features.png, 004-linkedin-automation.png).
- InMails, pièces jointes, previews des messages (limites de caractères LinkedIn)
  (004-linkedin-automation.png).
- Sécurité du compte : "customizable safety limits", "real-time monitoring", multi-comptes
  LinkedIn avec distribution des campagnes, "granular control" auto/manuel
  (004-linkedin-automation.png).
- Compatible LinkedIn Basic, Sales Navigator, Recruiter (004-linkedin-automation.png).
- Autres canaux : Calls & SMS cloud (dialer VoIP intégré, caller ID local, transfert
  d'appels, enregistrement), WhatsApp semi-automatisé, vidéo personnalisée via Vidyard,
  n'importe quel canal via étape Zapier (002-features.png).
- Chiffres revendiqués LinkedIn : "3x higher C-suite response, +30% engagement, +20% reply
  rate lift, 3x more meetings scheduled" (004-linkedin-automation.png) — affirmations
  marketing non sourcées.

### Gifting
- Non documenté sur le site (aucune mention sur les 8 pages capturées).

### Deliverability (très développé — page produit dédiée)
- Positionnement : "The Outreach Email Infrastructure Built for You to Scale — Stop losing
  meetings to spam folders" (005-email-infrastructure.png).
- **Achat d'infrastructure dans le produit : "Buy domains, configure mailboxes, warm them
  up, and start sending sequences – all without leaving Reply"** ; achat de mailboxes
  Google Workspace ou Microsoft 365, "Reply configures DNS automatically – SPF, DKIM,
  DMARC, all of it" ; ou connexion SMTP/OAuth de boîtes existantes
  (005-email-infrastructure.png).
- **Warm-up INCLUS et illimité** : "Warmup starts the moment you connect. Every mailbox
  builds sender reputation through a peer-to-peer network of real inboxes – no bots" ;
  "Free with every mailbox — no extra warmup tool needed" ; suivi par boîte (reputation
  score, warmup stage, daily activity) (005-email-infrastructure.png). L'outil sous-jacent
  est **MailToaster.ai** ("Email warm-ups in Mailtoaster.ai", 007-pricing.png ;
  "Automated email warm-up service with MailToaster.ai", 002-features.png).
- Timeline revendiquée : "Launch sequences on day 14 — from purchase to first send" ;
  claims chiffrés : "98% email delivery / inbox placement rate maintained", "3x more
  outreach volume", "-40% average cost reduction on email tooling"
  (005-email-infrastructure.png).
- "30+ Deliverability Features" : Email Health Checker (audit DNS), Mailbox Rotation
  (rotation multi-boîtes par campagne), Email Validation (Valid/Risky/Invalid), Ramp-Up
  Mode, Custom Sending Limits & Delays ("mimicking human sending patterns"), Email
  Provider (ESP) Matching, Branded Links & Custom Tracking, List-Unsubscribe Header
  ("meeting Google and Yahoo sender requirements"), Advanced Personalization anti-spam
  (005-email-infrastructure.png).
- Google Postmaster integration, global block list (002-features.png, 007-pricing.png).
- Équipe humaine : "You don't need a deliverability team. You have ours" — accès direct
  aux experts délivrabilité, revue de configuration de domaines
  (005-email-infrastructure.png). "Done for you deliverability" inclus dans les plans AI
  SDR (007-pricing.png).
- "Unlimited mailboxes" soumis à une **Fair Usage Policy** (nombre de boîtes indexé sur
  les active contacts) (007-pricing.png, FAQ).

### Reply handling
- Jason : "Smart reply handling — He'll respond to prospect replies in your voice,
  following your strategy" ; deux modes : "Automatic mode: We'll generate an AI response
  and send it on your behalf" / "Approval mode: We'll generate an AI reply to send after
  your approval" (003-jason-ai.png).
- "Re-engagement: Tell Jason when and how to re-engage with prospects who stopped
  answering. He'll handle it automatically." (003-jason-ai.png).
- "AI reply categorization" (007-pricing.png, tableau comparatif).
- Unified inbox multicanal (emails, LinkedIn, SMS), filtres, tags, recherche
  (002-features.png).

### Booking
- Meeting scheduler dans les séquences : "Let prospects book meetings right from your
  outreach. Syncs with your calendar" (001-home.png) ; intégration Google Calendar 1 clic,
  liens Google Meet automatiques (002-features.png).
- Jason : "Automated scheduling — books meetings based on real-time availability",
  "Conflict-free slots — checks the calendar in real time to prevent double bookings"
  (003-jason-ai.png).
- Intégration Calendly + CRMs (HubSpot, Salesforce) (001-home.png).

### Learning / analytics
- Reports & analytics : rapports email/call/task/équipe, "Analytics on meetings booked",
  Team Performance Report, Channel Efficiency Report, stats de templates et séquences,
  A/B testing, export CSV (002-features.png, 007-pricing.png).
- Reporting LinkedIn étendu (messages envoyés, réponses, taux d'acceptation)
  (004-linkedin-automation.png).
- Mentions "AI-trained responses" et "AI-trained re-engagement" dans le plan Agency AI SDR
  (007-pricing.png) — sans explication du mécanisme d'entraînement.

### Compliance
- Trust page dédiée : "At Reply, we protect your data." Hébergement **Microsoft Azure**,
  chiffrement at rest + in transit, backups avec "maximum 24-hour RTO and RPO", "we don't
  sell or rent your data" (008-trust-page.png).
- GDPR : longue section explicative, formulaires de demandes GDPR (accès, rectification,
  restriction, suppression sous 30 jours, portabilité), **DPO nommée : Eugenia Chuprina
  (dpo@reply.io)**, représentant UE : Patrick O'Reilly ; DPA signable électroniquement
  avec clauses contractuelles types (008-trust-page.png).
- Badges homepage : **SOC 2, GDPR, "Advanced email deliverability"** (001-home.png) ;
  "SOC II compliance report" listé dans le comparatif pricing (007-pricing.png).
- Footer légal : Usage Policy, Privacy Policy, ToS, SLA, Data Processing Agreement,
  **Artificial Intelligence Policy** (page dédiée /artificial-intelligence-policy/)
  (001-home.png footer).
- ATTENTION fraîcheur : la trust page référence encore le **EU-US Privacy Shield** et
  parle du GDPR "comes into effect in the spring of 2018" — contenu manifestement daté
  (le Privacy Shield a été invalidé en 2020 ; le site public n'a pas mis cette page à
  jour) (008-trust-page.png).

## 3. Pricing détaillé (007-pricing.png)

Modèle : 4 familles de plans (onglets **Sales Outreach / AI SDR / Agencies**), toggle
annuel ("save up to 17%", et "save up to 50%" sur AI SDR) vs mensuel. Essai gratuit 14
jours sans CB. Unité de facturation centrale : **"active contacts"** = "the number of
unique contacts you can send 1 first-step email and an unlimited number of follow-ups per
month".

### Sales Outreach — Email Volume (facturé au volume, users/mailboxes illimités)
- Annuel : à partir de **$49/mois** ; paliers $49 / $59 / $69 / $89 / $159 / $259 / $459 /
  $899 pour 1 000 / 2 000 / 3 000 / 5 000 / 10 000 / 25 000 / 50 000 / 100 000 active
  contacts/mois ; 200k/300k/500k = "Contact sales".
- Mensuel : $59 / $69 / $79 / $99 / $179 / $299 / $499 / $999 (mêmes paliers).
- Inclus : mailboxes illimitées (Fair Usage Policy), warm-up inclus par boîte, emails
  illimités, 50 crédits Live Data/mois, jusqu'à 200 website visitor reveals/mois, suite
  anti-spam. LinkedIn en add-on $69/mois/compte, Calls & SMS $29/mois/compte.

### Sales Outreach — Multichannel (par utilisateur, tout canal inclus)
- **$89/user/mois** en annuel (10 mailboxes), **$99/user/mois** en mensuel (5 mailboxes).
- "All-Inclusive outreach via Email, LinkedIn, SMS, and Phones at one fixed price" ;
  active contacts illimités ; WhatsApp semi-auto ; étape Zapier ; onboarding CSM (annuel).

### AI SDR (Jason) — facturé au volume, users illimités
- Annuel : **Starter dès $500/mois** (1 000 active contacts), $800 (2 000), $1 000
  (3 000) ; **Growth $1 500/mois** (5 000), $3 000 (10 000) ; **Enterprise "Contact us"**
  (25 000 / 50 000).
- Mensuel : Starter $800 / $1 200 / $1 500 ; Growth $2 500 / $5 000.
- Inclus : contacts B2B temps réel (1 000 sur Starter, 5 000 Growth, 25 000 Enterprise),
  comptes LinkedIn inclus (2 / 10 / 25), users illimités, mailboxes & warm-ups illimités,
  website visitor reveals illimités (lead-level), intent signals, personnalisation IA,
  modes autopilot & copilot, "Done for you deliverability", onboarding CSM → white-glove →
  "Custom playbooks & prompt engineering" + "CEO strategy calls" (Enterprise).

### Agencies
- **Agency Core dès $210/mois** : structure multi-workspaces, clients & users illimités,
  mailboxes + warm-up illimités, inbox consolidée email+LinkedIn, dashboard agence, RBAC,
  white-label en option ; LinkedIn $69/mois/compte. (Le tableau comparatif affiche aussi
  "Starts from $166" pour Agency — deux chiffres coexistent sur la page.)
- **Agency AI SDR dès $500/mois/client** : LinkedIn & email inclus, hyper-personnalisation
  IA, agents IA pour tous les clients, voicemails LinkedIn hyper-personnalisés, playbooks
  IA custom, "Fully autonomous or Approval Mode", données temps réel, AI-trained
  responses/re-engagement.
- **Hybrid plan** (volume classique + agentic) sur demande.

### Add-ons
- LinkedIn automation : **$69/mois par compte** (requests, messages, InMails, PJ, voice
  messages, likes, follows, endorsements).
- Calls & SMS : **$29/mois par compte** (dialer, SMS à l'échelle, transcripts, voicemails
  IA personnalisés).
- AI & Live Data credits : paliers 200 / 500 / 1 000 / 2 500 / 6 000 / 10 000 crédits ;
  ex. affiché **2 500 crédits = $219/mois**.
- Email Validation : paliers 5k / 25k / 50k / 100k / 300k ; ex. affiché **100 000
  validations = $200/mois** ; "start from $20/month" dans le comparatif.
- "Real time B2B data by Generect… starting at $39/months" (tableau comparatif).
- Achat de domaines/mailboxes : "Available" sur tous les plans (prix non documenté sur le
  site ; référence "$39/Month per subscription" côté "the old way" dans le comparatif
  infra).
- FAQ : stockage "unlimited" = en pratique 100 000 prospects par défaut, extensible via
  support.

## 4. Patterns UX observés

- **Framework Discover → Engage → Convert** : structure la nav produits, la page features
  et la homepage (001, 002).
- **Choix explicite Human-led vs AI-led** sur la homepage : deux portes d'entrée côte à
  côte vers le sequencer classique ou Jason (001-home.png).
- **Page Jason = walkthrough numéroté en 6 étapes** du pipeline agent (setup stratégie →
  targeting → multicanal → contenu → replies → booking), chaque étape avec un CTA "Book a
  demo" (003-jason-ai.png).
- **Calculateurs de coût comparatifs** : "Classic SDR $8,000/mo vs Jason AI SDR $500/mo"
  (003-jason-ai.png) ; "Four Tools + Manual work vs One Tool + Automation" avec
  $100–250/user/mois "without Reply" vs $49 avec (005-email-infrastructure.png).
- **Pricing multi-onglets** (Sales Outreach / AI SDR / Agencies) avec slider de volume
  d'active contacts et toggle annuel/mensuel ; le prix affiché change avec le volume
  (007-pricing.png).
- **Tableau comparatif nominatif vs 9 concurrents** (Instantly, Smartlead, Apollo,
  Lemlist, Outreach.io, Salesloft, Hubspot, Expandi, Mixmax) directement sur la page
  pricing (007-pricing.png).
- **Confiance/HITL comme argument produit** : Approval mode, triple verification, source
  transparency (liens vers les sources de chaque message), "Control over every message…
  No surprises" (003-jason-ai.png).
- Badges de conformité (SOC 2, GDPR) et G2 en bandeau violet haut de homepage
  (001-home.png).
- Pavés SEO massifs en bas de page (ex. "B2B Databases – Boost Your Business Growth" sur
  /data/) — stratégie SEO agressive (006-data.png).
- Cookie banner CookieYes (Accept All / Reject All) (toutes pages).

## 5. Canaux couverts

Email (automatisé), LinkedIn (connexions, messages, InMails, voice messages, AI voice
messages clonant la voix, profile views, post likes, endorsements — $69/compte/mois),
Calls VoIP (dialer intégré, $29/compte/mois), SMS, WhatsApp (semi-automatisé), vidéo
personnalisée (Vidyard), + n'importe quel canal via étape Zapier. (001, 002, 004, 007)

## 6. Discours IA

- L'IA est le message central : "Supercharge your sales team with AI", agent nommé
  ("Jason"), anthropomorphisé ("Feels Human, Works Superhuman", "Hire Jason AI").
- Badge "AI SDR" apposé sur chaque feature alimentée par Jason dans les listes de
  features (001, 002).
- Deux niveaux d'autonomie vendus explicitement : **Autopilot & Copilot modes** +
  **Approval mode** (HITL) (003, 007).
- **Multi-LLM assumé : "Pick your AI engine – Claude, Gemini, Mistral, OpenAI"**
  (003-jason-ai.png).
- Écosystème IA : **MCP server** (page /mcp/ + footer), node n8n, API — Reply se rend
  consommable par des agents (007-pricing.png, footers).
- Une "Artificial Intelligence Policy" publique dans le footer légal.

## 7. Délivrabilité (synthèse)

Oui, **warm-up inclus** : gratuit et illimité pour chaque mailbox, réseau peer-to-peer de
vraies boîtes (MailToaster.ai), démarre à la connexion, suivi par boîte. Infrastructure
complète vendue dans le produit : achat de domaines + mailboxes Google/Microsoft, DNS
auto (SPF/DKIM/DMARC), rotation de mailboxes, ramp-up, limites/délais custom, ESP
matching, validation d'emails, health checker DNS, Google Postmaster, liens trackés
brandés, header List-Unsubscribe, équipe délivrabilité humaine accessible. Claim : 98%
inbox placement, prêt à envoyer à J+14. (005-email-infrastructure.png, 001-home.png)

## 8. Transparence de la boucle d'apprentissage

- Documenté : "Source transparency" (Jason fournit les liens des sources utilisées pour
  chaque message), triple vérification des emails IA, review/approve avant envoi
  (003-jason-ai.png, 002-features.png).
- Mentions "AI-trained responses" / "AI-trained re-engagement" (plan Agency AI SDR,
  007-pricing.png) — le mécanisme d'entraînement n'est pas expliqué.
- Aucune documentation publique d'une boucle outcome→learning (le produit apprend-il des
  réponses positives/négatives ? non documenté sur le site).

## 9. RGPD / conformité (synthèse)

Trust page dédiée : GDPR (formulaires de droits, suppression sous 30 j, DPA électronique,
DPO nommée Eugenia Chuprina, représentant UE), hébergement Azure, chiffrement, RTO/RPO
24 h, "we don't sell or rent your data". Badges SOC 2 + GDPR sur la homepage ; "SOC II
compliance report" au niveau des plans supérieurs. Bémol : la trust page cite encore le
EU-US Privacy Shield (invalidé en 2020) et un texte écrit pour l'échéance GDPR de 2018 —
page datée. (008-trust-page.png, 001-home.png, 007-pricing.png)

## 10. Faits notables

1. **La donnée n'est pas propriétaire** : "Real-Time Data Search by Generect" — la base
   1 Md contacts est fournie par le partenaire Generect (006-data.png, 002-features.png).
2. **Jason coûte 10x le plan self-serve** : $500/mois (1 000 contacts) vs $49/mois pour le
   même volume en Email Volume — l'agent est monétisé comme un "employé", comparé à un SDR
   à $8 000/mois (003, 007).
3. **AI voice messages LinkedIn clonant la voix de l'utilisateur** ("in your own voice") —
   différenciateur inhabituel (002, 004).
4. **Choix du modèle LLM par le client** (Claude/Gemini/Mistral/OpenAI) exposé comme
   feature produit (003).
5. **MCP server public** — préparation à l'écosystème agentique (footer, /mcp/).
6. Warm-up peer-to-peer "real inboxes, no bots" revendiqué — approche assumée alors que
   Google/Microsoft la tolèrent mal ; aucun disclaimer sur le site.
7. Incohérences internes du site : 16 vs 14 filtres data ; Agency "from $210" vs "from
   $166" ; "3000+ companies" vs "300+ companies" selon les pages.
8. Disclaimer curieux en footer : "We are not affiliated… with Reply S.p.A." (conflit de
   marque avec l'italien Reply S.p.A.).
9. Anti-bot Cloudflare actif sur le site marketing (bloque le crawl headless après ~2
   pages ; passe en Chrome headed).
10. White-label complet du produit disponible (programme + option Agency) (001, 007).
