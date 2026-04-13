# Étape 2 — Sign Up — Exigences pixel-level

**Date :** 2026-04-13
**Scope :** `app/apps/web/src/app/sign-up/page.tsx` (266 lignes).
**Méthode :** code + comparaison avec captures Lightfield `signup-1.png`, `signup-2-email-sent.png`, `signup-3-create-profile.png`.

---

## 0. État actuel vérifié (2026-04-13)

### 0.1 Route et architecture
- **Server component** avec server actions (`"use server"` inline dans le `<form action={}>`). Bon choix, pas de client JS nécessaire pour le submit.
- Accepte searchParams : `error`, `invite`, `email` (ligne 13).
- Gère le flow invite : `?invite=<token>` → après signup, redirect via `/sign-in?callbackUrl=/accept-invite?token=...` pour switcher le tenant (commit `50115f6`).

### 0.2 Voies d'authentification
1. **Google OAuth** (form → `signIn("google", { redirectTo })`) — ligne 116-140
2. **Microsoft Entra ID** (form → `signIn("microsoft-entra-id", { redirectTo })`) — ligne 143-167
3. **Email + password** (form → `handleSignUp` server action) — ligne 203-254

### 0.3 Validation email/password
- `email`, `password`, `name` requis (ligne 42) → sinon `?error=MissingFields`
- Password min 6 chars (ligne 47) → `?error=PasswordTooShort`
- Check existing email en DB (lignes 52-56) → `?error=EmailExists` si duplicate
- Password hashé bcrypt (rounds=10, ligne 64) → stocké dans `authAccounts.access_token`
- UUID pour `userId` (ligne 63)

### 0.4 Redirections post-signup
| Cas | Destination |
|---|---|
| OAuth + invite | `/accept-invite?token=<token>` |
| OAuth sans invite | `/home` |
| Email/pwd + invite | `/sign-in?registered=true&callbackUrl=/accept-invite?token=...` |
| Email/pwd sans invite | `/sign-in?registered=true` |

**Friction majeure :** après création email/pwd, l'utilisateur doit re-saisir email + password sur `/sign-in`. Aucun auto-login.

### 0.5 UX actuelle
- Logo + wordmark Elevay gradient
- "Create your account" (en-tête)
- 2 OAuth en ligne (Google + Microsoft)
- Séparateur "or"
- Error banner (rouge) si `?error=*`
- Invite banner (accent soft) si `?invite=*` : "You're creating an account to accept a workspace invitation. Use the invited email address."
- 3 champs : Full name / Email / Password (avec `PasswordInput` custom — show/hide)
- "Create account" button gradient
- Link "Sign in" en bas

### 0.6 Validations absentes
- Pas de validation format email côté serveur (s'appuie sur `type="email"` HTML)
- Pas de rate limiting visible sur signup (le middleware rate-limite `/api/auth/*` mais signup n'utilise pas d'API route, c'est une server action)
- Pas de reCAPTCHA / hCaptcha → **risque fort de spam accounts**
- Pas de détection email jetable (mailinator, tempmail...)
- Pas de vérification d'email avant accès au produit (l'utilisateur peut entrer une fake email et accéder à tout)
- Password rule : 6 chars = trop faible. OWASP recommande 8 min + complexity ou passphrase.

### 0.7 Pas de legal/trust copy
- Aucun "By signing up, you agree to Terms + Privacy"
- Aucun `<a href="/terms">` / `<a href="/privacy">` sur la page

### 0.8 Pas de pré-remplissage
- Si `?email=x@y.com` est fourni, on pré-remplit email (ligne 232). ✅ OK.
- Mais si l'utilisateur vient de sign-in avec email existant inconnu, pas de CTA "Try sign-up with this email instead".

---

## 1. Exigences pixel-level

### 1.1 Redirection post-signup : auto-login obligatoire
- **Bug UX #1 :** après signup email/pwd, redirect vers `/sign-in?registered=true` = demande de re-saisir email + mot de passe. Friction inutile.
- **Exigence :** auto-login immédiat après signup. Dans `handleSignUp`, appeler `signIn("credentials", { email, password, redirect: false })` après création, puis redirect direct vers `/onboarding` (wizard) ou `/home` (si `?invite`).
- **Vérification :** next-auth v5 supporte bien `signIn()` depuis un server action. La session JWT doit être settée via `cookies().set()`.
- **Flow final :**
  - Create user → hash password → insert → `signIn("credentials")` → cookie session → `redirect('/onboarding')`
  - Si invite : `redirect('/accept-invite?token=...')`.

### 1.2 Vérification d'email
- **Manquant critique.** N'importe qui peut créer un compte avec `fake@fake.com` et accéder à tous les features.
- **Exigence :**
  - Après signup email/pwd, envoyer un email "Confirm your email" avec token unique 24h TTL (lien `/verify-email?token=...`).
  - **Gate** : certaines actions sensibles (invite d'un membre, connexion de mailbox/calendar, envoi de sequence) nécessitent `emailVerifiedAt != null`. Sinon afficher banner "Confirm your email to unlock X".
  - Onboarding peut continuer sans verif (low friction) MAIS envoi de sequence / meeting bot → **bloqué** jusqu'à verif.
  - Si OAuth (Google/Microsoft) : email considéré comme vérifié automatiquement (l'IdP a déjà vérifié). Stocker `emailVerifiedAt = new Date()` dans ce cas.
- **Implémentation :** nouveau champ `authUsers.emailVerifiedAt` (`timestamp`, nullable), nouvelle table `emailVerificationTokens`, endpoint `POST /api/auth/verify-email/send` + `GET /verify-email?token=`, template Resend.

### 1.3 Password policy
- **Actuel** : 6 chars min. OWASP ASVS L1 exige 8, ASVS L2 exige 12.
- **Exigence :**
  - Min 10 chars, ou min 8 + au moins 1 digit + 1 lowercase + 1 uppercase, ou passphrase détection (≥ 3 mots séparés par espace).
  - **Check HaveIBeenPwned Pwned Passwords API** (k-Anonymity, SHA-1 prefix) pour refuser les top 1M compromis. C'est un appel externe 200ms — acceptable sur signup.
  - UI live feedback : barre de force (weak / medium / strong) + liste des critères non respectés.
  - Afficher "Minimum 10 characters" en `<small>` sous le champ.
  - Accepter password managers : `autocomplete="new-password"` (déjà fait si `PasswordInput` le gère — à vérifier).

### 1.4 Magic-link alternative (comme Lightfield)
- Lightfield a **éliminé** le password sur signup : juste email → inbox link → profile.
- **Question produit :** on adopte magic-link en remplacement OU en alternative au password ?
- **Recommandation :** alternative, pas remplacement.
  - **Raison 1 :** certains users préfèrent password (raisons RGPD corporate, contrôle).
  - **Raison 2 :** magic-link dépend de la délivrabilité email (risque Resend bloqué, inbox Gmail promo tab).
  - **Raison 3 :** CTO/VP Sales qui doivent démontrer en live ne veulent pas attendre un email.
- **Exigence : ajouter 3e CTA "Send me a magic link"** sous "or" — CTA secondary (ghost button). Nouveau endpoint `/api/auth/magic-link/send` + page `/verify-magic-link?token=...` qui fait `signIn("credentials")` derrière.
- Split 3 colonnes OAuth + email-only-magic + email+password accordéon → trop dense. Préférer :
  - Nav OAuth (Google + Microsoft)
  - "or"
  - Single email input
  - Toggle en bas : "Use password instead" vs "Send magic link" (radio)

### 1.5 Pré-vérification email duplicate (client-side)
- Aujourd'hui : on submit, server check, si existe → `?error=EmailExists`.
- **Exigence :** debounced check sur blur de l'email field (`POST /api/auth/check-email`) → si existe, inline hint "This email already has an account → sign in instead?" avec lien direct.
- Gain UX : on évite un round-trip full-page.
- Sécurité : endpoint doit rate-limiter (10 req/min/IP) pour éviter email enumeration.

### 1.6 Protection bot / spam accounts
- **Exigence :** reCAPTCHA v3 ou hCaptcha invisible sur le submit signup. Score < 0.5 → block + log.
- **Exigence :** détection emails jetables : check domaine vs liste publique (`disposable-email-domains` npm package ~10k domaines). Si match → "Please use a work email." (hint, pas block strict car faux positifs possibles).
- **Exigence :** rate-limit par IP : 5 signups / heure / IP. Dépasser → 429 + délai 10min.

### 1.7 Legal / trust copy
- **Exigence :** sous le bouton "Create account", afficher :
  > By creating an account, you agree to our [Terms of Service](/terms) and [Privacy Policy](/privacy).
- Taille `text-[11px] text-gray-400`. Liens soulignés.
- Ajouter optionnellement checkbox "Subscribe to product updates" (non coché par défaut, opt-in GDPR).

### 1.8 Affichage erreurs
- Actuel : banner rouge en haut, génerique ("An account with this email already exists.").
- **Exigence :**
  - Erreurs **inline** (sous le champ concerné) plutôt que banner global.
  - `EmailExists` → sous le champ email : "This email has an account. [Sign in instead]"
  - `PasswordTooShort` → sous le champ password : "Password must be at least 10 characters."
  - `MissingFields` → marquer chaque champ vide en rouge (border + message).
  - Erreurs serveur inattendues → banner global fallback.

### 1.9 Pré-remplissage intelligent (invite flow)
- Actuel : `?email=<x>` pré-remplit email. Bon.
- **Exigence additionnelle :**
  - Si `?invite=<token>` : fetch l'invite server-side (déjà au render), lire l'email de l'invite, pré-remplir **et** rendre le champ `readonly` (pas `disabled` — on veut qu'il reste submittable). Explication "This invitation is tied to [email] — if you need a different email, ask your admin to re-invite."
  - Si `?invite` valide + role/tenant dispo, afficher en haut : "Joining [Tenant Name] as [Role]"
  - Si `?invite` expiré ou révoqué → message clair "This invitation has expired. Please ask for a new one." + CTA retour `/sign-up` (sans invite).

### 1.10 Champ "Company name" / "Role" (pré-onboarding)
- Aujourd'hui : seulement Full name + Email + Password. Onboarding wizard collecte company + role après.
- **Question produit :** on les demande sur signup ou on laisse dans onboarding ?
- **Recommandation :** rester léger sur signup (3 champs max). L'onboarding collecte **avec contexte** : affiche le domaine extrait de l'email, demande confirmation, propose role préselectionné "Founder" (règle memo : "infer over asking").
- **Garder** le formulaire signup actuel à 3 champs.

### 1.11 États de chargement
- **Actuel :** aucun loading state visible. Le submit est une server action qui bloque le bouton nativement mais pas de feedback visuel.
- **Exigence :** wrapper le bouton dans un `<SubmitButton>` (`useFormStatus()` de React) qui affiche :
  - Idle : "Create account"
  - Pending : spinner + "Creating..."
  - Button disabled + aria-busy="true"
- Idem pour les 2 OAuth buttons.

### 1.12 Page "Check your inbox" (si email verification ajoutée)
- **Manquant complet.** Lightfield a une belle page dédiée (`signup-2-email-sent.png`) :
  - "Check your inbox"
  - Sub : "To continue, head over to your inbox and click on the verification link we just sent you."
  - CTA "Open Gmail" (lien `https://mail.google.com/mail/u/0/#inbox`)
  - CTA "Open Outlook" (lien `https://outlook.live.com/mail/0/inbox`)
  - CTA "Resend email" (disabled 30s après send, countdown)
  - Email de l'utilisateur affiché en haut-droit + "Log out"
- **Exigence :** créer `/verify-email-sent` avec exactement ce flow.
- **Bonus :** détecter depuis le domaine email → smart CTA (si email = `@gmail.com` → montre "Open Gmail" seulement).

### 1.13 A11y
- **Labels :** `<label htmlFor>` correctement associés. ✅ OK.
- **Required :** `required` sur inputs. ✅ OK.
- **Autocomplete :** ajouter `autocomplete="name"` / `"email"` / `"new-password"`.
- **ARIA error :** lier erreur inline au champ via `aria-describedby` + `aria-invalid="true"` si error.
- **Focus management :** après submit échoué, focus automatiquement sur le 1er champ en erreur.
- **Keyboard :** Enter submit le form ✅ (natif). Tab order logique ✅.
- **Screen reader :** annoncer les erreurs via `role="alert"` ou `aria-live="polite"`.

### 1.14 Analytics
- **Exigence PostHog :**
  - `signup_page_viewed` (source, utm_*, has_invite)
  - `signup_oauth_clicked` (provider = google | microsoft)
  - `signup_email_submitted` (method = password | magic_link)
  - `signup_completed` (user_id, method, has_invite) — déjà présent dans `lib/analytics.ts` si je me souviens bien, à vérifier
  - `signup_error` (error_code)
  - `signup_abandoned` (time_spent, last_field_filled) — via beforeunload
- **Critical conversion event :** `signup_completed` doit fire **après** le redirect, dans `/onboarding` ou `/home` (sinon server action perd le contexte client PostHog).

### 1.15 Performance
- **Actuel :** server component, pas de JS client hors `PasswordInput` (custom component). Lighthouse devrait déjà être bon.
- **À vérifier :** `PasswordInput` est client component — inspect bundle size.
- **Exigence :** éviter tout JS marketing (PostHog loader) ici tant que pas de consent → gate via cookie consent.

### 1.16 Visual polish
- Carte `max-w-sm` (= 384px) = **trop étroit** sur desktop, claim "hero feel" perdu. Lightfield est à ~500-600px centrée avec plus de air.
- **Exigence :** `max-w-md` (= 448px) ou `max-w-[500px]`, padding `py-8 px-10`.
- **Logo + titre :** taille logo OK (40x40). Titre "Elevay" gradient 2xl ✅. Sub "Create your account" en `text-[13px]` → trop petit. → `text-sm` (14px).
- **OAuth buttons :** actuel côte à côte, `flex-1` chacun. OK mais label tronqué sur très petits mobiles. Exigence : breakpoint `sm:` pour côte à côte, sinon stack vertical.
- **Séparateur "or" :** actuel `text-[11px]` → trop petit. `text-xs` (12px) minimum. Couleur `text-gray-400`.
- **Error banner :** couleur OK. Exigence : ajouter icône `AlertCircle` à gauche du texte.

### 1.17 Redirect loop protection
- Si user déjà connecté visite `/sign-up` → actuellement la page s'affiche quand même (pas de check auth). Un user authentifié qui visite sign-up par erreur se retrouve dans un état bizarre.
- **Exigence :** en server component, `getServerSession()` → si session existe → `redirect('/home')`.

### 1.18 Erreurs OAuth
- Si l'utilisateur rejette la permission Google / Microsoft, NextAuth redirige sur `/sign-in?error=OAuthCallback`. Le sign-up perd donc le state (invite token).
- **Exigence :** surcharger le `signIn()` avec `callbackUrl` incluant l'invite token, pour que la redirection d'erreur revienne sur `/sign-up?error=OAuthCallback&invite=...`.
- **Exigence copy :** map d'erreurs OAuth → messages clairs ("You didn't grant access — please try again and approve the Google permissions.")

---

## 2. Comparaison concurrents

### 2.1 Lightfield (captures dispo)
**Forces :**
- Signup minimaliste : 1 champ email + Google OAuth. Pas de password. Friction minimale.
- Deep-link Gmail/Outlook après send = petit détail mais pro.
- "Log out" visible dès le screen "check inbox" → ergonomie multi-account.
- Progress dots 7-steps sur screen "Create your profile" = attente management explicite.
- Copy trust : "By continuing you agree to Terms & Privacy".

**Faiblesses :**
- Pas de password fallback → dépendance email delivery (si Resend blocked → user bloqué).
- Microsoft OAuth absent sur la capture vue → focus Google.

### 2.2 Monaco
- Pas de sign-up self-serve visible dans les captures. Flow "Request Demo" → sales call.
- **Non comparable** : Monaco est demo-led GTM, Elevay est self-serve-first.

### 2.3 Gap synthèse
| Dimension | Elevay actuel | Lightfield | Gap |
|---|---|---|---|
| Auto-login post-signup | ❌ re-login required | ✅ auto | **CRITIQUE** |
| Email verification | ❌ aucune | ✅ magic-link | **CRITIQUE** |
| Magic-link alternative | ❌ absent | ✅ default | **HAUTE** |
| Page "Check inbox" avec deep-links | ❌ absente | ✅ Gmail + Outlook | **HAUTE** |
| Legal copy (Terms/Privacy) | ❌ absent | ✅ sous submit | **HAUTE** |
| Password policy forte | ❌ 6 chars | N/A | **HAUTE** |
| Bot/spam protection | ❌ aucun | ? (pas vu) | **HAUTE** |
| Inline error sous champ | ❌ banner global | ? | MOYENNE |
| Progress indicator | ❌ absent (onboarding l'a) | ✅ 7 dots post-verif | MOYENNE |
| Redirect si déjà connecté | ❌ absent | ✅ sans doute | MOYENNE |
| Password manager autocomplete | ? à vérifier | N/A | MOYENNE |

---

## 3. Gaps priorisés

| # | Gap | Criticité | Effort (h) | Bloquant pour ? |
|---|---|---|---|---|
| S1 | Auto-login post-signup email/pwd | **CRITIQUE** | 2 | Activation rate |
| S2 | Email verification flow (send + verify + gate) | **CRITIQUE** | 10 | Spam accounts, trust |
| S3 | Redirect si déjà authentifié | **CRITIQUE** | 0.5 | UX, loop protection |
| S4 | Legal copy Terms+Privacy sous submit | **CRITIQUE** | 0.5 | Légal |
| S5 | Password policy 10+ chars + Pwned check | HAUTE | 4 | Sécurité, OWASP ASVS |
| S6 | reCAPTCHA v3 / hCaptcha + rate limit IP | HAUTE | 4 | Anti-spam |
| S7 | Page `/verify-email-sent` avec deep-links | HAUTE | 3 | Verif flow UX |
| S8 | Inline errors sous champ + aria-invalid | HAUTE | 3 | A11y, UX |
| S9 | Magic-link alternative (toggle password/magic) | HAUTE | 8 | Parité Lightfield |
| S10 | Debounced check-email on blur | MOYENNE | 3 | UX, friction |
| S11 | OAuth error callback → sign-up (préserver invite) | MOYENNE | 2 | Invite flow robuste |
| S12 | Loading states `useFormStatus` (tous submits) | MOYENNE | 2 | Perception perf |
| S13 | Détection email jetables | MOYENNE | 2 | Qualification leads |
| S14 | PostHog events signup (6 events) | MOYENNE | 2 | Funnel analytics |
| S15 | A11y : autocomplete + aria-describedby + focus error | MOYENNE | 2 | WCAG AA |
| S16 | Visual : max-w-md + typography scale | BASSE | 1 | Polish |
| S17 | Pré-fill invite email + readonly + tenant banner | BASSE | 2 | Invite UX |
| S18 | Opt-in checkbox "Subscribe to updates" | BASSE | 1 | Lead nurturing |

**Total effort v1 (S1-S9) :** ~35h
**Total effort v2 (S10-S18) :** ~17h

---

## 4. Décisions à prendre

1. **Magic-link vs password vs les deux ?** (S9) — recommandation : **les deux**, avec toggle sous l'email field.
2. **Email verification : hard gate ou soft gate ?** (S2) — recommandation : **soft gate** (onboarding accessible sans verif, mais actions sensibles bloquées : invite member, connect mailbox, send sequence).
3. **reCAPTCHA vs hCaptcha ?** (S6) — hCaptcha GDPR-friendly, gratuit jusqu'à 1M req/mo. Recommandation : **hCaptcha** (privacy-first alignment).
4. **Email jetables : block ou warn ?** (S13) — recommandation : **warn** seulement (faux positifs sur legit domains).
5. **Opt-in newsletter checkbox : présent ou absent v1 ?** (S18) — recommandation : absent, on récupère email = on a déjà la permission d'envoyer transac + produit, newsletter séparée via footer landing (L11).

---

## 5. Prochaines actions concrètes

1. Martin : répond aux 5 décisions §4.
2. Implémenter S1 + S3 + S4 (quick wins, ~3h cumulés, gain énorme).
3. Décider S2 + S5 + S6 (sécurité block) en un sprint.
4. S7 + S9 (magic-link + inbox page) dans sprint suivant.
5. Polish v2 : S10-S18 selon bande passante.
