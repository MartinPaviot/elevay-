# Benchmark best-in-class — Enrichissement de contact (2026-06-06)

Méthode : 4 agents de recherche en parallèle (capability / provider / tech / design) + lecture
du code réel. Sortie scorée 4 axes, ancrée sur le code (file:line), sources primaires privilégiées.
Demande d'origine : "chaque feature au top du marché (feature / techno / provider / design)".

## État réel du code (vérifié)

- Cascade `Apollo(10) → Kaspr(20) → Lusha(30)`, geo-routée — `register-defaults.ts:9`,
  `deriveContactGeo` `types.ts:116` (phone CC puis TLD domaine).
- Waterfall séquentiel, stop-on-saturation (`mobilePhone && email && status!=unverified`) —
  `waterfall.ts:55`, boucle `waterfall.ts:126`.
- Confiance = **ordinale** `verified>likely>unverified` (`waterfall.ts:31`) ; merge scalaire =
  first-non-null (`waterfall.ts:90`). Pas de score numérique, pas d'ensemble.
- Phones : union + dédup `phoneKey` (`waterfall.ts:38`), best mobile/direct re-dérivé. Pas de
  classification mobile-vs-fixe par préfixe (dépend des labels provider).
- **Absents** : vérification email (syntax/MX/SMTP/catch-all), cache + TTL, boucle bounce→source,
  reorder appris. Suppression `email_optouts` existe mais **non gatée** dans ce chemin.
  Circuit-breaker `lib/infra/circuit-breaker.ts` existe mais **non câblé** aux adapters contact.
- Batch d'enrichissement : `enrich-contacts/route.ts` (20 max, rate-limité, tenant-scoped,
  écrit dans `contacts.properties`, embeddings). Anti-hallucination OK (`:150` marque "unavailable").

## Matrice 4 axes (score actuel → cible, /10)

### Capability — 4 → 9
Barre : Cognism (mobile vérifié par humain "Diamond Data", 45% vs 18% right-person pickup,
director refresh 30j, Diamonds-on-Demand <48h) · FullEnrich (vérifie que le numéro EST un mobile
avant de facturer, fixes flaggés gratuits) · Apollo (waterfall défaut depuis déc-2025, +5% email
/+7% phone /−45% bounce auto-déclaré ; auto-pause des envois "likely to bounce") · Clay
(provenance par champ + liste de candidats + remboursement crédit sur miss) · Surfe (monitoring
job-change post-enrichissement → auto-update + alerte).
Manque chez nous : vérif délivrabilité, typage mobile/fixe au retour, freshness/job-change,
feedback bounce→source, cache par champ.

### Technology — 4 → 9
Barre : orchestration **par field-class** (email = séquentiel cheapest-first stop-on-verified ;
phone FR/CH = leader-géo puis **parallel-race** car aucun vendeur ne gagne le mobile) ; confiance
**numérique** + ensemble noisy-OR `1−Π(1−cᵢ)` avec corroboration multi-source, override par la
vérif ; pipeline vérif syntax→MX→SMTP→**catch-all** (30-40% des domaines B2B sont catch-all, ×3-5
bounce) avec **tiers de risque** (valid / catch-all=ne pas auto-envoyer / invalid / unknown), fallback
consensus quand MX Google/Microsoft défait le probing ; **cache TTL par champ** (firmo 30-90j,
contact 7j, negative-cache 14-30j) + carry-forward (refill seulement le périmé) ; **feedback**
`provider_outcomes(provider,field,segment,outcome)` recalculé la nuit, value-per-dollar Beta-lissé,
**ε-greedy** ~5-10% ; `classifyPhone(e164)` déterministe (FR mobile = `+33 6/7` ; CH mobile =
`+41 7x`) écrasant les labels provider ; E.164 canonique au stockage.
Décision build-vs-buy : **garder le DIY orchestration, louer la longue traîne** — un agrégateur
(FullEnrich/BetterContact) comme **un nœud** tier-2 email, pas tout le système ; phone reste DIY
(10 crédits/mobile non rentable pour un produit d'appel) ; firmo reste DIY (SIRENE/Zefix).

### Provider — 3 → 9
Cascade recommandée FR/CH-romand :
`recherche-entreprises.api.gouv.fr (SIRENE, gratuit) + Zefix/LINDAS (CH, gratuit)`
→ `Dropcontact` (email FR + SIREN/NAF/TVA, **no-DB → RGPD structurel**, catch-all 85-90%)
→ `FullEnrich` ou `BetterContact` (waterfall 15-20 providers, **facturé au succès**, email 1 cr)
→ `Cognism` (mobile FR vérifié + **DNC 15 pays dont France**, scalpel pour comptes ICP-core)
→ `Hunter.io` (gate délivrabilité avant envoi).
À ÉVITER en source nommée : **Kaspr** (CNIL €240k, voir flag) ; **Apollo comme primaire FR/RGPD**
(architecture US legitimate-interest, DNC UK+US only, EU le moins frais, mobile cher) — OK comme
nœud dans l'agrégateur. PDL/LeadMagic : résidence EU non documentée.
Base firmo gratuite et autoritative : SIRENE (FR) + Zefix (CH) — ne jamais payer pour l'identité.

### Design — non scoré ce tour (UI pas lue ; ne pas scorer de mémoire)
Barre : per-field **diff old→new** + ✓/✕ par champ + "Approve N" + défaut **"Suggest"** + dial
Auto/Suggest/Off par champ (Lightfield, le meilleur HITL observé en first-hand) ; cellule **lilas +
sparkle** dans le header = provenance ambiante, jamais d'écrasement d'une valeur saisie main (Attio) ;
confiance en **tiers nommés liés à l'action** (Apollo: Verified / Likely to engage / Needs verification
/ User Managed) + **un badge binaire** pour le champ le plus à enjeu (Cognism diamond sur le mobile) ;
provenance détaillée à 1 clic (Clay) ; **4 états non-happy distincts** (not-run / running / found-nothing /
low-confidence) — low-confidence en file de revue, jamais écrit ni jeté en silence (Folk) ; "not found"
= résultat énoncé + action suivante, zéro hallucination (Lightfield) ; freshness "updated N days ago" +
re-enrich au survol + segment "due for refresh" 30-90j ; **preview coverage avant bulk** (HubSpot
data-test) + test-on-N-rows (Clay).

## Flags niveau "océan"

1. KASPR = TÊTE DE CASCADE FR + SANCTION CNIL. `register-defaults.ts` boost Kaspr en geoAffinity FR
   (premier sur `+33`). Kaspr condamné €240k, **CNIL SAN-2024-020** (public janv-2025, conformité
   18-juin-2025) pour scraping de profils LinkedIn restreints, sur-rétention 5 ans, info tardive/EN.
   Régulateur du produit = CNIL → risque n°1. Remplacer comme source nommée par Dropcontact +
   Cognism ; Kaspr seulement via agrégateur garantissant la conformité.
2. LOI FR 11-AOÛT-2026 : appel commercial vers un MOBILE = consentement préalable ; lignes PRO
   restent ouvertes. Les direct-dials de dirigeants FR sont massivement des mobiles `+33 6/7` →
   contraint le cold-call mobile ~2 mois après le 2026-06-06. À confirmer juridiquement (sources
   secondaires Lexology/Bird&Bird). Qualifie le stack voice-cold-call (Apollo→Kaspr→Lusha).
   Note connexe : MAN depuis oct-2024 bloque les numéros FR non authentifiés à l'opérateur.

## Plan d'élévation, trié par levier

1. Gate de vérification email (syntax+MX maison, SMTP+catch-all via vendeur), tiers de risque,
   gate d'auto-envoi. → bounce 3-5% → <1%. Net-new `lib/enrichment/verify/`. **Plus haut levier.**
2. Spine FR/RGPD : Dropcontact tier-1 + SIRENE/Zefix dans le merge firmo + sortir Kaspr de la
   source nommée. `register-defaults.ts`, `waterfall.ts:mergeInto` (per-field source priority).
3. Cache TTL par champ + carry-forward (refill seulement le périmé). −40-60% crédits. FUSE-GAP-1.
4. Suppression en gate PRÉ-enrichissement (avant 1 crédit), identité-level (email/phone E.164/LI).
   `waterfall.ts` + extension `email_optouts`.
5. Boucle feedback : provenance → `provider_outcomes` ← webhooks bounce/reply/connect → reorder
   nocturne par segment + ε-greedy. Webhooks Resend/voice existent ; le join-back est neuf.
6. Split field-class (email séquentiel / phone parallel-race) + confiance numérique +
   `classifyPhone(e164)` par préfixe écrasant les labels. `waterfall.ts`, `types.ts`.
7. Un nœud agrégateur (FullEnrich/BetterContact) en tier-2 email = 15+ providers pour ~½ j.
   Phone reste DIY.

Items 1 et 3 = plus haut levier net-new (bounce + coût). 2/4/6 = jours (infra existe).

## Fichiers clés
`lib/providers/contact-enrichment/{waterfall,types,register-defaults,registry}.ts`,
`*-adapter.ts`, `app/api/enrich-contacts/route.ts`, `lib/infra/circuit-breaker.ts`,
`db/schema/outbound.ts` (`email_optouts`), `api/webhooks/resend/route.ts`,
`lib/integrations/{recherche-entreprises-client,zefix-client,zeliq-client}.ts`,
spec antérieure `_specs/FUSE-GAP-1-person-email-waterfall/`.

## Confiance / réserves
- Chiffres de couverture/accuracy = claims vendeurs sauf mention "benchmark indépendant".
- Pricing Dropcontact incohérent selon sources (€24/1k vs €79/500) — vérifier in-app.
- Résidence EU documentée seulement pour les vendeurs EU-natifs ; non vérifiée Apollo/PDL/LeadMagic.
- Loi 11-août-2026 et statut Bloctel B2B = sources secondaires juridiques → confirmer avec un avocat.
- Design : axe non scoré (UI d'enrichissement pas lue ce tour).
