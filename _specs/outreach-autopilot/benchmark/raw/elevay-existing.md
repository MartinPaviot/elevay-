# Capability map brownfield — Elevay (origin/main)

Date : 2026-07-02 (modules 1-2 audités le 01-07, 3-13 le 02-07 — même ref auditée)
Ref auditée : `origin/main` = `797319707df2f6afc7e550c387555f25235a03a6`
Méthode : `git grep <pattern> origin/main` + `git show origin/main:<path>` — aucune citation de mémoire ; chaque file:line vérifié sur la ref.
Cible du benchmark : outreach multicanal autopilote (email + LinkedIn semi-auto + gifting), cap 100 emails/jour/compte non contournable, quality gates bloquants, boucle de self-improvement.

Tous les chemins ci-dessous sont relatifs à `app/apps/web/src/` sauf mention contraire.

---

## 1. Ingestion TAM & enrichissement — VERDICT : EXISTE

**Preuves (origin/main) :**
- Import : `lib/import/agentic-executor.ts`, `lib/import/dedup.ts`, `lib/import/relationship-wirer.ts` (arbre `lib/import/`).
- Dedup canonique : module dédié `lib/dedup/` (`contacts.ts`, `group.ts`, `merge.ts`, `run.ts`, `similarity.ts`) — spec 07.
- Enrichissement waterfall par champ + cache TTL : `lib/enrichment/field/waterfall.ts`, `lib/enrichment/field/cache.ts`, `lib/enrichment/field/ttl.ts` (spec 08).
- Vérification email (spec 17) : `lib/contacts/email/verify-email.ts:2` (« email verification waterfall (contact scope) »), `lib/contacts/email/mx-verify-provider.ts:3-6` — vérif **MX/DNS au niveau domaine uniquement** ; le commentaire dit explicitement que le vérifieur mailbox-level payant (« ZeroBounce/Hunter/… ») est « slotted in behind the same interface » mais **absent**. `lib/contacts/email/persist-verification.ts:11` : « leaving valid-domain mailboxes untouched until a paid verifier lands ».
- Définition ICP : `lib/icp/` complet — store versionné (`lib/icp/store/db-store.ts`, `store/version.ts`, spec 11), NL→ICP (`lib/icp/nl/nl-to-icp.ts`), lookalike (`lib/icp/lookalike/derive.ts`, spec 12), ICP→TAM (`lib/icp/icp-to-tam.ts`), traduction vers sources (`to-apollo-params.ts`, `to-pappers-params.ts`, `to-sirene-params.ts`).
- TAM : `lib/tam/persist-tam.ts`, `lib/tam/candidate.ts` + cron `inngest/tam-refresh-cron.ts` ; sourcing Apollo/registres `lib/sourcing/`, LinkedIn Sales-Nav `lib/campaign-engine/sources/linkedin.ts` + `inngest/icp-source.ts`.

**Gap principal vs exigence cible :** la vérification email s'arrête au domaine (syntaxe + jetable + MX) — pas de vérifieur mailbox-level (ZeroBounce/NeverBounce) branché ; le gate pré-envoi (`lib/guardrails/sending-gate.ts:281-292`, spec 17) ne bloque que le statut `invalid` connu, les adresses non vérifiées/risky/catch-all passent. Pour un autopilot 100 emails/jour/compte, le taux de bounce ne serait contenu que par le guard réactif, pas par une vérification proactive complète.

---

## 2. Moteur de signaux — VERDICT : EXISTE

**Preuves (origin/main) :**
- Écriture normalisée : `lib/signals/record-signal.ts:94` `recordCompanySignal()` (upsert par type dans `companies.properties.signals[]`, `record-signal.ts:40-42` type + `detectedAt` qui « drives freshness decay »).
- Sources multiples : cron monitor `inngest/signal-monitor.ts:37` (cron `0 */4 * * *`, toutes les 4 h) ; signaux d'engagement `lib/signals/engagement-signal.ts:54` + listener `inngest/engagement-signal.ts:62` ; hiring via jobs LinkedIn `lib/linkedin/jobs-posts-sourcing.ts:163` ; warm-graph `lib/sending/linkedin/graph-sync.ts:90` ; skill funding `skills/signals/funding-signal-monitor/handler.ts:92` ; détecteur temps réel `lib/signals/real-time-detector.ts` ; signaux custom `lib/custom-signals/` + `inngest/custom-signal-backfill.ts`.
- Scoring planifié : `inngest/signal-score-daily.ts:106` (cron `0 6 * * *`) recalcule `companies.priority_score = bestSignalMultiplier × fit_modulator × accessibility_modulator` (en-tête :1-33, signal-dominant) ; `bestMultiplierForCompany()` :75-95.
- Décroissance temporelle : `lib/signals/freshness.ts:31` `SIGNAL_TTL_DAYS` (TTL par type, `DEFAULT_SIGNAL_TTL_DAYS = 90` :81) ; appliquée dans le scorer quotidien `inngest/signal-score-daily.ts:87-90` (`isSignalFresh` → un signal périmé ne lifte plus) ; TTL miroir côté détecteurs `lib/scoring/signal-detectors.ts:49`.
- Multiplicateurs appris par outcome : `lib/scoring/signal-outcomes.ts:298` `getSignalMultipliers()` (priors :67, apprentissage ≥ `MIN_SAMPLE_SIZE = 10` :35, clamp).

**Gap principal :** décroissance en marche d'escalier (TTL binaire frais/périmé), pas de decay continu ; les signaux vivent dans un JSONB `properties.signals[]` (pas de table `signals` normalisée — ≥6 taxonomies partiellement réconciliées par alias, cf. `lib/scoring/signal-outcomes.ts:105-148` qui documente le mismatch de clés) ; et le refresh 4 h ne couvre que les détecteurs câblés (funding/hiring/engagement), pas un catalogue extensible de sources externes.

---

## 3. Moteur de décision IA — VERDICT : PARTIEL

**Preuves (origin/main) :**
- Boucle autopilot quotidienne « Monaco loop » : `lib/autopilot/run.ts:1-13` — budget warmup-aware → candidats signal-ranked → sélection ≤ budget (exclut enrolled/suppressed) → par prospect : refresh signaux + copy groundée → enroll (auto) ou draft (HITL) ; « Every send still passes evaluateSend at transport ».
- Choix de séquence par prospect : `lib/autopilot/sequence-router.ts:1-14` — « Monaco's moat is SELECTION: a different sequence per why-now » ; route par ICP (`pickIcpScopedSequence`) puis trigger-signal (`pickSequenceForSignal`), fallback déterministe.
- Copy groundée par signal : `lib/autopilot/prepare.ts:1-16` — `buildIntelligenceBrief` (cache 14 j) + `generateCopyMessage` avec « never-invent floor (segment fallback when no groundable evidence) ».
- Décision événementielle : `lib/agent-reactor/decision-prompt.ts:20-33` — moteur de décision LLM sur 12 triggers (reply, bounce, signal, meeting…), règles explicites (« Match action intensity to signal strength: a funding round may justify outreach, a single email open does not »), sortie JSON stricte actions+reasoning+confidence.
- Contexte appris injecté dans les appels : `lib/ai/traced-ai.ts:90` (« Apply the flywheel's learned artifacts »), :104-108 (playbook appris pour les agents outbound-drafting), :185 et :308 (learned prompt + few-shots + playbook).

**Gap principal :** le TIMING n'est pas une décision IA — fenêtres d'envoi statiques par mailbox (`inngest/email-send-worker.ts:253-254`, défauts 08:00-18:00 + sendDays/timezone), pas d'optimisation du moment par prospect. Le CANAL n'est pas choisi par prospect non plus : le mix canal vient du template de séquence (`lib/sequences/templates/types.ts:30`), pas d'un arbitrage IA email-vs-LinkedIn par contact. L'angle de personnalisation est grounded mais pas explicitement sélectionné parmi des angles concurrents avec trace de la décision.

---

## 4. Séquenceur & orchestration — VERDICT : EXISTE

**Preuves (origin/main) :**
- Arrêts automatiques centralisés : `lib/sequences/enrollment.ts:5-28` — `pauseEnrollment(reason)` avec raisons `replied | bounced | complained | unsubscribed | manual | deal_won`, idempotent, statut + activité d'audit.
- Multi-canal dans les steps : `lib/sequences/templates/types.ts:30` — `TemplateStepType = "email" | "linkedin_message" | "phone_task"` ; 9 templates trigger-specific multi-canal (`lib/sequences/templates/catalog.ts:42,97,131…`).
- Adaptation de cadence par signal : `inngest/signal-accelerate-cadence.ts` (accélération sur signal) ; recyclage nurture : `lib/sequences/nurture-recycle.ts` + `inngest/nurture-recycle-d30.ts` (re-entrée après terminal — l'index unique partiel `(sequence_id,contact_id) WHERE status='active'` préserve la ré-inscription).
- Dispatch par canal avec adaptateurs enregistrés : `lib/sequence-dispatch/` (email, linkedin_message, phone_task — test `dispatch.test.ts:52`).
- Éligibilité d'enrollment : `lib/sequences/enrollment-eligibility.ts`, dédup d'enrollment sur les 12 sites d'insertion.

**Gap principal :** pas de branchements conditionnels riches dans les séquences (pas de « si ouvert mais pas répondu → variante B ») — la structure est linéaire steps+delays ; les réactions conditionnelles vivent hors séquence dans l'agent-reactor.

---

## 5. Délivrabilité & quotas — VERDICT : PARTIEL (le gap le plus matériel vs la cible)

**Ce qui existe (vérifié) :**
- **Gate d'envoi unique multi-chokepoint** : `lib/guardrails/sending-gate.ts:214` (`evaluateSend`), câblé aux 5 chokepoints (campaign cron, single-send, SMTP cron, composer interactif, meeting follow-up — en-tête :10-16). Doctrine **FAIL-CLOSED** (:17-18 + catch final).
- **Ordre des checks** (:214-365) : rate limit tenant burst **60/min** + hourly **600/h** (`lib/infra/rate-limit.ts:104-109` ; commentaire :92-103 « a SAFETY NET…, NOT a product volume policy ») → opt-out → suppression élargie spec 22+35 (domaine+compte+typée+globale) → vérif email spec 17 (bloque `invalid` seulement) → lawful basis spec 33 (flag OFF) → deliverability guard spec 27 → SAFE_MODE targeting (flag OFF) → sending identity.
- **Caps quotidiens existants — deux couches** :
  1. `sendingDailyCapPrimary` défaut **20/jour** (`lib/config/tenant-settings.ts:531`) appliqué SEULEMENT en mode `primary-with-caps` (`lib/guardrails/sending-identity.ts:95-107`) ; cold-on-primary bloqué par défaut (tenant-settings.ts:532).
  2. Cap par mailbox `daily_limit` défaut **50** (`db/schema/outbound.ts:367`), effectif warmup/bounce-aware via `getEffectiveDailyLimit` (`inngest/email-send-worker.ts:36`), enforcement worker `:384` (`sentToday >= dailyLimit` → skip) + round-robin sur la capacité restante (:264-282) + fenêtres d'envoi/sendDays/timezone (:222,253-254).
- **Warmup** : rampe 4 semaines 2→50/jour (`lib/campaign-engine/deliverability/warmup.ts:7-37`) ; déclenchement opérateur admin uniquement (console ADMIN_SECRET, arc #392-399) ; capacité autopilot warmup-aware `lib/autopilot/capacity-source.ts` (statuts `warming_up|active` :51).
- **SPF/DKIM/DMARC** : vérif DNS réelle `lib/sending/identity/auth.ts` + `dns-auth-lookup.ts`, consommée par `dnsAwareAuthResolver` (capacity-source.ts, flag `MANAGED_DOMAIN_DNS_VERIFY`) ; domaine smtp_custom non vérifié = non sendable (capacity-source.ts:30-36) ; endpoint `app/api/deliverability/verify/route.ts` + page `(dashboard)/deliverability/page.tsx`.
- **Monitoring bounce/spam** : seuils 2026 `lib/deliverability/thresholds.ts:25-36` (bounce pause 5%/warn 3% ; spam 0,3% Google / 0,1% Microsoft ; min 20 envois ; cool-off 24 h ; reprise 25%) + cron `inngest/deliverability-monitor.ts` + auto-pause tenant dans evaluateSend (`guardTrippedForTenant`).

**Gap principal vs cible (« cap 100/jour/compte utilisateur NON contournable ») — ça n'existe pas :**
- Le cap 20/j ne couvre que `primary-with-caps` ; en `external-connected` : « cold + volume aren't gated here — they're the provider's concern » (sending-identity.ts:115-124) ; en `elevay-managed-active` : allowed inconditionnel.
- Le cap mailbox 50/j est une **colonne DB configurable** (`daily_limit`, outbound.ts:367) enforced dans les workers cron — PAS dans `evaluateSend` — donc les chemins interactifs/follow-up ne le comptent pas.
- Les deux caps sont des variables de config (`OverridableKey` tenant-settings.ts:513-515 ; colonne DB), exactement ce que le prompt maître interdit. 600/h tenant ≈ 14 400/j théoriques.
- Le squelette pour l'invariant cible existe (gate unique + compteurs `sentToday` + rampe) ; le travail = un cap par-compte-d'envoi/jour dans `evaluateSend` lui-même, tous modes.

---

## 6. LinkedIn semi-automatique — VERDICT : PARTIEL (machinerie riche, mais modèle de conformité ≠ cible)

**Preuves (origin/main) :**
- Quotas prudents par siège : `lib/sending/linkedin/limits.ts:14-15` (défauts ~20 connects/j, ~100 messages/j) ; rampe LinkedIn-safe dédiée `lib/sending/linkedin/capacity.ts:1-12` (connects ≤5/j → 20 sur ~2 semaines ; messages 20→100 ; « Unipile does NOT enforce caps — this is the only thing standing between us and a LinkedIn restriction ») ; fail-closed si siège non `connected`.
- Dispatch par siège du propriétaire : `lib/sending/linkedin/dispatch-step.ts:1-12` — seat resolver → `dispatchLinkedInAction` (fail-close santé, suppression-22, anti-collision-14, warmup caps par siège, idempotence) ; jamais d'emprunt du siège d'un collègue.
- HITL au niveau ENROLLMENT : mode draft/review de l'autopilot (`lib/autopilot/enroll-decision.ts`, `lib/sequence-drafts/router.ts`) + approbation des enrollments chat (HITL).

**Gap principal :** le modèle cible = « l'IA prépare, l'humain valide CHAQUE action en 1 clic ; aucune automatisation qui pilote directement le compte ». L'implémentation actuelle pilote le compte LinkedIn de l'utilisateur DIRECTEMENT via Unipile (API non officielle) une fois le step dû — la validation humaine porte sur l'entrée en séquence, pas sur chaque visite/invitation/message. Il n'y a PAS de file de validation par action type « swipe/batch ». C'est un choix assumé dans le code (spec 36) mais en conflit frontal avec la vision 5 du prompt maître — à trancher par le founder.

---

## 7. Gifting — VERDICT : ABSENT (contenu éditorial seulement)

`git grep -i "gifting|reachdesk|alyce"` sur origin/main : AUCUN code produit. Seules occurrences = contenu pédagogique du playbook docs (`lib/docs/steps/run.ts:28,471,483` — « Gifting that works », « Example: an Elevay gifting play »). Aucune table, aucun workflow, aucune intégration. À construire from scratch (le benchmark montre que Monaco l'a NATIF dans son sequencer).

---

## 8. Prise de RDV & classification des réponses — VERDICT : EXISTE

**Preuves (origin/main) :**
- Taxonomie de classification : `lib/reply/classify.ts:9-13` — `Sentiment = positive|neutral|negative`, `Intent = interested|not_now|referral|opt_out|ooo`, avec score de confiance (tests `reply.test.ts:47-59` : une classification « interested » à confiance 0,3 n'est pas traitée comme sûre).
- Routage : `lib/reply/route.ts:4,59-66` — positive/interested → hot-lead + HALT de la séquence ; ooo → branche dédiée ; idempotent par message-id provider.
- Handler intelligent : `inngest/reply-handler.ts:1-7` — draft contextuel post-classification avec `objectionDetail`, knowledge base pour objections, et **slots de meeting injectés pour les réponses positives** (`getAvailableSlots`/`formatSlotsForEmail` de `lib/integrations/meeting-booking`, :24).
- Arrêt de séquence sur réponse : `pauseEnrollment("replied")` (module 4). Booking : scheduler produit (invite states #582, book-a-meeting resolve-or-create #493) + calendrier OAuth Google/MS.

**Gap principal :** taxonomie sans classe « objection » de premier niveau (l'info existe en `objectionDetail` mais pas comme intent routable) ; les cas incertains ne partent PAS en file de revue humaine avec correction-comme-donnée-d'entraînement (exigence cible module 11 du prompt) ; booking dépend d'un calendrier connecté (les boîtes Instantly ne comptent pas).

---

## 9. RGPD — VERDICT : PARTIEL

**Preuves (origin/main) :**
- DSAR : `lib/compliance/dsar/` (erase.ts, db-erase.ts, export.ts) + routes `app/api/gdpr/{delete,erase,export}/route.ts` ; l'effacement supprime aussi la ré-entrée (le gate re-supprime ensuite — db-erase.ts:7).
- Purge : `inngest/data-retention.ts:1-19` — cron quotidien 3h, purge cascade 30 j après clôture de compte (« Deleted within 30 days of account closure »).
- Suppression cross-canal : spec 22 typée (competitor/customer/DNC/complaint) niveau adresse+domaine+compte+global, consommée par le gate email (sending-gate.ts) ET le dispatch LinkedIn (dispatch-step.ts:4-5) — l'opt-out est bien cross-canal.
- Lawful basis : `lib/compliance/lawful-basis/db-gate.ts` — gate bloquant par défaut derrière flag `LAWFUL_BASIS_GATE` (OFF tant que l'audience n'est pas backfillée).
- Export tenant : `api/gdpr/export` verrouillé requireAdmin (audit RBAC antérieur).

**Gap principal :** pas de registre des traitements produit (seule trace : une ligne dans la page légale acceptable-use) ; le gate lawful-basis est OFF (backfill non fait) ; pas de mention-désinscription vérifiée structurellement dans chaque template (à vérifier côté templates) ; pas de purge sélective par contact hors DSAR.

---

## 10. UI charte — VERDICT : EXISTE, mais la CHARTE DOC EST PÉRIMÉE vs le code

**Preuves (origin/main) :** `app/apps/web/src/app/globals.css` — `--header-height: 44px` (:25) conforme design-language.md. MAIS : `--color-bg-base: #FAFAFA` (light, :74) et `#0A0B0F` (dark, :257) vs `#09090b` dans design-language.md ; `--color-accent: #2C6BED` (light, :95) et `#60A5FA` (dark, :275) vs indigo `#6366f1` documenté.

**Conséquence pour ce projet :** le founder a choisi `_harness/design-language.md` comme charte de référence, mais ce document ne reflète plus les tokens réels (le produit a un mode clair + un accent bleu différent). design-language.md:9 déclare lui-même globals.css comme source of truth. **Ambiguïté de charte au sens de la règle permanente (prompt maître :124) → à soulever au founder avant la Phase 1bis.**

---

## 11. Taxonomie outcomes & event tracking — VERDICT : PARTIEL, avec 2 conflits directs vs les règles cibles

**Preuves (origin/main) :**
- Hiérarchie pondérée : `lib/outcomes/resolve.ts:6-18` — `POSITIVITY` : replied_positive 1.0, meeting_booked 0.9, deal_advanced 0.8, replied_neutral 0.4, email_clicked 0.3, **email_opened 0.1**, no_response 0.0, replied_negative −0.3, unsubscribed −0.6, bounced −0.8, deal_lost −1.0.
- Watcher décision→outcome : `lib/outcomes/create-watcher.ts:4-30` — fenêtres d'observation par type d'action (7-14 j) + outcome attendu par action = un embryon d'attribution dernier-touchpoint au niveau ACTION.
- Event mapping : resolve.ts:65-80 (opened/clicked/replied_positive/replied_negative/bounced → outcomes).

**Conflits directs avec le prompt maître :**
1. **L'open rate EST utilisé comme signal d'apprentissage** — email_opened pèse 0,1 dans POSITIVITY (resolve.ts:12) et 1,15 dans les priors de multiplicateurs de signaux (`lib/scoring/signal-outcomes.ts:67`). La cible l'interdit (Apple MPP). À neutraliser.
2. **Hiérarchie inversée** : replied_positive (1.0) > meeting_booked (0.9), alors que la cible ordonne RDV pris > réponse positive ; et « RDV honoré » (signal ultime) n'existe pas comme outcome.

**Gap principal :** l'enregistrement de décision riche (features prospect + signal + angle + features message + canal + timing + position séquence) n'existe pas comme dataset ; on a des traces (`agent_traces`) et des outcomes d'action, pas une table de décisions d'outreach apprêtée pour l'apprentissage.

---

## 12. Boucle self-improvement — VERDICT : PARTIEL (palier 1 largement construit, paliers 2-3 absents)

**Preuves (origin/main) :**
- Flywheel 4 mécanismes : `lib/evals/flywheel.ts:1-15` — failure→eval case, pattern analysis, prompt refinement, few-shot curation + boucle evaluator-optimizer.
- Injection en production : `lib/ai/traced-ai.ts:90,104-108,141,185,308` — learned prompt + few-shots + playbook appris injectés dans les agents outbound-drafting (+ objections par contact, win/loss par entreprise — arc #547/#548).
- Multiplicateurs de signaux appris : `lib/scoring/signal-outcomes.ts:298` (`getSignalMultipliers`, MIN_SAMPLE 10, priors :67).
- Canary : `lib/prompts/canary-ramp.ts` (+ tests canary-ramp.test.ts) et `lib/prompt-optimizer/optimizer.ts` — ramp/promote/rollback de prompts (#538).
- Dataset d'entraînement futur : `lib/distillation/pipeline.ts:1-13` — capture (input,output) de qualité (approved-no-edit, eval ≥0,85, feedback positif), PII strippée, « safe for cross-tenant model training » = graine du palier 3.

**Absents vérifiés :** bandits multi-bras — 0 occurrence (`git grep -i "bandit|thompson|epsilon"`) ; modèle de scoring/reward dédié avec pipeline d'entraînement/backtest/rollback — inexistant (seul `lib/evals/personalization-backtest.ts` fait du backtest d'evals, pas de modèle). **Gap structurel :** l'unité d'apprentissage actuelle est le MESSAGE/la trace d'agent, pas la DÉCISION de ciblage (bon compte/persona/moment/signal/angle) que la cible met au premier rang ; cold-start réel (tenant ~0 outcomes, MIN_SAMPLE 10 rarement atteint).

---

## 13. Quality gates avant envoi — VERDICT : PARTIEL, avec un trou transport-side et un gate spec-20 NON CÂBLÉ

**Ce qui existe (vérifié) :**
- Gate TRANSPORT unique : `evaluateSend` (module 5) — mais il ne vérifie QUE le destinataire/quota/suppression/délivrabilité, **aucun check de CONTENU**.
- Gates de CONTENU à la GÉNÉRATION : anti-fabrication bloquant 2 couches (déterministe + juge sémantique) `lib/evals/fabrication-gate.ts:1-22`, câblé dans `lib/agents/sequence-generator.ts:11` avec boucle regenerate-sans-les-claims ; grader qualité `lib/evals/email-quality-grader.ts` + `sequence-quality.ts` (composite + dimensions, P0-3) ; juge personnalisation par claims `lib/evals/personalization-judge.ts` ; golden set `lib/evals/golden-cases.ts` ; never-invent floor dans `generateCopyMessage` (prepare.ts:7-9).
- Garde empty-body câblée aux workers : `lib/emails/empty-body-guard.ts` consommé par `email-send-worker.ts`, `outbound-smtp-send.ts`, `sending/linkedin/linkedin.ts` (réponse au bug « copy vide » du 26/06).
- **Spec 20 QC gate (`runQc`, `sendEligible`, brandViolations, countLinks) : construit et testé (`lib/copy/variants/qc.ts`, exports index.ts:1-18) mais AUCUN call-site produit** — grep sur origin/main : zéro appelant hors `lib/copy/variants/` et tests. Machinerie prête, non branchée.

**Mapping vs les 5 gates cibles :**
- G1 ciblage+signal frais : PARTIEL — sélection autopilot signal-ranked, mais le SAFE_MODE targeting gate transport-side est flag-OFF, et aucune règle « pas de signal frais = pas d'enrollment » opposable aux enrollments manuels/chat.
- G2 vérification factuelle : PARTIEL — fabrication-gate réel mais seulement dans le chemin sequence-generator ; pas au transport ; les envois manuels ne le traversent jamais (la cible exige gates 2+5 même en manuel).
- G3 interchangeabilité : PARTIEL — personalization-judge évalue le grounding des claims, pas un « test d'interchangeabilité » explicite ; non bloquant au transport.
- G4 score rédactionnel : PARTIEL — graders existants, seuils non centralisés, pas de « régénération max N puis mise de côté » systématique hors generator.
- G5 sécurité délivrabilité : EXISTE au transport (guard bounce/spam, warmup, caps, DNS auth) ; check spam-words/ratio-liens : `countLinks`/`brandViolations` existent… dans le QC gate non câblé.
- Traçabilité des décisions de gate : partielle (agent_traces + reasons d'evaluateSend loggés) mais pas de pipeline à états `en_attente → gate_1..5 → approuvé/bloqué` visible dans l'UI.

---

# Tableau récapitulatif

| # | Module | Verdict | Preuve pivot (origin/main) | Gap principal |
|---|--------|---------|---------------------------|---------------|
| 1 | Ingestion TAM & enrichissement | existe | lib/icp/* ; lib/dedup/* ; lib/enrichment/field/waterfall.ts | vérif email = domaine/MX only, pas de vérifieur mailbox payant (mx-verify-provider.ts:6) |
| 2 | Moteur de signaux | existe | record-signal.ts:94 ; signal-score-daily.ts ; freshness.ts:31,81 | JSONB non normalisé, ≥6 taxonomies, decay binaire |
| 3 | Décision IA | partiel | autopilot/run.ts:1-13 ; sequence-router.ts ; decision-prompt.ts | timing/canal pas décidés par IA par prospect |
| 4 | Séquenceur & arrêts auto | existe | enrollment.ts:5-28 ; templates/types.ts:30 | pas de branchements conditionnels in-sequence |
| 5 | Délivrabilité & quotas | partiel | sending-gate.ts:214 ; rate-limit.ts:104-109 ; outbound.ts:367 | AUCUN cap 100/j/compte non contournable ; caps = config ; mode external non gated |
| 6 | LinkedIn semi-auto | partiel | dispatch-step.ts:1-12 ; limits.ts:14-15 ; capacity.ts:1-12 | pilote le compte via Unipile (non officiel) ; HITL à l'enrollment, pas par action |
| 7 | Gifting | absent | docs/steps/run.ts:471 (contenu seulement) | tout à construire |
| 8 | RDV & classification réponses | existe | reply/classify.ts:9-13 ; route.ts:59-66 ; reply-handler.ts | pas de classe « objection » routable ; pas de file de revue humaine des cas incertains |
| 9 | RGPD | partiel | compliance/dsar/* ; data-retention.ts ; api/gdpr/* | lawful-basis OFF ; pas de registre des traitements |
| 10 | UI charte | existe* | globals.css:25,74,95,257,275 | *design-language.md PÉRIMÉ vs tokens réels (accent #2C6BED/#60A5FA ≠ #6366f1 ; light mode existe) |
| 11 | Outcomes & tracking | partiel | outcomes/resolve.ts:6-18 ; create-watcher.ts:4-30 | open rate UTILISÉ comme signal (interdit cible) ; hiérarchie inversée ; pas de decision-record |
| 12 | Self-improvement | partiel | flywheel.ts:1-15 ; traced-ai.ts:90-308 ; canary-ramp.ts ; distillation/pipeline.ts | bandits absents ; pas de reward model ; unité = message, pas décision |
| 13 | Quality gates | partiel | fabrication-gate.ts ; sequence-generator.ts:11 ; copy/variants/index.ts (NON câblé) | zéro gate de contenu au transport ; QC spec-20 construit mais 0 call-site ; manuel bypasse G2 |

# Les 5 faits les plus importants pour les recommandations brownfield

1. **Le cap architectural n'existe pas** : les quotas actuels sont des variables de config (20/j primary, 50/j mailbox, 60/min+600/h tenant) avec un mode (`external-connected`) entièrement non gated côté volume/cold (sending-identity.ts:115-124). Le chantier n°1 du prompt maître est réel, mais le point d'insertion est déjà là : `evaluateSend`, unique et fail-closed sur 5 chokepoints.
2. **Les quality gates de contenu existent mais au mauvais étage** : fabrication-gate/graders/judges tournent à la génération dans CERTAINS chemins, jamais au transport ; et le QC gate spec-20 (`runQc`/`sendEligible`) est fini, testé, et branché NULLE PART. Une part matérielle du « pipeline 5 gates » cible = du câblage, pas du build.
3. **Deux violations directes des règles permanentes cibles dans le code d'apprentissage** : open rate comme signal (resolve.ts:12, signal-outcomes.ts:67) et meeting_booked < replied_positive (resolve.ts:6-18) ; « RDV honoré » n'existe pas. Corrections ponctuelles, pas des chantiers.
4. **Le conflit LinkedIn est stratégique, pas technique** : l'infra actuelle (Unipile, quotas par siège, rampe, suppression cross-canal) pilote directement le compte — la vision cible l'interdit explicitement. Décision founder requise : file de validation par action (pivot produit) vs statu quo assumé (risque CGU).
5. **La charte de référence choisie est périmée** : design-language.md (indigo #6366f1, dark-only) ≠ globals.css réel (accent #2C6BED light / #60A5FA dark, light mode par défaut :74). Toute la Phase 1bis/2 UI doit se caler sur les tokens RÉELS, sinon les wireframes seront faux dès le départ.


---

# Corrections post-audit (02/07, revue adversariale des specs)

1. **Module 11 — les conflits 1 et 2 sont CORRIGÉS depuis** : PR #609 (ref 969123ee) a retiré l'open rate de l'apprentissage (POSITIVITY sans email_opened, prior supprimé, attribution exclue) et remis la hiérarchie à l'endroit (meeting_held 1,0 > meeting_booked 0,95 > replied_positive 0,9). Ce document décrit l'état à la ref auditée 79731970 ; ne pas re-citer ces deux points comme actuels. Voir requirements.md INV-7/M11-R1.
2. **Module 8 — le tracking d'attendance EXISTE** : held/no_show est déjà tracké (PR #270, resolveAttendance), présent à la ref auditée mais raté par l'audit ; et il n'existe pas de table `meetings` (meetings = activities + fetch calendrier live). Le gap réel du module 8 se réduit au PRODUCTEUR d'outcomes meeting_booked/meeting_held (tasks.md T12).
3. **Module 5 — périmètre du cap** : tranché founder 02/07 = PAR TENANT (pas par compte utilisateur) ; implémenté PR #615 (constante compilée + compteur atomique dans evaluateSend, sendClass dérivé serveur, claim reply re-vérifiée).
4. **Module 6 — précision** : dispatchLinkedInStep/dispatchLinkedInAction sont un seam ORPHELIN (zéro caller de production ; l'adaptateur séquenceur est un stub tâche-manuelle) — le « PARTIEL » du module 6 vaut aussi pour M6-R5, pas seulement pour le modèle de conformité.
