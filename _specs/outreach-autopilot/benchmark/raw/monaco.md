# Benchmark concurrent — Monaco (monaco.com)

- Date de capture : 2026-07-01
- Méthode : Playwright chromium headless (UA Chrome 131, 1440x900, locale en-US). Aucun blocage anti-bot (pas de Cloudflare/hCaptcha), aucune bannière cookies rencontrée.
- Périmètre : pages publiques uniquement. Le site marketing est minuscule : 7 pages dans le sitemap (home, product, company, privacy, terms, security, vulnerability-disclosure) + le sous-domaine trust.monaco.com. Pas de blog, pas de page customers/case-studies, pas de docs publiques, pas de page pricing.
- Preuves : screenshots `screenshots/monaco/001..014`, HTML `html/monaco/001..008`. Les images 009–014 sont les captures d'écran de l'app réelle publiées par Monaco sur sa page produit (assets `/pages/product/sections/*.png`).

## 1. Positionnement (citations verbatim)

- Headline home : **« The first revenue engine for startups »** — « The AI native platform that replaces legacy CRM and disparate sales point solutions. » (001-home.png)
- « Monaco is the all-in-one revenue platform - and the system of record. It builds your TAM, runs outbound, captures every interaction, and manages pipeline in one place. » (001-home.png)
- « Everything you need, all in one place » / « One unified platform — Database, signals, sequences, pipeline tracking, call recording, and more. » (001-home.png)
- « Monaco agents are constantly taking action to generate new opportunities and close more revenue. » (001-home.png)
- « Replace your legacy CRM. Monaco is not a CRM you maintain. It is the system that maintains itself. » (002-product.png)
- « Monaco does the updating, You do the selling. » (002-product.png)
- Page company : « Designed for companies that intend to succeed » ; « World-class products deserve a world-class revenue engine » ; « Monaco exists so founders can focus on product while revenue scales itself. » (003-company.png)
- Social proof investisseurs AU-DESSUS du hero : Garry Tan « Monaco solves go-to-market risk for founders without sales backgrounds. » ; Peter Thiel (Founders Fund) « No product sells itself — though Monaco comes close. » ; Ryan Petersen (Flexport) « Every founder needs to put their startup on Monaco before their competition. » (001-home.png)
- Architecture produit en 6 étapes numérotées, groupées en 2 outcomes : 1 Build TAM / 2 Overlay signals / 3 Execute sequences (= « Drive Demand ») puis 4 Capture Activity / 5 Track Pipeline / 6 Ask Monaco (= « Increase Conversion »). (002-product.png)

### Positionnement « qualité d'abord » (bonne personne / bonne entreprise / bon moment / bonne value prop)
La formule quadripartite exacte (« right person, right company, right time, right message ») **n'apparaît PAS verbatim sur le site public actuel** — non documentée. Le positionnement qualité est exprimé autrement :
- « Monaco overlays custom signals on top of your target accounts to prioritize **who to reach out to, when, and why**. » (002-product.png, section 2)
- « **Autopilot** — Monaco decides who to enroll, when to start, and how to follow up - **without blasting your whole TAM**. » (002-product.png, section 3) ← l'anti-spray-and-pray verbatim.
- « **Contextual relevance** — Messages that adapt to business context and intent signals. » (002-product.png)
- « Demand gen that runs itself — **with your guardrails**. Monaco doesn't just recommend outreach. It executes it. » (002-product.png)
- « AI scoring — Built-in ML scoring using firmographics and signals with clear **"why this account"** explanations. » (002-product.png)

## 2. Modèle « humain embarqué » (managed service)

CONFIRMÉ sur le site, c'est un pilier de l'offre :
- « **White-glove activation** — Each customer is paired with a **forward deployed sales executive** to ensure immediate impact. » (001-home.png)
- « **Effortless onboarding** — **We set up your TAM, score all your accounts, overlay signals, build sequences, and import pipeline for you on day 1.** » (001-home.png) — le setup est fait PAR Monaco, pas par le client.
- Témoignage : « Monaco is more than technology. **The forward deployed AE is like having a sales exec on our team.** » — Catheryn Li, Co-Founder, Simple AI (002-product.png)
- « Value in days, not months — Within days, Monaco is generating new meetings and progressing pipeline. » (001-home.png) ; témoignage « We had our TAM built on day 2 and we're running outbound sequences that same day. » — Amy Yan, Nowadays (002-product.png)

## 3. Canaux couverts

- **Email** : confirmé. Sequences + templates email (« email and social media post templates » dans les Monaco Materials, terms 007) ; les AI Agents envoient « messages and emails » (terms 007). Colonne « Email · Today » visible dans l'UI (014-app-ui-ask-monaco.png, arrière-plan).
- **Calls** : la plateforme enregistre et transcrit les appels — « the Monaco Services enable Customer to record and transcribe calls » (terms 007, clause Recording Notice) ; « call recording » listé home (001). C'est de la CAPTURE d'interaction ; un dialer outbound n'est pas documenté.
- **Meetings** : enregistrement vidéo + notes automatiques (résumé, Key Points, Budget and Team Size extraits) — 012-app-ui-capture-activity.png.
- **Gifting** : **VÉRIFIÉ dans l'UI, jamais mentionné dans le texte marketing** — la capture du builder de séquences montre une séquence « Fundraise gifting » : étape 1 cadeau physique (bouteille Veuve Clicquot Yellow Label Brut 750ml, message « Hi Alex - congrats on the recent fundraise! »), wait 3 business days, « Gift reminder », wait, « Final message » (011-app-ui-execute-sequences.png).
- **LinkedIn** : PAS marketé comme canal d'outreach. MAIS deux traces : (a) l'arrière-plan de 014-app-ui-ask-monaco.png montre une colonne d'activité « **Linkedin · 3 days ago** » à côté de « Email · Today » → les touches LinkedIn semblent au minimum trackées dans le produit ; (b) les terms incluent des « **social media post templates** » dans les Monaco Materials. Automatisation LinkedIn : non documentée sur le site.
- **SMS** : seule mention = opt-out des textos de Monaco lui-même (privacy 006) — rien ne prouve un canal SMS produit. Non documenté.

**Conclusion email-only ?** Non strictement : email + gifting (UI) + capture calls/meetings ; LinkedIn tracké mais pas (publiquement) automatisé. L'outreach SORTANT documenté reste essentiellement email (+ cadeaux).

## 4. Délivrabilité — l'angle mort, vérifié à nouveau

**TOUJOURS TOTALEMENT SILENCIEUX.** Grep sur l'intégralité des 8 HTML capturés : `deliverability|warm-up|domain health|spam|bounce|inbox placement|sending domain` = **0 occurrence** (hors « spam » absent aussi). Aucune page, aucune section, aucune FAQ n'aborde warm-up, rotation de domaines/boîtes, monitoring spam, ni volumes d'envoi. Le seul garde-fou affiché est éditorial : « without blasting your whole TAM » (002). L'angle mort documenté chez nous n'a pas changé au 2026-07-01.

## 5. Discours IA

- « AI native platform » (001) ; agents partout : « Agents working for you », « Your TAM builds itself », « Your system runs itself » (001).
- **CRO Copilot** : « Monaco proactively coaches you on what you should be doing to close more revenue » (001) ; « Using Monaco is like having the world's best CRO leading sales at your startup » (002). Fonctions : Prioritized actions, Ask Monaco (chat), Proactive insights (002).
- UI « Ask AI » : coaching brutal post-demo — question « How could I have done a better job on the Judgment Labs demo? » → réponse titrée « **You Lost Control - This Demo Was About You, Not Their Pain** » + 3 bullets d'analyse (014-app-ui-ask-monaco.png).
- Terms : notions contractuelles d'« AI Services » et « **AI Agents** » ; le client est « solely responsible for any action performed by an AI Agent as if Customer had performed such action, including sending messages and emails » ; disclaimer hallucination en majuscules (« THE MONACO SERVICES ... MAY HALLUCINATE ») (007-terms).

## 6. Transparence de la boucle d'apprentissage

- **Au niveau décision : exposée.** « clear "why this account" explanations » (002) ; l'UI signaux montre par cellule un popover « **Reasoning | Sources** » avec justification en langage naturel (« Judgment Labs common investors with Monaco include Founders Fund. ») et sources citées (judgmentlabs.com, blog.ycombinator.com, menlovc.com) (010-app-ui-overlay-signals.png).
- **Au niveau apprentissage : boîte noire.** « Your TAM is automatically updated **and improved over time** » (002) est la seule allusion. Rien sur l'apprentissage à partir des réponses/opens/wins, rien sur un feedback loop visible par l'utilisateur. Non documenté sur le site.
- Contractuellement, les terms réservent à Monaco les « **Service Information** » : « data or insights in deidentified and aggregated form developed or derived from (i) any Customer Materials or Output; or (ii) Customer's ... use of the Monaco Services » = apprentissage cross-clients permis par contrat mais jamais présenté comme feature (007-terms).

## 7. RGPD / Europe / conformité

- **GDPR : zéro mention** sur tout le site public (grep GDPR|EEA|SCC|Standard Contractual|lawful basis = 0 sur privacy, terms, trust center). Privacy notice de facture 100% US.
- Transferts internationaux : « All personal information processed by us may be transferred, processed, and stored **anywhere in the world** » (006-privacy).
- Droit applicable : Californie ; juridiction Northern District of California (007-terms).
- **La conformité marketing est intégralement reportée sur le client** : « Monaco has not obtained any marketing consents on behalf of Customer and ... some jurisdictions may require that Customer obtain consent ... Customer is solely responsible for ensuring that any marketing communications it sends to individuals comply with applicable laws. » (007-terms, clause Monaco Materials).
- **« Leads Data » = data brokers, et Monaco la REVEND** : « We may also collect personal information from other commercially available sources including ... data co-ops and data brokers ("Leads Data") » ; « We may share Leads Data with Monaco customers, **including in exchange for monetary or other valuable consideration**. » ; opt-out de la vente par email à **sam@monaco.com** — l'email du CEO est le contact privacy (006-privacy).
- Trust Center (trust.monaco.com, portail Vanta-like) : **SOC 2 Type I** certifié, publié le 6 mai 2026 (partenaires Advantage Partners & Vanta) ; rapports SOC 2 2025H1/2026H1, pen tests, politiques ; ~60 contrôles listés ; « Customer data deleted upon leaving ». Sous-traitants : **AWS** (IaaS), **Auth0** (identité), **Databricks** (data warehouse analytics), **Datadog** (télémétrie) (005-trust-portal.png). Pas de SOC 2 Type II, pas d'ISO 27001, pas de section GDPR dans le trust center visible.
- Sécurité : politique de divulgation avec safe harbor, PGP, scope www/app/api.monaco.com, pas de bug bounty monétaire (004-security.png).

## 8. Pricing

**Non documenté sur le site.** `/pricing` = 404 vérifié (008-pricing-probe.png) et absent du sitemap. CTA unique partout : « Request demo » — pas de signup self-serve, pas d'essai gratuit. Les terms confirment un modèle enterprise négocié : « Customer will pay Monaco the fees set forth in the applicable **Order Form** » ; paiements non remboursables ; pénalité de retard 1,5%/mois (007-terms). Anecdote (données de démo fictives dans leurs propres screenshots) : l'opportunité « Judgment Labs » est affichée à **$30,000** et les meeting notes extraient « Current budget is $30,000 / Sales team size is 4 » (012, 013) — indicatif de l'ACV mis en scène, PAS un prix public.

## 9. Patterns UX observés (via screenshots de l'app publiés sur le site)

- **Table de comptes agentique** (009, 010) : dark theme, colonnes = Account, Status (New/Prospecting), **Score = lettre (A) + température (« Burning » + emoji flamme)**, Industries (tags colorés), **« Connected to »** (chemins d'intro chauds via le réseau des fondateurs de Monaco : Sam Blond, Malay Desai...), puis **colonnes-signaux custom à réponse Oui/Non** (« Common Investor? », « Sales-led growth? », « YC Co... ») — des questions en langage naturel devenues colonnes.
- **Popover « Reasoning | Sources » par cellule de signal** : justification textuelle + cartes de sources citées avec favicon (010). Pattern-clé de confiance/explicabilité.
- **Builder de séquences** (011) : timeline verticale d'étapes numérotées avec waits explicites (« Wait 3 business days »), panneau de détail à droite (Recipient, Subject, Gift, Message). Étape cadeau physique intégrée nativement.
- **Capture de meeting** (012) : player vidéo + panneau « Meeting Notes » auto-généré : résumé, « Key Points » (CRM actuel, outils), « Budget and Team Size » extraits structurés.
- **Pipeline** (013) : cartes d'opportunités avec logo + montant $, panneau « Overview » avec **résumé IA de l'affaire** (stage, canal Slack partagé, next step, Owner, « Expected Close Date »), timeline datée des interactions.
- **Ask AI** (014) : overlay de chat par-dessus le workspace, réponse de coaching à titre choc + bullets, champ « Ask follow-up ».
- **Marketing site** : one-pager scrollytelling très court, dark, typographie serif élégante pour les headlines ; social proof investisseurs (Tan/Thiel/Petersen) placée AU-DESSUS du hero ; vidéo fondateur ; marquee de témoignages clients nommés (Sphinx, Bluenote, BackOps, Parley, Datawizz, Judgment Labs, Simple AI, Nowadays, Autograph, Vesto) ; un seul CTA « Request demo ».

## 10. Faits notables

- Équipe fondatrice très « GTM royalty » : **Sam Blond** (CEO, ex-CRO Brex & Zenefits), Brian Blond (ex-MD Sutter Hill), **Malay Desai** (CTO, ex-Chief Architect & SVP Eng Clari), **Shek Viswanathan** (CPO, **ex-CPO Apollo** & Qualtrics) (003-company.png). Ils connaissent la donnée outbound de l'intérieur.
- Investisseurs affichés : Founders Fund (Peter Thiel), Garry Tan, Ryan Petersen.
- « Grounded in your ICP — Your TAM is shaped from your ICP, your existing customers, **and the accounts already in your email history**. » (002) — ils minent l'historique email du client pour construire le TAM.
- « AI semantic search — "Crypto companies," "B2B companies manufacturing fasteners" "Companies hiring RAG engineers". » (002) — recherche sémantique de segments en langage naturel.
- « Inbound signals — Track website visitors, demo requests » (002) — de-anonymisation visiteurs incluse.
- Risk detection pipeline : « Ghosting, stalls, and weak engagement flagged early with clear reasons. » (002).
- Monaco revend de la Leads Data (privacy) — ils sont aussi data vendor, pas seulement SaaS.
- API publique : api.monaco.com dans le scope sécurité (004) — non documentée publiquement par ailleurs.
- Le gifting physique dans les séquences n'existe QUE dans les screenshots — aucun texte marketing ne le vend. Idem la trace LinkedIn.
- Site vitrine minimal (7 pages) : toute la conviction passe par la démo — cohérent avec le modèle 100% sales-led.

## Écarts affirmé vs vérifié

| Affirmation | Statut |
|---|---|
| TAM pré-construit day 1, base « billions of data points » | Affirmé (002), invérifiable publiquement |
| Autopilot décide qui/quand/comment sans blast | Affirmé (002), invérifiable |
| Reasoning + Sources par signal | Vérifié visuellement (010, screenshot d'app fourni par Monaco) |
| Gifting dans les séquences | Vérifié visuellement (011) |
| Forward deployed sales executive pour chaque client | Affirmé (001) + témoignage client (002) |
| SOC 2 Type I | Vérifié (trust center Vanta, rapports listés) (005) |
| Délivrabilité gérée | RIEN — non documenté sur le site |
| GDPR | RIEN — non documenté sur le site |
| Pricing | Non documenté ; /pricing = 404 vérifié (008) |
