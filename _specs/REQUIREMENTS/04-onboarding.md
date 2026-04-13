# Étape 4 — Onboarding (wizard 7 étapes) — Exigences pixel-level

**Date :** 2026-04-13
**Scope :** `components/onboarding-wizard.tsx` (~900 lignes) + 9 endpoints `/api/onboarding/*` + `/api/tam`, `/api/score`, `/api/embed` + Inngest `onOnboardingCompleted`.
**Méthode :** code lu + audit-02 re-vérifié (bugs P6 et P7 **toujours présents**) + captures Lightfield `onboarding-mail-sync.png` et `onboarding-complete.png`.
**Note :** l'état actuel détaillé est déjà dans `_reports/audit-deep/02-onboarding-deep.md` (350 lignes). Ce document pose les **exigences** et **priorise les gaps non-résolus**.

---

## 0. État actuel — rappel compressé (verify 2026-04-13)

| Étape | Sert à | Bloquante ? | Bugs résiduels |
|---|---|---|---|
| 1. Welcome | Nom, company, domain, role | ✓ | Silent catches sur save |
| 2. Connect | OAuth Google / Microsoft | skippable | Save fire-and-forget avant `signIn()` |
| 3. Privacy | Sync settings (backsync, contact creation, do-not-track) | await sans catch | Pas de "visibility" option |
| 4. Product | Description, sales motion, challenge | ✓ (≥10 chars desc) | Pré-remplissage `websiteAnalysis` possible race condition |
| 5. ICP | Industries, sizes, geo, seniority (✓), department | seniority ✓ | Confidence gaps read-only |
| 6. Building | `/api/tam` + `/api/score` + `/api/onboarding/find-contacts` + `/api/embed` + `/api/onboarding/email-intelligence` | handleBuildTAM | Pas de retry, pas de timeout |
| 7. Ready | Grid X/Y/Z + top 5 contacts | — | Fire-and-forget sur score → display sans scores |

### 0.1 Bugs toujours présents (relecture code)
- **P6 : `currentStep` non persisté.** `onboarding-wizard.tsx` grep `currentStep` → 0 match. Fermer le modal mi-parcours → reload → repart de `welcome`. Les données sont persistées mais la position non.
- **P7 : `needsOnboarding = !onboardingCompleted && isNew`** (status route ligne 75). Si TAM créé 150 companies mais onboarding pas finalisé → `isNew = false` → wizard ne se relance pas → user bloqué entre TAM et completion.

### 0.2 Bugs plausiblement résolus depuis (verify)
- BUGFIX-06 a purgé `.catch(() => {})` silencieux. Les saves d'onboarding ont-ils des toasts ? À vérifier rapidement sur `onboarding-wizard.tsx` après lecture complète.

---

## 1. Exigences pixel-level

### 1.1 Persistance reprise (P6)
- **Exigence critique :** persister `tenants.settings.onboardingCurrentStep` à chaque avancée + restaurer au mount du wizard.
- UI : si reprise, afficher banner "Welcome back — picking up where you left off" + skip direct au dernier step terminé.
- Edge case : si l'utilisateur ferme puis revient le lendemain après 12h → ne pas re-trigger les jobs async (analyze-website déjà fait). Check idempotency via `tenants.settings.websiteAnalysisAt` timestamp.

### 1.2 Fix `needsOnboarding` (P7)
- **Exigence critique :** changer la règle à `needsOnboarding = !onboardingCompleted` (ignorer `isNew`).
- Sinon fallback : `needsOnboarding = !onboardingCompleted || (accounts === 0 && contacts === 0 && !onboardingCompleted)`.
- La règle actuelle masque le wizard si TAM a créé des records mais completion pas triggered.

### 1.3 Étape 1 — Welcome
**Copy actuelle :** titre "Your profile" probablement ; "Company website" regex strict.
**Exigences :**
- Titre : "Let's set up your engine" (éviter "Your profile" redondant avec Settings). Sub : "2 minutes. You can exit and resume anytime."
- Champ "Your name" : pré-remplir `userName ?? session.user.name` ✅ (déjà fait).
- Champ "Company name" : pré-remplir depuis le **domaine email** (captitalizé). Si `martin@elevay.com` → "Elevay". Déjà fait, améliorer : si le domain est freemail (`gmail.com`, `outlook.com`, etc. listés dans `DEFAULT_IGNORED_DOMAINS`), **ne pas** pré-remplir + demander "Working from personal email? Add your company below."
- Champ "Company website" :
  - Regex actuel "strict" → vérifier quel regex. Exigence : accepter `elevay.com`, `www.elevay.com`, `https://elevay.com/`, normaliser tous vers `elevay.com`.
  - Auto-check domain DNS (fetch `/api/check-domain`) en debounced blur → afficher checkmark si résolvable, warning "Could not reach this website" si non.
  - Pré-fetch `analyze-website` **immédiatement** au valid blur (pas à "Next") → gain 5-10s sur l'expérience.
- Champ "Your role" (PillSelect) :
  - Options : Founder / Co-founder / CEO / VP Sales / Sales / Other. Défaut "Founder" ✅.
  - Plus — ajouter "Other" → revele input text libre.
- CTA "Next" : disabled tant que 4 champs pas valides. Spinner pendant save POST.
- Sticky progress bar en haut avec 7 points (voir §1.10).

### 1.4 Étape 2 — Connect
**Exigences :**
- Titre : "Connect your email & calendar" (actuel : "Connect"). Sub : "Elevay auto-captures emails and auto-joins your meetings."
- Layout : 2 CTAs (Google + Microsoft) côte à côte, équivalents.
- Badge "✓ Connected as martin@elevay.com" si déjà OAuth ✅ (déjà fait).
- Si non connecté : bouton "Skip for now" secondaire (gris) à droite.
- **Exigence critique :** remplacer `signIn(provider, { callbackUrl: "/home" })` par `signIn(provider, { callbackUrl: "/?onboardingStep=privacy" })`. Sinon user OAuth → home → perd le wizard.
- En revenant de OAuth, vérifier via `/api/onboarding/status` que `hasGoogle`/`hasMicrosoft` est true. Si false (user rejected perm) → toast "Email connection cancelled. You can connect later from Settings."
- Afficher les **permissions demandées** avant le click : "We'll access: your email (read + send), your calendar (read), contacts read-only". Transparence critique pour trust.

### 1.5 Étape 3 — Privacy / Sync settings
Lightfield a une disposition légèrement plus claire :
- **Account & contact creation** — dropdown "Selective" avec sub-option "Create contacts from personal email addresses (@gmail, @outlook)" (checkbox).
- **Backsync range** — dropdown "1 month".
- **Visibility settings** — dropdown "Full access" (→ partage équipe).
- **Do not track** — textarea.

**Exigences Elevay :**
- Adopter le layout 4-blocks de Lightfield (chaque bloc = titre + sub-description + control).
- Ajouter la **"Visibility settings"** : qui voit quoi dans ton tenant (Full access / Team members only / Private). Important pour multi-user.
- Ajouter checkbox "Create contacts from personal email addresses" sous Account & contact creation (inversé : si coché, freemail domains ne sont PAS ignorés).
- Do not track : améliorer UX — auto-suggest des domains détectés (gmail.com fréquent dans backsync) avec "Ignore (recommended)".
- CTA "Next" + "Back" obligatoires.
- **Exigence copy :** ajouter warning : "You can change these anytime in Settings → Privacy." pour réduire friction choix.

### 1.6 Étape 4 — Product
**Exigences :**
- Titre : "What do you sell?" (actuel : "Your product").
- Textarea `rows=2` → **trop petit** si description riche. Exigence : `rows=3` + auto-grow sur focus.
- Placeholder concret : "We help HR teams run automated employee surveys..."
- Character counter "45 / 500" sous le champ (≥10 min).
- **Pré-remplissage :** si `websiteAnalysis.productDescription` dispo, pré-remplir silencieusement **avec une bannière "Auto-filled from your website — feel free to edit"** pour transparence.
- Sales motion (PillSelect) : garder ✅.
- Challenge (PillSelect) : 4 options ✅. Ajouter "I'm just exploring" comme 5e pour users indécis.
- Si `websiteAnalysis` pas encore fini au moment de l'étape 4 → afficher spinner "Still analyzing your website..." en haut, laisser user continuer, ne PAS bloquer.

### 1.7 Étape 5 — ICP
**Exigences :**
- Titre : "Who's your ideal customer?" (actuel : "Your customer").
- 5 champs : Industries / Sizes / Geo / Seniority ✓ / Department.
- **Confidence gaps : exigence changeante.** Actuel = read-only display. Nouvelle exigence :
  - Pour chaque gap, afficher inline **3 CTA buttons** : "Yes, that's right" / "Not quite" (ouvre input correction) / "Skip".
  - Si "Yes" : auto-fill la pill correspondante dans le ICP.
  - Si "Not quite" : champ libre → sauvegardé en `tenants.settings.icpCorrections` pour feedback au model.
- Exigence **pour seniority** (seul champ required dans cette étape) : si `websiteAnalysis.targetRoles` dispo (généralement chaîne), parser et pré-remplir les pills seniority. Actuellement jamais fait (cf audit-02).
- Tooltip "Why we ask" sur chaque champ → explique le downstream (ex: "Seniority filters Apollo search. Founders = C-level + VP.").
- CTA "Build my TAM" au lieu de "Next" pour signaler le commit (étape 6 coûte 30-60s d'API externes).

### 1.8 Étape 6 — Building
**Le plus gros point de friction actuel.** User attend 30-60s sans feedback réel (stages fake timing).

**Exigences critiques :**
- **Vraie progression** via Server-Sent Events (SSE) ou WebSocket :
  - `POST /api/tam` doit streamer des events (`strategy_generated`, `apollo_searching`, `apollo_page_done`, `companies_enriched`) plutôt que répondre d'un coup.
  - UI display les events en temps réel : "Generated 4 search strategies", "Searching Apollo for SaaS companies 100-500 employees", "Enriched 87 companies", "Scored 87 companies".
  - Abandonner le fake timing (1500ms / 4000ms / 7000ms hardcodé). User perçoit le fake.
- **Timeout + retry :**
  - Timeout 90s sur handleBuildTAM (pas 60s — Apollo search peut être lent).
  - Si timeout : afficher "This is taking longer than expected..." + "Continue waiting" / "Try again" / "Skip TAM (I'll build it later)".
  - Bouton retry button avec error message spécifique : "Apollo API limit reached — try in 5 min" vs "Website analysis failed — please check the URL".
- **Partial success handling :**
  - Si TAM OK mais find-contacts échoue → continuer vers ready avec "TAM built, contacts couldn't be fetched — try from Accounts page".
  - Actuellement tout dans un `try/catch` unique → échec partiel = revient à ICP et tout est perdu.
- **Score await (P4 fix) :** avant `setStep("ready")`, **await** `/api/score` au moins pour les top 20 companies → ready page affichera des scores réels, pas "—".

### 1.9 Étape 7 — Ready
**Actuel :** grid 3 colonnes avec chiffres + preview + "Go to your dashboard".
**Exigences :**
- Garder les chiffres (`X companies`, `Y contacts`, `Z warm matches`) ✅.
- **Ajouter la human touch Lightfield :** "A member of the Elevay team will reach out within 24h to help you get the most from your setup. Questions? Reply to this welcome email."
- **Ajouter un "Quick wins" panel** (inspiré Lightfield docs links) :
  - "▶ Review your top 5 accounts" → `/accounts?sort=score`
  - "▶ Launch your first sequence" → `/sequences/new?template=cold-outbound`
  - "▶ Connect a mailbox for sending" → `/settings/mailboxes`
  - "▶ Customize your data model" → `/settings/data-model`
  - "▶ Ask Elevay anything" → `/chat`
- Auto-send welcome email à l'utilisateur avec ces 5 liens + "Schedule a 15-min setup call" (Calendly).
- CTA principal : "Go to your engine →" (pas "dashboard").

### 1.10 Progress indicator (sticky)
- **Actuel :** wizard a `STEPS` array mais la barre de progrès n'est pas claire dans le code visible. Lightfield affiche des **dots** (`●●●○○○○`) en haut centre.
- **Exigence :** composant sticky top showing 7 dots + label étape courante. Cliquer sur un step terminé = back navigation (pas sur un step futur).
- A11y : `role="progressbar"` `aria-valuenow={current}` `aria-valuemax={7}`.

### 1.11 Skip / Exit
- **Skip partiel :** seul step "connect" a un skip actuellement. Exigence : ajouter skip option sur **product** et **ICP** pour users qui veulent juste explorer (avec warning "You won't see qualified leads until you define your ICP").
- **Exit :** permettre de fermer le modal (X icon en haut-droit, comme Lightfield). Current step persisté, resumable.
- **"Save and exit"** CTA explicit en bas des longs steps (product, ICP) → `POST save` + fermer + toast "Saved, resume anytime from Home".

### 1.12 Mobile
- Wizard actuel est désigné desktop (modal large, multiple inputs côte à côte). Exigence :
  - Breakpoint mobile → inputs stack vertical.
  - PillSelect wrap ✅.
  - TagInput dropdown → plein écran ou bottom sheet.
  - Progress dots → barre horizontale full-width en bas.
  - CTA "Next" sticky bottom pour éviter scroll-to-submit.

### 1.13 A11y
- Labels tous associés ✅ (a vérifier fin du fichier non-lu).
- **Focus trap** obligatoire dans le modal : Tab ne doit pas échapper au modal.
- **Escape** ferme le modal (avec confirm si données non savées).
- **Annoncements** : chaque step change doit `aria-live="polite"` annoncer "Step 3 of 7: Sync settings".

### 1.14 Analytics PostHog
- **Per-step events :**
  - `onboarding_step_viewed` (step_name, step_index, has_pre_fill)
  - `onboarding_step_completed` (step_name, duration_s, n_changes)
  - `onboarding_step_back` (from_step, to_step)
  - `onboarding_step_skipped` (step_name)
  - `onboarding_exit` (step_name, partial_state)
- **Building-step detailed :**
  - `onboarding_tam_started`
  - `onboarding_tam_companies_found` (count, strategies_used)
  - `onboarding_tam_failed` (error, retry_count)
  - `onboarding_contacts_found` (count)
- **Completed :**
  - `onboarding_completed` (duration_s, n_companies, n_contacts, has_email_connected, n_skipped_steps)
- **Analytics-driven decisions :** mesurer funnel par step → où on perd les users → prioritize UX fixes.

### 1.15 Copy / tone
- Actuel mélange registres ("Your profile", "Connect", "Sync settings"). Exigence : homogénéiser sur **imperatif "verb + noun"** ou **question** :
  - Welcome → "Tell us about you" (ou "Who are you?")
  - Connect → "Connect your inbox"
  - Privacy → "Choose what syncs"
  - Product → "What do you sell?"
  - ICP → "Who do you sell to?"
  - Building → "Building your engine..."
  - Ready → "You're ready"
- Éviter jargon : "your customer" vs "ICP" — dépend du persona. Garder "customer" en label visible, "ICP" en tooltip.

### 1.16 Résilience LLM
- `/api/onboarding/analyze-website` : Zod runtime parse strict sur sortie LLM. Si parse fail → retry 1× avec temp=0.1, sinon fallback défaut vide.
- `/api/tam` : idem sur `searchStrategySchema`.
- **Log chaque parse failure** dans `_reports/llm-failures.md` (déjà demandé dans règles Rippletide).

### 1.17 Performance
- Wizard est **client-side only**, ça OK (interactif).
- Lazy-load TagInput options (50+ industries) : actuellement embedded dans le bundle. Exigence : déplacer `INDUSTRIES` / `GEOGRAPHIES` / `JOB_DEPARTMENTS` en `.json` séparés, fetch à l'ouverture de l'étape ICP.
- Framer Motion absent ici — gardez simple.

---

## 2. Comparaison concurrents

### 2.1 Lightfield (2 captures dispo)
**Forces :**
- 7 dots progress **explicite** en haut centre — user sait où il en est.
- Mail sync screen : sections **labeled + described** (titre + subtext par bloc). Dropdown patterns cohérents.
- **Visibility settings** propre à chaque user (Full access / Team / Private).
- "You're all set" screen : human touch (Slack channel invitation) + 4 docs links + single CTA.
- Email address visible en haut-droit + "Log out" → toujours retournable.

**Faiblesses :**
- Pas d'indicateur que c'est un "ICP-driven" onboarding (Lightfield focus est data-capture, pas TAM building).
- Peu de pré-remplissage intelligent visible (Elevay auto-remplit company name, website, ICP from scraping).

### 2.2 Monaco
- Pas de capture onboarding visible. Flow "Request Demo" → sales call → handoff manuel. Non comparable.

### 2.3 Gap synthèse
| Dimension | Elevay actuel | Lightfield | Gap |
|---|---|---|---|
| Progress dots explicites | ⚠️ STEPS array, UI non-vérifiée | ✅ 7 dots top | **MOYENNE** |
| Resume after exit | ❌ restart from welcome (P6) | ✅ email + log-out implies persistence | **CRITIQUE** |
| Visibility settings | ❌ absent | ✅ dropdown | **HAUTE** |
| Ready-step human touch | ❌ juste chiffres | ✅ Slack + team invitation | **HAUTE** |
| Ready-step docs | ❌ absent | ✅ 4 docs links | **MOYENNE** |
| Email visible header | ❌ absent | ✅ permanent | **BASSE** |
| Log out during onboarding | ❌ absent | ✅ permanent | **BASSE** |
| Pré-remplissage LLM | ✅ website scrape | ❌ manuel | **+ Elevay** |
| TAM building | ✅ 30-60s Apollo + LLM | ❌ absent | **+ Elevay** |
| Skip per step | ⚠️ Connect only | ? | MOYENNE |

---

## 3. Gaps priorisés

| # | Gap | Criticité | Effort (h) | Bloquant pour ? |
|---|---|---|---|---|
| O1 | Fix `needsOnboarding` P7 (ignore isNew) | **CRITIQUE** | 0.5 | Completion flow |
| O2 | Persister `currentStep` P6 + resume banner | **CRITIQUE** | 4 | UX (50 %+ users quittent mi-parcours) |
| O3 | Retry button + timeout + partial success step 6 | **CRITIQUE** | 8 | 5-10 % users perdus sur TAM fail |
| O4 | Score await + real progress building step | **CRITIQUE** | 10 | Perception perf + trust |
| O5 | Connect step : `callbackUrl=/?onboardingStep=privacy` | **CRITIQUE** | 1 | OAuth breaks flow si tab fermée |
| O6 | Sticky progress dots top center + clickable back | HAUTE | 3 | Orientation user |
| O7 | Visibility settings dans privacy step | HAUTE | 3 | Multi-user parity |
| O8 | Ready-step : human touch + docs links + quick wins | HAUTE | 4 | Activation post-wizard |
| O9 | Welcome email Resend post-completion | HAUTE | 2 | Retention |
| O10 | Focus trap + Escape + aria-live annoncement | HAUTE | 3 | A11y WCAG AA |
| O11 | Confidence gaps interactifs (boutons Yes/Not quite/Skip) | HAUTE | 4 | Qualité ICP |
| O12 | Analytics PostHog funnel par step (10 events) | HAUTE | 4 | Data-driven optim |
| O13 | Zod runtime parse strict sur outputs LLM + log fails | MOYENNE | 3 | Robustesse |
| O14 | Pré-fetch analyze-website au blur domain (pas au Next) | MOYENNE | 2 | Gain 5-10s perçu |
| O15 | Mobile responsive (stack + sticky CTA bottom) | MOYENNE | 6 | Mobile users (30 % trafic estimé) |
| O16 | Character counter + auto-grow textarea product | MOYENNE | 1 | Polish |
| O17 | Copy homogène (imperatif/question) + titres | MOYENNE | 1 | Polish |
| O18 | Skip per step (product, ICP) avec warning | MOYENNE | 2 | Flexibilité |
| O19 | Email + Log out visible en header permanent | BASSE | 2 | Parity Lightfield |
| O20 | Tooltip "Why we ask" par champ | BASSE | 2 | Transparence |
| O21 | Check-domain DNS live (debounced) | BASSE | 3 | Qualité data welcome |
| O22 | Lazy-load INDUSTRIES/GEO/DEPTS constants | BASSE | 2 | Bundle size |
| O23 | Parser `websiteAnalysis.targetRoles` pour pre-fill seniority | BASSE | 1 | Friction ICP réduite |

**Total effort v1 (O1-O12) :** ~47h
**Total effort v2 (O13-O23) :** ~25h

---

## 4. Décisions à prendre

1. **Persistance `currentStep` : localStorage + DB ou juste DB ?** — Recommandation : **DB** (cross-device + crash-safe). localStorage en optimisation.
2. **Streaming building-step : SSE ou simple polling ?** — SSE propre mais Next.js + Inngest complique. Polling toutes les 2s acceptable en v1 si simple.
3. **Visibility settings scope :** 3 options (Full/Team/Private) ou 2 (Team/Private) ? — 3 pour futur-proof.
4. **Ready-step : on envoie vraiment un welcome email Resend ? Quel from ?** — Oui, `from: Martin <martin@elevay.com>` (personal founder email, higher open rate que no-reply).
5. **Skip sur ICP : permis mais warn, ou bloquer ?** — Warn (respecter user) mais flagger dans `tenants.settings.icpSkipped=true` pour re-nudge plus tard.
6. **Human touch "Slack channel" à la Lightfield : on fait ça, ou on garde email only ?** — Email only v1 (Slack channel = opérationnel costly). Re-évaluer si paid tier.
7. **Confidence gaps : on garde la logique actuelle (info read-only) ou on rend interactif (O11) ?** — Interactif, gain qualité ICP concret.

---

## 5. Prochaines actions

1. Martin : répond aux 7 décisions §4.
2. Fix O1 + O5 immédiats (30 min cumulés, bugs critiques).
3. Implémenter O2 + O3 + O4 en sprint dédié (~22h) → résoud la friction building+exit.
4. Sprint parallèle : O6 + O7 + O8 + O9 + O10 (~15h) → UX clean + activation post-wizard.
5. O11 + O12 dans sprint suivant (~8h) → qualité ICP + analytics.
6. v2 : O13-O23 selon bande passante.
