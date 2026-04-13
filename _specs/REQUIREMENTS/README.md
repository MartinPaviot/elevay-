# Exigences par étape — Parcours utilisateur LeadSens/Elevay

**Date :** 2026-04-13
**Auteur :** Session Claude Code sous supervision Martin, méthode Kiro.
**Objectif :** pour chaque étape du parcours utilisateur, documenter :
1. État actuel vérifié par lecture du code (pas de specs anciennes).
2. Exigences pixel-level (UX, perf, A11y, analytics).
3. Comparaison aux concurrents Monaco (demo-led) et Lightfield (product-led).
4. Gaps priorisés avec estimates.
5. Décisions produit ouvertes.

---

## Index

| # | Étape | Fichier | Gaps CRITIQUES |
|---|---|---|---|
| 1 | Landing / Marketing | [01-landing.md](./01-landing.md) | L1 screenshots produit · L2 social proof · L3 pricing section · L4 og:image |
| 2 | Sign Up | [02-signup.md](./02-signup.md) | S1 auto-login post-signup · S2 email verification · S3 redirect si auth · S4 legal copy |
| 3 | Sign In | [03-signin.md](./03-signin.md) | I1 lecture searchParams · I2 callbackUrl respect · I3 forgot password flow · I4 redirect si auth |
| 4 | Onboarding (7 steps) | [04-onboarding.md](./04-onboarding.md) | O1 fix needsOnboarding · O2 persister currentStep · O3 retry building · O4 score await · O5 connect callbackUrl |
| 5 | Dashboard Home | [05-dashboard-home.md](./05-dashboard-home.md) | H1 hydrate consolidé · H2 challenge label mismatch · H3 progressive reveal empty |
| 6 | Chat | [06-chat.md](./06-chat.md) | C1 silent catch approveCard · C2 !res.ok handling · C3 SPA campaign redirect |
| 7 | Accounts (TAM) | [07-accounts.md](./07-accounts.md) | A1 server-side pagination · A2 bulk cap 20 bug · A3 selectedRows actions |
| 8 | Contacts + SmartImport | [08-contacts.md](./08-contacts.md) | K1 pagination · K2 bulk actions · K3 merge duplicates UI |
| 9 | Sequences (outbound) | [09-sequences.md](./09-sequences.md) | Q1 analytics dashboard · Q2 post-launch edit |
| 10 | Meetings | [10-meetings.md](./10-meetings.md) | M1 edit notes · M2 auto-send follow-up · M3 MS Calendar exposé |
| 11 | Opportunities | [11-opportunities.md](./11-opportunities.md) | Y1 timeline narrative · Y2 health score · Y3 auto-progression |
| 12 | Settings (18 sous-pages) | [12-settings.md](./12-settings.md) | N1 GDPR export/delete · N2 profile security |
| 13 | Erreurs & edge cases | [13-errors-edge-cases.md](./13-errors-edge-cases.md) | E1 Sentry · E2 session UX · E3 error boundaries · E4 chat silent catch · E5 destructive confirms |

---

## Méta — totaux d'effort

| Priorité | Count | Effort cumulé estimé |
|---|---|---|
| **CRITIQUE** | 23 items | ~140h |
| HAUTE | 76 items | ~480h |
| MOYENNE | 78 items | ~350h |
| BASSE | 41 items | ~230h |
| **Total v1 (Critique + Haute)** | 99 items | ~620h |
| **Total v2 (Moyenne + Basse)** | 119 items | ~580h |

---

## Décisions produit ouvertes (cumulées)

70+ décisions identifiées à travers les 13 docs. Sélection des plus structurantes :

### Auth & onboarding
1. **Magic-link alternative au password ?** (étapes 2, 3)
2. **Email verification : hard gate ou soft gate ?** (étape 2)
3. **2FA v1 ou v2 ?** (étape 3)
4. **Onboarding skip per step autorisé ?** (étape 4)

### Produit — navigation et UX
5. **Tabs "Just me" / "My team" v1 ou v2 ?** (étape 5)
6. **Focus mode setting ?** (étape 5)
7. **Citations inline [1][2] dans chat dès v1 ?** (étape 6)
8. **"Up next" minimaliste (Lightfield) ou dense (actuel) ?** (étape 5)

### Pipeline & GTM
9. **Physical gift step type : Sendoso ou manuel v1 ?** (étape 9)
10. **Timeline narrative auto/manual mix ?** (étape 11)
11. **Deal health score visible ou caché ?** (étape 11)
12. **Auto-progression stages : suggest ou auto-apply ?** (étapes 10, 11)

### Data & sécurité
13. **Bulk queue Inngest ou warn cap 20 ?** (étape 7)
14. **GDPR export format JSON/CSV ?** (étape 12)
15. **Error tracker Sentry vs Datadog ?** (étape 13)
16. **Destructive confirmation : scope ?** (étape 13)

### Business
17. **Pricing public v1 ?** (étape 1)
18. **Self-serve vs demo-led GTM ?** (étape 1)
19. **i18n FR + EN ou EN only ?** (étapes 1, 5)

---

## Patterns transversaux identifiés

Récurrents sur 3+ étapes → à traiter comme des foundations :

1. **Server-side pagination + virtualisation** (étapes 7, 8, 9, 11) — critique pour scale.
2. **Bulk actions selectedRows** (étapes 7, 8, 9, 11) — pattern cohérent à définir.
3. **Filter builder réutilisable** (étapes 7, 8, 11) — composant partagé.
4. **Column customization (Display panel)** (étapes 7, 8, 11) — préférences par-user.
5. **Import/Export top-right** (étapes 7, 8, 11) — Lightfield parity.
6. **Inline edit + undo toast 10s** (étapes 7, 8, 10, 11, 13).
7. **Empty states progressive** (étapes 5, 10, 13) — au lieu de blank screens.
8. **Optimistic updates + rollback** (étapes 5, 11, 13).
9. **Keyboard shortcuts** (étapes 5, 7, 8, 9, 10, 11, 12).
10. **PostHog events** (toutes étapes) — funnel tracking systématique.
11. **A11y landmarks + aria-live + focus management** (toutes étapes).
12. **Mobile responsive** (toutes étapes).
13. **Sentry integration** (étape 13, impact toutes étapes).

**Recommandation :** avant d'implémenter les gaps par étape, construire ces **13 foundations partagées** pour éviter la duplication.

---

## Bugs critiques toujours présents (non résolus par BUGFIX-série)

À corriger d'urgence (total effort ~3h cumulés) :

1. **Étape 4 O1** : `needsOnboarding = !onboardingCompleted && isNew` — bug P7 audit-02, toujours là.
2. **Étape 4 O2** : `currentStep` non persisté — bug P6 audit-02.
3. **Étape 5 H2** : challenge label mismatch home ↔ wizard ("Finding leads" vs "Finding the right leads").
4. **Étape 6 C1** : silent catch `approveCard` ligne 458-459 — raté par BUGFIX-06.
5. **Étape 7 A2** : bulk actions serveur cap 20 silencieux — bug produit majeur.
6. **Étape 7 A11** : badge "Suggested" affiché à tous les contacts expanded.
7. **Étape 1 footer** : Twitter link `https://x.com` générique au lieu du compte Elevay.

---

## Absence de password reset (PWD RESET MISSING)

Étape 3 I3 — zéro code dans le repo pour forgot/reset password.
**Impact :** tout utilisateur email/pwd qui oublie son mot de passe est **définitivement bloqué**.
**Effort :** ~12h (page forgot + page reset + endpoint + email template + tests).
**Priorité absolue P0.**

---

## Fresh Lightfield access

**Le trial Lightfield expirait 2026-04-13.** Si encore accessible :
- Screenshots restants à capturer : deliverability, opportunity detail complet, sequences (Lightfield en a-t-il ?), search/filter panels.
- Le dossier `_research/teardown-lightfield/screenshots/` sous-dossier peut contenir plus d'images non consultées.

---

## Prochaines étapes suggérées pour Martin

### Path 1 : décisions produit (~60 min)
Répondre aux ~70 décisions ouvertes dans les 13 docs → unlock le roadmap.

### Path 2 : quick wins (~10h)
Fix les 7 bugs critiques listés ci-dessus.

### Path 3 : foundations (~80h)
Implémenter les 13 patterns transversaux avant les features par étape.

### Path 4 : vertical par étape
Choisir 1 étape critique (ex: Onboarding O1-O12 ~47h, ou Opportunities Y1-Y11 ~81h) et livrer end-to-end.

### Path 5 : password reset (~12h)
Priorité P0 absolue, à faire avant n'importe quel ship en prod avec users externes.
