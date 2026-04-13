# Étape 1 — Landing / Marketing — Exigences pixel-level

**Date :** 2026-04-13
**Scope :** `app/apps/web/src/app/(marketing)/page.tsx` (449 lignes) + `layout.tsx` (31 lignes).
**Méthode :** lecture directe du code + comparaison avec screenshots Monaco (`_research/teardown-monaco/homepage-full.png`) et Lightfield (`_research/teardown-lightfield/homepage-full.png`).
**Note :** l'audit précédent `_reports/audit-deep/01-landing-admin-errors.md` contient des priorités stales (admin gates / silent failures déjà résolus par BUGFIX-05 et BUGFIX-06) ; ne pas re-citer ces priorités.

---

## 0. État actuel vérifié (2026-04-13)

### 0.1 Routing
- `middleware.ts:83-89` : `/` authentifié → `/home`, `/` anonyme → landing marketing.
- `/landing` (legacy route) → redirect vers `/` (`app/landing/page.tsx:3`).
- Pas de 404 custom.
- Metadata OG/Twitter cards présents (`(marketing)/layout.tsx:7-22`).

### 0.2 Stack
- `"use client"` global sur la page → **tout le HTML marketing est rendu côté client après hydratation**, pas SSR natif. Risque SEO + First Contentful Paint.
- Framer Motion (`motion`, `useInView`) pour fade-in + stagger au scroll.
- Icônes : `lucide-react` (Mail, MessageSquare, BarChart3, ChevronDown, Inbox, Search, Users, Send, ListChecks, Clock, Play, ArrowRight).

### 0.3 Structure
| Section | Lignes | Contenu |
|---|---|---|
| Nav sticky | 202-217 | Logo + "How it works" (anchor) + "Book a demo" (Calendly) + "Log in" + "Try free" |
| Hero | 220-233 | Tagline + sub + 2 CTAs, grille de fond en CSS |
| Gradient separator | 236 | — |
| Why Elevay | 239-247 | H2 "Traditional CRMs make you do the work." + paragraphe |
| Foundations (3 cards) | 250-264 | Auto-capture / AI bot / Outreach |
| How it works (7 étapes) | 267-293 | Numérotées 01-07, icône + titre + desc |
| Book demo CTA | 296-309 | Carte avec gradient + Calendly + sign-up |
| FAQ (5 Q) | 312-327 | Accordion custom (`FAQItem`) |
| Final CTA | 330-375 | H2 "Stop updating your CRM" + CTAs |
| Footer | 378-445 | Logo + 4 liens + Twitter icon + copyright |

### 0.4 CTAs
| Emplacement | Label | Destination |
|---|---|---|
| Nav | Log in | `/sign-in` |
| Nav | Try free | `/sign-up` |
| Nav | Book a demo | Calendly (externe) |
| Hero | Try for free | `/sign-up` |
| Hero | Book a demo | Calendly |
| Book-demo section | Book a demo | Calendly |
| Book-demo section | or try it yourself | `/sign-up` |
| Final CTA | Get started free | `/sign-up` |
| Final CTA | or book a demo | Calendly |
| Footer | Product | `#how-it-works` |
| Footer | Book a demo | Calendly |
| Footer | Privacy | `/privacy` |
| Footer | Terms | `/terms` |
| Footer | Twitter | `https://x.com` (**URL hardcoded générique — placeholder**) |

### 0.5 Copy critique
- Hero H1 : "Your CRM finds customers, joins your calls, and does the work for you."
- Hero sub : "Connect your email. An AI bot joins your calls, transcribes everything, and updates your CRM. You just review and close."
- Final CTA H2 : "Stop updating your CRM. Start closing deals."
- Final CTA sub : "Free to start. Set up in 3 minutes."
- "No credit card required"

### 0.6 SEO
- `<title>` : "Elevay — Your CRM finds customers, remembers everything, and does the work"
- `<meta description>` : "AI-powered CRM for founder-led sales. Auto-built TAM, ML scoring, outbound sequences, deal coaching — zero manual data entry. Start free."
- OG + Twitter cards identiques. **Pas de `og:image` défini** → partage Twitter/LinkedIn affichera un snippet sans visuel.
- Pas de `canonical`, pas de `robots.txt` visible, pas de `sitemap.xml` (il y a `sitemap.ts` à la racine — à vérifier).

---

## 1. Exigences pixel-level

### 1.1 Navigation (sticky header)
- **Logo** : gauche, `h-7 w-7` icon + wordmark "Elevay" en gradient. ✅ OK.
- **Liens centre (desktop) :** aujourd'hui "How it works" + "Book a demo". **Manquants exigés :**
  - `Pricing` (anchor vers section pricing, voir §1.10)
  - `Customers` (anchor vers logos + testimonials, voir §1.3)
  - `Security` (lien vers section dédiée OR page `/security`) — posture trust
- **Liens droite :** "Log in" secondaire + "Try free" gradient. ✅ OK mais **ajouter** discrète visibilité du statut "14-day free trial, no credit card" en micro-copy sous le bouton (desktop only).
- **Mobile :** aujourd'hui les liens centre sont `hidden md:flex` → aucun menu burger. **Exigence :** menu hamburger mobile avec sheet/drawer, transition 200ms, focus-trap, close sur ESC et sur tap overlay.
- **Scrolled state :** aujourd'hui `bg-white/95 shadow backdrop-blur`. ✅ OK mais **trop de shadow** pour le look founder-focused minimaliste → préférer `border-b border-gray-100` (1px) + `backdrop-blur-sm`.
- **A11y :** `nav` doit avoir `aria-label="Primary"`. Chaque lien doit avoir `aria-current="page"` si anchor actif.

### 1.2 Hero
- **Badge pre-title (actuel) :** "The autonomous GTM engine for founders" en uppercase gray-500. **Trop générique pour cible founder B2B SaaS.** Exigence : remplacer par un bandeau **social proof** : "Used by 200+ founders" ou "Backed by [YC/funds]" avec logos. Si 0 clients : **retirer** le badge (pas de faux chiffres).
- **H1 :** "Your CRM finds customers, joins your calls, and does the work for you."
  - 28px mobile → 48px desktop. ✅ OK mais le saut est brutal, ajouter un palier 36px entre `sm:text-5xl`.
  - `max-w-[800px]` → préférer `max-w-[760px]` pour forcer 3 lignes desktop : "Your CRM finds customers, / joins your calls, / and does the work for you." (contrôle rythmique).
  - Lourd : supprimer "for you" redondant.
- **Sub H1 :** "Connect your email. An AI bot joins your calls, transcribes everything, and updates your CRM. You just review and close."
  - Structure "X. Y. Z." → mieux : 2 phrases max.
  - Exigence copy : "Connect your email in one click. Elevay joins every sales call, captures the context, writes your follow-ups — you review and close."
- **CTAs :**
  - Primary "Try for free" → `/sign-up`. **Ajouter** sous-texte micro : "14-day free trial · No credit card".
  - Secondary "Book a demo" → Calendly. **Changer** icône ArrowRight vers un `Calendar` icon pour clarifier la sémantique.
- **Hero visuel :** **critique manquant.** Aucun visuel produit, aucune vidéo. Monaco → vidéo founder (emotion + conviction). Lightfield → screenshots in-line (product-led).
  - Exigence : **mettre un mockup produit** sous les CTAs : screenshot du dashboard Home (Up Next) ou du chat avec action card `createContact`. Poids ≤ 250KB WebP, next/image avec `priority`.
  - Alternative si pas de screenshot prod-quality : short loop video 10-15s montrant (a) email arrive, (b) Elevay extrait signal, (c) follow-up draft apparaît. Autoplay muted, poster frame.
  - Exigence stricte : **pas de stock photo, pas d'illustration abstraite, pas de gradient art 3D**. Ça envoie un signal "AI slop" et Martin a déjà purgé ces clichés (voir commits `e03826c`, `a0e9239`, `f2d8a14`).
- **Grille de fond :** ✅ OK (subtile). Garder.

### 1.3 Social proof (MANQUANT COMPLET)
- Aujourd'hui : rien. Zéro logos, zéro testimonial, zéro metric.
- Monaco : 3 témoignages celebrity en haut de page (Garry Tan, Peter Thiel, Ryan Petersen). C'est la 1re chose qu'on voit.
- **Exigence minimale v1 :**
  - Section juste après hero : "Trusted by founders who ship" + strip 5-8 logos clients (grayscale hover color). Si 0 clients réels aujourd'hui → **ne rien mettre** (mais alors placer un "Built by operators, for operators" avec 1 line bio du founder Martin).
  - Ajouter 1-3 testimonials nominatifs : photo + nom + titre + entreprise + quote 1-2 phrases. **Critique :** doivent être vérifiables (nom + linkedin). Pas de "Jane D., CEO" anonyme.
- **Exigence bonus :** une stat concrète : "Capture 95 % of customer context automatically" (si vrai — à calibrer sur `_reports/user-journey-audit.md` ou eval runs).

### 1.4 "Why Elevay" — repositionnement
- Actuel : H2 "Traditional CRMs make you do the work. Elevay does it for you." + 1 paragraphe. ✅ L'angle est bon (angle contre HubSpot/Salesforce).
- **Exigence :** transformer en **tableau comparatif 3 colonnes** :
  | Task | Traditional CRM | Elevay |
  |---|---|---|
  | Log meeting notes | 15 min / call, manual | Auto-transcribed, auto-extracted |
  | Update deal stage | You remember to | Detected from email tone + meeting signals |
  | Find new accounts | Import CSV, enrich, score | Auto-built TAM on ICP you describe in 1 sentence |
  | Write follow-ups | Template + edit | Drafted from actual call content |
  | Answer "what did Sarah say?" | Ctrl-F inbox | Chat with citations |
- Impact : visuel > paragraphe, claim concret par ligne.

### 1.5 "Foundations" 3 cards
- Actuel : Mail / BarChart3 / MessageSquare → Auto-capture / AI bot / Outreach.
- **Problèmes :**
  - 3 cards = réducteur vs 7 steps plus bas → ressenti de répétition. Résoudre : **fusionner** Foundations + How-it-works en **une seule section "How it works" avec 7 cards/rows**, et garder Foundations comme pré-section "3 pillars" court (30s read) au-dessus.
  - Icônes Lucide génériques. Exigence : icônes **custom** (SVG à 1.5 stroke) qui évoquent les concepts (ex: un enveloppe qui se transforme en node graph pour "auto-capture", un mic waveform pour AI bot, etc.). OU garder Lucide mais ajouter un micro-visuel par carte (petite animation Lottie inline).
- **Critique manquant :** aucun des 3 cards ne mentionne les **skills** (24 skills wired dans le produit, commit `ba34ad2`). C'est notre différenciateur. Exigence : une 4e card "Skills that work for you" mentionnant 3-5 skills saillants (pipeline triage, churn radar, battlecard, expansion scout, email composer).

### 1.6 "How it works" — 7 étapes
- Actuel : numérotation 01-07, icône + titre + desc, lignes de séparation gray-100.
- **Problèmes :**
  - **Layout plat** → 7 lignes verticales se lisent comme un bulletpoint. Monaco fait une approche cinematographique (vidéo) ; Lightfield fait screenshots in-line.
  - Pas de visuel par étape. Sur 7 étapes, l'utilisateur doit faire confiance au texte — mauvais ROI attention.
- **Exigence :**
  - Layout alternatif **split 50/50** par étape : texte à gauche, **screenshot produit zoomé** à droite, alternance L/R à chaque étape. Forcer au moins 4 screenshots réels (etapes 01 Connect, 02 Bot joins call, 04 Chat with citations, 06 Sequences).
  - Étapes sans screenshot (03 Review, 05 Build TAM, 07 Meeting brief) : GIF courts (5-8s) ou illustrations minimalistes.
  - Étape 02 "An AI bot joins your calls" → ajouter sub-bullet qui liste les plateformes avec logos officiels : "Works with Google Meet, Zoom, Microsoft Teams". Actuel mentionne les noms mais pas de logos.
- **Copy spécifique :**
  - Étape 03 "Review and confirm" → clarifier "1-click batch approve" (existe dans le chat, commit `ba34ad2`) — élément différenciant vs Lightfield qui demande review item-par-item.
  - Étape 05 "Build your TAM" → ajouter "on real company data (not guessed)" pour différencier de l'output LLM-only.

### 1.7 Book-demo CTA (mid-page)
- Actuel : carte gradient + Calendly + sign-up. ✅ OK.
- **Exigence :** ajouter **indicateur de disponibilité** : "Next slot: today at 3pm PST" (fetch Calendly availability via API, fallback static). Augmente conversion vs CTA statique.
- Si Calendly API non accessible → au minimum : "15-min demo · We'll connect your email live and show you the full pipeline." (déjà présent). ✅ OK.

### 1.8 FAQ
- 5 questions actuelles : différence vs HubSpot/Salesforce, meeting bot, team size, AI memory, security.
- **Exigences additions :**
  - "What data do you store? Where?" (DPA, region) — GDPR critical pour Europe.
  - "Can I use it solo or do I need a team account?" (monétisation clarity)
  - "What happens when my trial ends?" (trust, pricing transparence)
  - "Does Elevay work with my existing stack?" (Gmail, Outlook, HubSpot import, Salesforce import)
  - "How is Elevay different from [Monaco / Lightfield / Attio] ?" (compétitive — 1 FAQ par compétiteur si copie courte)
- **A11y :** `<button aria-expanded={open}>` + `id` sur question + `aria-controls` sur panel. Actuel manque ces attributs.
- **Keyboard :** ajouter support `Space` et `Enter` pour toggle (actuel ne gère que click).

### 1.9 Final CTA
- Actuel : H2 "Stop updating your CRM. Start closing deals." + sub "Free to start. Set up in 3 minutes." + 2 CTAs.
- **Exigences :**
  - Remplacer "Set up in 3 minutes" par chiffre vérifiable (mesurer via PostHog `funnel_signup_to_dashboard_median`). Si >3 min → changer copy, ne pas mentir.
  - Ajouter "Trusted by [X] founders across [Y] countries" (si stats réelles dispo).
  - Intégrer un **mini signup inline** : email input + "Get started" button (transforme CTA en conversion directe, gain 10-15 % vs click → landing sign-up).

### 1.10 Pricing (SECTION MANQUANTE)
- **Aucune section pricing sur la landing actuelle.** Seul accès : `/pricing` (dans dashboard, auth required).
- **Exigence critique :** section pricing publique avant le final CTA.
  - 3 tiers : Free (trial), Pro, Team.
  - Points par tier : max accounts, max contacts, max sequences, meeting bot minutes/mo, support SLA.
  - Pricing en dur (preuve de transparence). Si hesitation → "Usage-based, from $X/mo".
  - Toggle mensuel vs annuel (typiquement -20 % annuel).
- **Alternative :** si pricing pas figé → "Pricing that scales with you — book a demo for a quote" + anchor vers book-demo. Mais c'est un signal rouge vs compétiteurs. Préférer **des prix affichés même s'ils changeront**.

### 1.11 Footer
- Actuel : logo + Product/Book-demo/Privacy/Terms + Twitter icon.
- **Exigences manquantes :**
  - Colonne "Product" (Features, Pricing, Changelog, Roadmap, Skills)
  - Colonne "Resources" (Docs, API, Status, Security, Blog)
  - Colonne "Company" (About, Careers, Contact, Customers)
  - Colonne "Legal" (Privacy, Terms, Acceptable Use, DPA)
  - Newsletter signup (email input + subscribe) — low-friction lead capture.
  - Status page link : `https://status.elevay.com` (à créer, voir §1.13).
  - Twitter/X actuel pointe vers `https://x.com` générique → **critique bug** : doit pointer vers le compte Elevay officiel (ou retirer si pas de compte).
  - LinkedIn company page (absent).
- **Copyright :** "© 2026 Elevay" ✅. Ajouter "Elevay SAS — SIREN xxx" si entité française légale requise.

### 1.12 SEO
- **Ajouter `og:image`** (1200x630 PNG/WebP) : mockup produit + tagline + logo. Critique pour partages Twitter/LinkedIn.
- **Ajouter JSON-LD `SoftwareApplication`** : name, description, offers, aggregateRating (si reviews), url. Booste Google snippet.
- **Vérifier `sitemap.ts`** (racine) : doit exposer `/`, `/privacy`, `/terms`, `/acceptable-use`, `/sign-in`, `/sign-up`. Priorités et changefreq.
- **Ajouter `robots.txt`** explicite (si pas déjà dans `public/`).
- **Pages "SEO-landing" dédiées à long terme** : `/vs/hubspot`, `/vs/salesforce`, `/vs/monaco`, `/vs/lightfield`, `/for/founders`, `/for/agencies` — high-intent queries. Pas v1 mais à planifier.

### 1.13 Trust & Security
- **Page `/security` absente.** Exigence : page publique listant certifications (SOC2 en cours ?), encryption at rest, DPA téléchargeable, data region (EU?), sub-processors list.
- **Page `/status`** (uptime) — peut être un embed BetterStack/StatusPage (10 min setup). Si 0 infra pour ça → lien vers GitHub incidents.

### 1.14 Performance
- **`"use client"` sur toute la page** → le HTML initial est quasi-vide, tout est hydraté. Mauvais pour FCP + SEO robots JS-limited.
- **Exigence :** découper en `server component` (root) + `client component` pour seulement les parties interactives (FAQ accordion, nav scroll state, Framer Motion sections). Ratio cible : ≤30 % JS client.
- **Framer Motion** est lourd (~50KB gzipped). Alternative : CSS scroll-triggered animations (`scroll-timeline` ou IntersectionObserver inline). Gain ~40KB sur landing.
- **Images** : toutes via `next/image` avec width/height explicites. Aujourd'hui `<img src="/logo-Elevay.svg">` direct — OK pour SVG mais screenshots doivent être `<Image>`.
- **Cible Lighthouse :** Performance ≥ 95, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 100.

### 1.15 Accessibilité
- **Focus visible** : aucun `focus:ring` visible dans les classes CTA. Exigence : tous les boutons et liens doivent avoir un `focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`.
- **Contraste** : texte gris `text-gray-500` sur blanc = ratio 4.59:1 → OK AA mais borderline. Préférer `text-gray-600` pour body copy.
- **Motion** : Framer Motion animations doivent respecter `prefers-reduced-motion`. Aujourd'hui `useInView` lance l'animation inconditionnellement.
- **Skip link** : ajouter `<a href="#main" className="sr-only focus:not-sr-only">Skip to content</a>` en tête de `<body>`.
- **Landmarks** : `<nav>`, `<main id="main">`, `<footer>`, `<section aria-labelledby=...>` avec `<h2 id>`.

### 1.16 Analytics / Observabilité
- **Aucun événement PostHog** sur la landing aujourd'hui (seul le dashboard a `PostHogPageTracker`).
- **Exigence :** tracker événements landing :
  - `landing_viewed` (referrer, utm_*, viewport, locale)
  - `landing_cta_clicked` (cta = "try_free" | "book_demo" | "log_in", position = "nav" | "hero" | "mid" | "final" | "footer")
  - `landing_faq_opened` (question, time_spent_before)
  - `landing_section_viewed` (section_id, scroll_depth) — via IntersectionObserver
  - `landing_video_played` / `landing_video_completed` (si hero video ajoutée)
  - `landing_pricing_viewed` / `landing_pricing_tier_hovered`
- **Consent :** bandeau cookie consent (GDPR) avant de fire PostHog. Si pas consent → analytics off.

### 1.17 Internationalisation (NICE-TO-HAVE)
- Aujourd'hui : 100 % anglais. Product settings supportent fr/de/es/pt/it/nl/ja/ko/zh (voir `settings/profile`).
- **Exigence (v2) :** landing disponible au minimum en FR (Martin est français, pipeline France accessible) + EN. Détection via `Accept-Language` header + switcher nav. Routes `/fr` et `/en`. Hreflang metadata.

---

## 2. Comparaison concurrents

### 2.1 Monaco (`_research/teardown-monaco/homepage-full.png`)
**Forces :**
- Dark theme = signal "serious tool, not toy". Cible CTO/VP Sales.
- 3 testimonials celebrity **au-dessus** du hero → tout l'écosystème YC y va.
- Vidéo founder dès le dessus → emotion + conviction.
- Single CTA "Request Demo" → friction volontaire (qualification).
- Pas de pricing public → sales-led GTM.

**Faiblesses :**
- Pas d'info produit sans demo call → friction forte pour founder qui veut évaluer rapidement.
- Pas d'info pricing, pas de self-service.

**Ce qu'on copie :**
- Mettre 1-3 testimonials hauts si dispo.
- Ajouter une vidéo founder (Martin) sous le hero (optionnel v2).

**Ce qu'on ne copie pas :**
- Dark theme → Elevay reste light (cohérence avec le dashboard light).
- Demo-only GTM → Elevay est **self-serve-first** avec try free.

### 2.2 Lightfield (`_research/teardown-lightfield/homepage-full.png`)
**Forces :**
- Product-led : screenshots du produit in-line, plusieurs sections.
- Dense et informatif.
- Typographie soignée, beaucoup de whitespace.
- Sections "before/after" workflow.

**Faiblesses :**
- Très dense = risque de scroll fatigue.
- Peu de différenciation visuelle (light theme générique B2B SaaS).

**Ce qu'on copie :**
- Screenshots produit in-line dans chaque section "how it works".
- Approche product-led (vs demo-led Monaco).

**Ce qu'on ne copie pas :**
- Sur-densité textuelle.

### 2.3 Gaps par rapport aux deux
| Dimension | Elevay actuel | Monaco | Lightfield | Gap |
|---|---|---|---|---|
| Social proof hero | ❌ aucun | ✅ 3 VCs | ⚠️ partial | **Critique** |
| Hero visuel | ❌ aucun | ✅ vidéo founder | ✅ screenshot | **Critique** |
| Screenshots produit dans how-it-works | ❌ aucun | N/A (vidéo) | ✅ oui | **Critique** |
| Pricing public | ❌ absent | ❌ absent (demo-led) | ✅ présent | **Critique vs Lightfield** |
| Page /security | ❌ absente | ✅ présente | ✅ présente | **Haute** |
| Comparative FAQ | ⚠️ 1 Q (HubSpot/SFDC) | ❌ | ✅ | **Moyenne** |
| Page /customers | ❌ | ✅ | ✅ | **Moyenne** (dès qu'on a logos) |
| Changelog public | ❌ | ❌ | ✅ | **Moyenne** |

---

## 3. Gaps priorisés

| # | Gap | Criticité | Effort (h) | Bloquant pour ? |
|---|---|---|---|---|
| L1 | Ajouter screenshots produit (hero + how-it-works 7 étapes) | **CRITIQUE** | 8 | conversion visiteur → sign-up |
| L2 | Social proof section (logos ou testimonials) | **CRITIQUE** | 6 | trust, conversion |
| L3 | Pricing section publique (3 tiers) | **CRITIQUE** | 4 | qualification, conversion |
| L4 | `og:image` + JSON-LD SoftwareApplication | HAUTE | 2 | SEO, social share |
| L5 | Menu hamburger mobile | HAUTE | 3 | UX mobile (50 %+ traffic) |
| L6 | Page `/security` publique | HAUTE | 4 | trust B2B, deal qualification |
| L7 | Footer 4 colonnes + Twitter/LinkedIn réels | HAUTE | 3 | trust, bug (Twitter `https://x.com`) |
| L8 | Server component split + réduire JS client | MOYENNE | 6 | Lighthouse, SEO |
| L9 | PostHog events landing (7 events) | MOYENNE | 3 | analytics, optimisation future |
| L10 | FAQ étendue (9 Q, A11y, comparatives) | MOYENNE | 3 | trust, objection handling |
| L11 | Repenser "Foundations" vs "How it works" | MOYENNE | 4 | cohérence, répétition |
| L12 | Hero copy simplifié + CTAs avec micro-trust | MOYENNE | 2 | conversion |
| L13 | Tableau comparatif "Traditional CRM vs Elevay" | MOYENNE | 3 | différenciation narrative |
| L14 | Cookie consent bandeau GDPR | MOYENNE | 3 | GDPR compliance EU |
| L15 | `prefers-reduced-motion` + focus-visible rings | BASSE | 2 | A11y (WCAG AA strict) |
| L16 | Status page + changelog | BASSE | 4 | trust long-term |
| L17 | i18n FR + EN | BASSE (v2) | 12 | marché France |
| L18 | Section "Skills that work for you" (4e card Foundations) | BASSE | 3 | différenciation — 24 skills wired |
| L19 | Disponibilité slot Calendly dynamique | BASSE | 2 | conversion mid-page |
| L20 | Mini inline signup final CTA (email field + submit) | BASSE | 3 | conversion bottom-page |

**Total effort v1 (L1-L7) :** ~30h
**Total effort v2 (L8-L20) :** ~46h

---

## 4. Décisions à prendre (ouvertes)

1. **Social proof v1 :** on a des clients / design partners ? Si non, on met quoi ? Options : (a) "Built by [Martin background]" + 1 quote de beta-user, (b) rien pour l'instant, (c) attendre 5 vrais logos.
2. **Vidéo hero :** on tourne une vidéo founder Martin ou on reste sur screenshots seulement ?
3. **Pricing :** on affiche 3 tiers fixes maintenant ou "contact sales" ?
4. **Dark mode landing :** on reste light (cohérent avec le dashboard) ou on teste un variant dark à la Monaco ?
5. **Self-serve vs demo-led :** on garde "Try free" en CTA primaire ou on passe demo-first (augmente qualification, baisse volume) ?
6. **`/vs/compétiteur` pages :** on planifie pour Q3 2026 ou on laisse tomber ?

---

## 5. Prochaines actions concrètes (ordre suggéré)

1. Martin : répond aux 6 décisions §4.
2. Commander screenshots produit prod-quality (home, chat, accounts, sequences, meeting-prep) — 1 par étape how-it-works + 1 hero. Format WebP ≤ 250KB, ratios figés.
3. Implémenter L1 + L2 + L3 + L4 + L5 + L6 + L7 (gaps CRITIQUE + HAUTE) en un seul sprint → PR.
4. Mesurer impact via PostHog (si L9 livré) pendant 2 semaines.
5. Itérer sur L11 + L12 + L13 + L14 pour polish.
6. v2 : L8 + L10 + L15-L20.
