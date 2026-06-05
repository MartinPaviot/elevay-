# Audit expert — flow GTM autonome vs mission · points de blocage (2026-06-04)

État vérifié en live cette session (pas de doc périmé). Classes de blocage :
**[CRED]** identifiant/compte que seul Martin fournit · **[DEPLOY]** mise en
prod/infra · **[CODE]** chantier code · **[DECISION]** choix produit ·
**[DATA]** la donnée réelle manque (flow à vide) · **[STRUCT]** limite
structurelle d'une source.

---

## 1. La mission (rappel)

Moteur GTM autonome = **Monaco** (TAM auto-construit, scoring ML, priorisation
par signaux, séquences outbound IA, coaching deal, BI proactive) **+ Lightfield**
(zéro saisie, capture auto de *chaque* interaction email/meeting/call, mémoire
schemaless, requêtes NL citées, recall 95%+, approbation humaine). Chat-first,
founder-led, autonome.

## 2. Le flow cible (le flywheel)

`Cible (TAM)` → `Scoring/priorisation` → `Enrichissement (email+mobile+signaux)`
→ `Outbound (voix / email / LinkedIn)` → `Capture auto` → `Mémoire/Intelligence`
→ `Réutilisation` → (boucle : les interactions ré-alimentent scoring + mémoire).

Le flywheel ne tourne que si **chaque** maillon laisse passer de la donnée
réelle au suivant. Aujourd'hui deux maillons sont coupés (Outbound prod + Capture)
→ toute la moitié aval (Intelligence) tourne à vide.

---

## 3. Audit par étape

### Étape 1 — Cible / TAM
- **Vérifié OK** : SIRENE FR keyless (1000 comptes propres chargés), Zefix/LINDAS
  CH keyless (classifieur secteur 13 tests verts, dry-run GE+VD 174→60), Apollo.
  Couche identité propre (SIREN/UID), dédup par clé canonique.
- **Blocage** : le TAM n'est pas *auto-construit en continu* — le sourcing est
  déclenché par script, pas de cron de refresh, ~1000/1215 (pagination gouv).
  La mission veut un TAM qui se (re)construit seul. **[CODE]** moyen.

### Étape 2 — Scoring / priorisation
- **Vérifié OK** : criteria-engine, recompute (3402 cellules calculées).
- **Blocage CRITIQUE (perception)** : fit *signal-lourd* → **848/1000 scorés mais
  0 ≥ 0.5**. Une base propre et ciblée s'affiche « non-fit ». Fit à 2 niveaux pas
  construit. **[CODE]** ½ journée — le chantier gratuit le plus rentable.
- **Blocage mission** : le scoring est à base de règles, pas *appris* (la mission
  dit « ML scoring »). Le modèle appris exige des **issues réelles** (flywheel) →
  dépend de la capture + des appels. **[DATA]**

### Étape 3 — Enrichissement
- **Vérifié OK (live)** : **Lusha validé** — email vérifié (A+) + mobile sur un
  vrai prospect ICP (eig.fr). Bug d'unwrap corrigé. Cascade Apollo→Kaspr→Lusha
  géo-routée. 412 décideurs (dirigeants gouv, gratuit).
- **Blocage** : seule la clé Lusha est posée (Kaspr/Zeliq optionnels) ;
  enrichissement *à la demande*, pas auto sur les nouveaux comptes TAM ; coût par
  reveal. **[CRED]** léger + **[CODE]** (job d'enrichissement auto).

### Étape 4 — Signal → accroche
- **Vérifié OK** : signal-opener génère une accroche depuis un signal (funding).
- **Blocage** : templates en **anglais** → copie **franglais** pour prospects
  FR/CH (vérifié en live). Pas de **flux de signaux** réellement câblé (les
  signaux ont besoin de sources/triggers). **[CODE]** (localisation FR) +
  **[CODE/DATA]** (sources de signaux).

### Étape 5 — Outbound : VOIX (effort en cours)
- **Vérifié OK (local)** : stack Twilio/Deepgram complète ; **5 vars Twilio +
  Deepgram valides** ; `isVoiceConfigured()=true` en local ; token WebRTC signé ;
  TwiML App « Elevay Voice » créée avec les 3 URLs ; **numéro enregistré dans le
  pool** (tenant 47dca783). Route fallback + fix middleware **commités** (main
  8456a24e ; ch-fr pour le reste).
- **Blocage DUR (actuel)** : **la prod n'est pas déployée/configurée**.
  `elevay.dev/api/calls/twiml` renvoie encore `/sign-in` 12 min après le push →
  build échoué OU `main` n'est pas la *Production Branch*. **[DEPLOY]**
  - Vars Twilio+Deepgram **absentes de l'env Vercel** (local seulement) → prod
    503. **[CRED/DEPLOY]**
  - **Bridge live** (`VOICE_STREAM_PUBLIC_URL`) pas hébergé → pas de transcript
    temps réel (l'appel se place quand même). **[DEPLOY]**
  - Numéro **US (+1 802)**, pas FR/CH → mauvais taux de décroché ; un +33/+41
    exige un *regulatory bundle* Twilio (justif. d'adresse, non instantané).
    **[CRED/STRUCT]**

### Étape 5bis — Outbound : email / LinkedIn
- **OK (existant)** : infra d'envoi (mailboxes, warmup, sending-infrastructure),
  séquences/dispatch.
- **Blocage** : email réel exige **Outlook connecté** (cf. étape 6). **LinkedIn**
  = plan Unipile **non construit**. **[CRED]** + **[CODE]**.

### Étape 6 — Capture (cœur Lightfield : zéro saisie)
- **OK (code + tests)** : chemins capture email/meeting/call + gate d'approbation
  (auto/review) construits et testés.
- **Blocage LE PLUS CRITIQUE pour la mission** : **la capture est ÉTEINTE** —
  Outlook **pas connecté** (OAuth Microsoft, intégration câblée et app Entra
  prête). Sans ça : **zéro interaction capturée** → toute la moitié Lightfield
  (zéro-saisie, mémoire, requêtes citées, recall, flywheel) est **dark**.
  **[CRED]** — 5 min, gratuit, seul Martin peut (OAuth réel). **C'est le verrou
  à plus fort levier et le moins cher du projet.**

### Étape 7 — Mémoire / Intelligence
- **OK (existant)** : workers post-call, deal-intel, crons world-model (vercel.json),
  RAG, mémoire.
- **Blocage** : tourne **à vide** — pas d'appels, pas d'emails captés → coaching,
  mémoire, citations, recall 95% **n'ont rien à traiter** et **ne sont pas
  validables**. **[DATA]** — se débloque dès que 5+6 laissent passer du réel.
- **À vérifier** : les **workers Inngest** (post-call, scoring) tournent-ils en
  prod ? (crons Vercel ≠ workers événementiels Inngest.) **[DEPLOY]**

### Étape 8 — Human-in-the-loop
- **OK** : mode d'approbation capture (auto/review) construit ; principe « l'AE
  reste humain » respecté. Pas de blocage majeur — attend juste que la capture
  coule.

---

## 4. Blocages transverses

- **[DEPLOY] Déploiement prod = le mur actuel.** elevay.dev sert encore l'ancien
  code. Causes possibles (à confirmer côté Vercel) : build en échec, ou
  Production Branch ≠ `main`. Tant que ce n'est pas réglé, *aucun* fix poussé
  n'atteint elevay.dev.
- **[CRED] Identifiants détenus par Martin** : OAuth Outlook (capture — levier
  n°1), accès env Vercel, host bridge, numéro FR/CH (bundle réglementaire),
  Kaspr/Zeliq optionnels.
- **[DECISION] Sprawl de tenants** : données dans **47dca783** (1701 sociétés,
  519 contacts) ; or `martin.paviot@outlook.com` → tenant **0addac77** (vide) ;
  `martin@elevay.dev` → 47dca783. **Quel tenant est la prod ?** Décision +
  consolidation nécessaires (sinon tu te connectes sur un workspace vide).
- **[DATA] Flow à vide** : toute l'intelligence/flywheel ne se prouve qu'après
  capture + premiers appels réels.

---

## 5. Verdict mission

- **Moitié Monaco** (TAM, scoring, signaux, outbound) : **construite mais
  partiellement éteinte** — perception du scoring (fit), voix pas en prod, email
  suspendu à Outlook.
- **Moitié Lightfield** (capture, mémoire, NL+citations, recall) : **construite
  mais 100% DARK** car la **capture n'est pas connectée**. C'est le plus gros
  écart vs la mission — *et le moins cher à combler* (OAuth Outlook).
- **Le flywheel** (scoring qui s'améliore via les issues) **ne peut pas démarrer**
  tant que des interactions réelles ne circulent pas.

## 6. Chemin critique (par levier, du plus rentable au moins)

1. **[CRED, 5 min, gratuit] Connecter Outlook** → allume toute la capture +
   l'email outbound + démarre le flywheel. *Plus gros levier du projet.*
2. **[DECISION] Choisir/consolider le tenant prod** (les contacts sont dans
   47dca783) — sinon capture + appels atterrissent au mauvais endroit.
3. **[DEPLOY] Débloquer le déploiement elevay.dev** (Production Branch + vars
   Vercel + workers Inngest) → met la voix et le code récent en prod.
4. **[CODE, ½ j, gratuit] Fit à 2 niveaux** → la base propre cesse d'être
   « non-fit » (perception + priorisation utilisables).
5. **[CODE, gratuit] Localiser l'accroche FR** (templates).
6. **[DEPLOY] Héberger le bridge** + **[CRED] numéro FR/CH** → appel complet avec
   transcript live.
7. **[DATA] 5 vrais appels + emails captés** → l'intelligence/flywheel se prouve.

## 7. Répartition

**En mon pouvoir (sans Martin)** : fit 2 niveaux, localisation accroche FR, job
d'enrichissement auto, refresh TAM, dédup pipeline, client Cognism, finalisation
contacts, correction d'un build prod si erreur fournie.

**Seulement Martin (frontières d'identité/budget/infra)** : OAuth Outlook,
accès/vars Vercel, branche de prod, host bridge, numéro FR/CH, décision tenant,
achat des clés payantes optionnelles.

> En une phrase : le **code est à ~85%** ; les blocages dominants sont **(1) la
> capture éteinte (Outlook, 5 min)** qui laisse toute la moitié Lightfield dark,
> et **(2) le déploiement prod** (Vercel) qui empêche la voix d'exister en ligne.
> Les deux sont côté Martin. Le reste (fit 2-niveaux, localisation, flywheel) se
> débloque ensuite.
