# Étape 3 — Sign In — Exigences pixel-level

**Date :** 2026-04-13
**Scope :** `app/apps/web/src/app/sign-in/page.tsx` (156 lignes).
**Méthode :** lecture directe + grep exhaustif sur "forgot/reset password" dans tout le repo (zero match).

---

## 0. État actuel vérifié (2026-04-13)

### 0.1 Bugs/manques critiques identifiés d'entrée
- **`SignInPage` ne lit AUCUN `searchParams`.** Les query params (`?error=*`, `?registered=true`, `?callbackUrl=*`, `?invite=*`) sont **complètement ignorés**. Conséquences :
  - L'utilisateur qui vient de `/sign-up` avec `?registered=true` ne voit **aucun feedback** "Votre compte a été créé, connectez-vous".
  - Les `AuthError` captés (ligne 97-98) redirigent vers `?error=<type>` mais **la page ne les affiche pas**. L'utilisateur retombe sur la page vierge sans savoir ce qui s'est passé → **re-tente et re-échoue**.
  - Le `callbackUrl` dans l'URL est **ignoré** → le `redirectTo` est hardcodé `/home` (ligne 36, 61, 105). Le flow invite (sign-up → sign-in?callbackUrl=/accept-invite) **fonctionne seulement si NextAuth persiste le callbackUrl** via cookie/hidden input, à vérifier.
- **Aucun lien "Forgot password"** : grep sur `forgot.password|reset.password|password.reset|forgotPassword|resetPassword` dans `app/apps/web/src` → **0 fichiers**. Le flow reset password n'existe pas du tout.

### 0.2 Voies d'authentification
1. **Google OAuth** — redirectTo hardcodé `/home`.
2. **Microsoft Entra ID** — redirectTo hardcodé `/home`.
3. **Email + password** — server action, `signIn("credentials", formData)`.

### 0.3 Gestion d'erreur email/pwd
- `try/catch` sur `signIn("credentials")` (lignes 94-101)
- Si `AuthError` → `redirect("/sign-in?error=${error.type}")` avec types possibles : `CredentialsSignin`, `AccessDenied`, `Verification`, `CallbackRouteError`, etc.
- **Mais la page ne lit pas `error` → l'utilisateur ne voit rien**

### 0.4 Copy
- H1 : "Elevay" (gradient)
- Sub : "Sign in to your sales engine" (13px, gris)
- CTA : "Sign in"
- Link : "Don't have an account? Sign up"
- Legal : "By signing in, you agree to our Terms of Service and Privacy Policy." (10px — correct mais minuscule)

### 0.5 UI/UX
- `max-w-sm` (384px)
- `p-8` padding
- 2 OAuth côte à côte (Google + Microsoft)
- Séparateur "or"
- Email + Password + Submit
- Pas de loading state (submit sans spinner)
- Pas de "Remember me" checkbox
- Pas de "Sign in with magic link"
- Pas de lien vers `/sign-up` si email inconnu (ni inline error handling)

### 0.6 Sécurité
- Rate limiting **existe** via `middleware.ts` sur `/api/auth/*` (10 req/min/IP) — mais le sign-in est une **server action**, pas une API route → le rate limit ne s'applique probablement pas.
- Aucun `failed_login_attempts` tracking per user → pas de lockout.
- Aucune détection géographique / device (login from new device, login from new country).
- Aucun 2FA.

---

## 1. Exigences pixel-level

### 1.1 Lecture des `searchParams` (BUG CRITIQUE)
- **Exigence immédiate :** convertir `SignInPage` pour accepter `{ searchParams }` et afficher :
  - **Success banner** (vert, `CheckCircle` icon) si `?registered=true` : "Your account was created — please sign in to continue."
  - **Error banner** (rouge, `AlertCircle` icon) si `?error=*` avec mapping :
    - `CredentialsSignin` → "Invalid email or password. Did you [sign up](/sign-up) with a different email?"
    - `OAuthAccountNotLinked` → "This email is already linked to a different provider. [Sign in with Google/Microsoft instead]." (détecter provider from DB if possible)
    - `AccessDenied` → "Access denied. Your account may be suspended — [contact support](mailto:support@elevay.com)."
    - `Verification` → "The link you clicked has expired or is invalid. [Request a new one](/forgot-password)."
    - `Default` → "Something went wrong. Please try again."
  - **Info banner** (bleu, `Info` icon) si `?reason=session-expired` : "Your session expired. Please sign in again."
  - **Info banner** si `?reason=password-reset-success` : "Your password has been updated. Sign in with your new password."
  - Invite banner si `?invite=*` + `?callbackUrl=accept-invite` : "You're signing in to accept a workspace invitation."

### 1.2 CallbackUrl respect
- **Exigence :** lire `searchParams.callbackUrl` et le passer à `signIn()` comme `redirectTo`.
- **Sécurité :** valider que `callbackUrl` est une URL **interne** (commence par `/`, pas `//`, pas `http(s)://`). Sinon fallback `/home`. Prévient open redirect attacks.
- Applicable aux 3 voies (Google, Microsoft, credentials).

### 1.3 Flow "Forgot password" (MANQUANT COMPLET)
Le plus gros gap fonctionnel de cette étape. Zero code dans le repo.

**Exigences du flow :**
1. **Link "Forgot password?"** sous le champ password, aligné droite (pattern standard Okta/Google/Auth0).
2. **Page `/forgot-password`** :
   - Input email + submit "Send reset link"
   - Message confirm : "If an account with this email exists, we've sent you a reset link. Check your inbox."
   - **Toujours la même réponse** que l'email existe ou non → évite l'enumeration.
   - Rate limit : 3 requêtes / heure / email + 10 / heure / IP.
3. **Endpoint `POST /api/auth/forgot-password`** :
   - Génère token unique (32 bytes random, base64url)
   - Hash stocké en DB (`passwordResetTokens` table : userId, tokenHash, expiresAt, usedAt)
   - TTL 1 heure
   - Un seul token valide à la fois par user → invalider les précédents
   - Envoie email via Resend avec lien `https://app.elevay.com/reset-password?token=<token>`
   - Email template : "You requested a password reset..." + CTA button + "If you didn't request this, ignore this email." + security note "Link expires in 1 hour."
4. **Page `/reset-password?token=...`** :
   - Vérifie token valide + non expiré + non utilisé (GET pré-fetch)
   - Si invalide → "This link has expired or is invalid. [Request a new one](/forgot-password)."
   - Si valide → form "New password" + "Confirm password" (même policy que signup : 10+ chars, HIBP check) + CTA "Update password"
   - Submit → update bcrypt hash + mark token used + **invalidate all sessions** (important : révocation) + signIn auto → redirect `/home`
5. **Email notif :** après reset réussi, envoyer un email "Your password was just reset from IP x.x.x.x at time T. If this wasn't you, contact security@elevay.com."
6. **Analytics :** `password_reset_requested`, `password_reset_completed`, `password_reset_invalid_token`.

### 1.4 Magic link (parité avec signup S9)
- Si l'étape 2 adopte magic-link, même offer sur sign-in.
- Bouton toggle sous password : "Use a magic link instead" → remplace le field password par un CTA "Send me a sign-in link".
- Reuse endpoint `/api/auth/magic-link/send` avec `purpose: "sign-in"`.

### 1.5 Loading states
- **Actuel :** aucun feedback visible pendant submit. User peut double-cliquer, envoyer 2 requêtes.
- **Exigence :** `SubmitButton` avec `useFormStatus()` pour les 3 forms (OAuth Google, OAuth Microsoft, credentials). Spinner + label "Signing in…" pendant pending.
- Disabled le button pendant pending, `aria-busy="true"`.

### 1.6 Rate limiting au niveau user (pas juste IP)
- **Actuel :** seul l'IP est rate-limité (`middleware.ts`).
- **Exigence :**
  - Track `failed_login_attempts` per user (en DB ou Redis).
  - Après 5 échecs consécutifs sur 15 min : lockout 15 min. Afficher "Account temporarily locked due to failed attempts. Try again in 15 minutes or reset your password."
  - Reset compteur après sign-in réussi.
  - **Ne pas** leak si email existe (lockout même si email inconnu → même comportement).

### 1.7 2FA (optional, v2)
- **Manquant mais non bloquant v1.** Pour v2 :
  - TOTP (Google Authenticator, Authy, 1Password) via `authenticator` library
  - Backup codes (8 codes one-time)
  - Setting opt-in via `/settings/security`
  - Required pour admin role (rôle stocké en JWT)
- v1 : noter le gap, ne pas implémenter.

### 1.8 "Remember me" vs session duration
- **Actuel :** sessions NextAuth durent par défaut 30 jours. Pas de checkbox utilisateur.
- **Question produit :**
  - Option A : "Remember me" checkbox → si unchecked, session = 1 jour. Si checked, 30 jours.
  - Option B : ne rien exposer à l'utilisateur (simplifie). Sessions 30 jours par défaut.
- **Recommandation :** option B (simplifie, 95 % des B2B SaaS le font ainsi).

### 1.9 Device detection + notif (v2)
- **Exigence v2 :** détecter `userAgent` + geoip → si nouveau device / pays jamais vu pour cet utilisateur, envoyer email "New sign-in from [device] in [city]. If this wasn't you, reset your password." + stocker devices known en DB.
- v1 : pas implémenter mais noter.

### 1.10 Inline errors sous champ
- Même exigence que sign-up : si email inconnu → afficher sous email "No account with this email. [Sign up](/sign-up)?"
- Si password incorrect → afficher sous password "Incorrect password. [Reset](/forgot-password)?"
- **Mais attention :** ces deux messages différents **leakent** l'existence d'un email. Pour éviter l'enumeration, préférer un message générique "Invalid email or password" dans **tous** les cas. Le lien "Sign up" reste visible en permanence sous le form.

### 1.11 OAuth provider linked handling
- `OAuthAccountNotLinked` : si un email a déjà été utilisé via credentials et que l'utilisateur tente Google/Microsoft, NextAuth refuse (par défaut).
- **Exigence :** détecter ce cas et proposer le merge via flow sécurisé :
  - Afficher "This email is registered with password. [Sign in with password](#) then link Google in settings."
  - OU : après sign-in password, proposer "Link Google account" dans settings pour éviter de recroiser.
- v1 : message informatif suffit. Le merge automatique est risqué (hijack si email non vérifié).

### 1.12 A11y
- Mêmes exigences que sign-up :
  - `autocomplete="email"` / `"current-password"`
  - `aria-invalid` + `aria-describedby` pour errors
  - `role="alert"` ou `aria-live="polite"` pour success/error banners
  - Focus management sur error (focus 1er champ invalide)
- **Spécifique sign-in :**
  - `autocomplete="username"` sur email (pas `name` — important pour password managers).
  - `autocomplete="current-password"` sur password.

### 1.13 Redirect si déjà authentifié
- **Actuel :** aucun check. Un user connecté qui clique sur "/sign-in" voit la page normalement.
- **Exigence :** `getServerSession()` en tête → si session → `redirect(searchParams.callbackUrl ?? '/home')`.

### 1.14 Copy & visuel
- Sub "Sign in to your sales engine" : **trop promotional**. Exigence : "Sign in to your account" (plus neutre). Le wording "sales engine" est marketing landing, pas sign-in.
- Legal copy `text-[10px]` = 10px → **illisible, non-conforme WCAG**. Exigence : `text-[11px]` minimum (11px), mieux `text-xs` (12px). Contraste suffisant.
- `max-w-sm` (384px) trop étroit → `max-w-md` (448px).
- "Don't have an account?" : style OK. Mais sur mobile, le bloc est centré, parfois coupé. Exigence : tester viewport 360x640.
- Ajouter au-dessus du form un petit texte si pas de contexte : "Welcome back." (warm, humain, 1 ligne).

### 1.15 Analytics PostHog
- `signin_page_viewed` (has_error, error_type, has_callback)
- `signin_oauth_clicked` (provider)
- `signin_submitted` (method)
- `signin_completed` (user_id, method) — dans /home après redirect
- `signin_failed` (error_type, attempts_count)
- `forgot_password_clicked`
- `magic_link_requested` (si implémenté)

---

## 2. Comparaison concurrents

### 2.1 Lightfield
- Le flow `/signup` de Lightfield vu dans les captures = magic-link. Donc pour sign-in, c'est probablement identique : "Enter your work email" → inbox link.
- Pas de password = pas de forgot-password flow.
- **Différenciation :** Lightfield n'a pas besoin de reset password, car pas de password. Elevay avec password **doit** avoir reset.

### 2.2 Monaco
- Pas de capture sign-in disponible (demo-led, pas d'accès public).
- Probablement SSO enterprise-grade (SAML, Okta, Azure AD).

### 2.3 Standards B2B SaaS
- Auth0, Google, Notion, Linear, HubSpot : **tous** ont "Forgot password", 2FA optional, magic-link + password, lockout after failed attempts.
- Elevay retarde : **3 gaps critiques** (forgot password, error display, callback respect).

---

## 3. Gaps priorisés

| # | Gap | Criticité | Effort (h) | Bloquant pour ? |
|---|---|---|---|---|
| I1 | Lecture `searchParams` + affichage banners (success/error/info) | **CRITIQUE** | 3 | UX: currently zero feedback on errors |
| I2 | CallbackUrl respect + open-redirect validation | **CRITIQUE** | 2 | Invite flow, magic-link flow |
| I3 | Forgot password flow complet (page + endpoint + email + reset page) | **CRITIQUE** | 12 | Account recovery (currently impossible) |
| I4 | Redirect si déjà authentifié | **CRITIQUE** | 0.5 | Loop protection, UX |
| I5 | Error mapping → messages user-friendly | HAUTE | 2 | UX |
| I6 | Rate limiting per user + lockout 5 fails/15min | HAUTE | 4 | Brute-force protection |
| I7 | Loading states (useFormStatus) | HAUTE | 1.5 | Double-submit prevention |
| I8 | Autocomplete `username` / `current-password` | HAUTE | 0.5 | Password managers |
| I9 | Magic-link alternative (parité signup) | HAUTE | 4 | Reuse if S9 livré |
| I10 | PostHog events sign-in (7 events) | MOYENNE | 2 | Funnel analytics |
| I11 | Notif email "Password reset from IP X" | MOYENNE | 2 | Security trust |
| I12 | Copy refresh ("Welcome back" + legal 11px min) | MOYENNE | 1 | Polish |
| I13 | Widget largeur `max-w-md` | BASSE | 0.5 | Polish |
| I14 | OAuth provider-already-linked clear message | BASSE | 1 | Edge case UX |
| I15 | 2FA TOTP + backup codes (v2) | BASSE | 12 | Security v2 |
| I16 | Device detection + new-device email (v2) | BASSE | 8 | Security v2 |
| I17 | Inline errors générique "Invalid email or password" | BASSE | 1 | Already generic per NextAuth default |

**Total effort v1 (I1-I9) :** ~29h
**Total effort v2 (I10-I17) :** ~28h

---

## 4. Décisions à prendre

1. **Reset password TTL :** 1h (recommandé) vs 24h (plus permissif) ? — **1h** pour minimiser fenêtre d'attaque.
2. **Lockout strategy :** 5 fails/15min (agressif) vs 10 fails/30min (permissif) ? — **5/15min** standard.
3. **Magic-link aussi sur sign-in ?** — **oui** si magic-link adopté sur signup (cohérence). Else skip.
4. **"Remember me" visible ?** — **non** (simplifier).
5. **2FA v1 ou v2 ?** — **v2** (pas bloquant early-stage, ajouter quand enterprise deals).
6. **Email de notif "Password reset success" obligatoire ?** — **oui** (pattern Stripe/Vercel/Linear, low effort, high trust signal).

---

## 5. Prochaines actions concrètes

1. Martin : répond aux 6 décisions §4.
2. Implémenter I1 + I2 + I4 + I7 + I8 + I12 en un sprint (~8h) → gain énorme sur UX sign-in.
3. Implémenter I3 (forgot password flow complet) en un sprint dédié (~12h) — dépend de décision §4.1.
4. I5 + I6 en suivant.
5. I9 + I11 si S9 déjà livré (étape 2).
6. v2 : I15 + I16 quand cible enterprise.
