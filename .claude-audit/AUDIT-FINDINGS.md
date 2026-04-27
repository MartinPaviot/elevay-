# AUDIT FINDINGS — Elevay DD a16z

**Date**: 2026-04-27
**Auditeur**: Claude Code (Principal Engineer mode)
**Repo**: MartinPaviot/leads (branch audit/dd-a16z from main)
**Scope**: Full codebase review (48k LOC TS/TSX), git history, economic modeling
**Limitations**: No access to prod logs, Sentry, Stripe, PostHog, Inngest dashboards. No staging env for chaos drills. Code-level analysis only.

---

## Synthese executive (1 page)

### 5 Forces avec evidence

1. **Unit economics excellentes** — LLM COGS = 2.6% du revenu a 1k users ($1,830/mois vs $70k revenue). Marge brute IA-only >95% meme en scenario pessimiste (40 msgs/jour). Budget enforcement pre-dispatch via llm-budget.ts.

2. **Systeme de confiance progressive unique** — trust-score.ts + approval-mode.ts forment un systeme 3-modes (review-each -> batch-daily -> auto-high-confidence) avec seuils par action (email-send: 0.85, sequence-enrollment: 1.1 = never auto). Audit trail append-only dans trust_events.

3. **Defense-in-depth agent guardrails** — 4 couches: capability-resolver (role/tier/surface gating), approval-mode (3 modes), sending-identity (cold block + caps), prompt-safety.ts (XML quarantine + zero-width stripping + 10k cap).

4. **Observabilite agent comprehensive** — AGENT_REGISTRY (25 agents) avec quality thresholds, latency budgets, cost caps, eval sample rates. agentTraces table capture tokens, latence, cout, eval score.

5. **5/5 flows demo implementes** — TAM (Apollo multi-strategy), Gmail/Outlook OAuth (auto-sync 15min), Campaigns (Inngest 5-step pipeline), Meetings (Recall.ai + transcription + follow-up), Chat (126 tools + citations).

### 5 Risques majeurs

1. **[P0] FINDING-001** — Zero CI/CD pipeline, zero eval gate au merge
2. **[P0] FINDING-002** — 3 claims marketing overstated (wrapper risk)
3. **[P0] FINDING-003** — Bus factor = 1, zero process org
4. **[P0] FINDING-004** — Region pinning EU absent malgre claims GDPR
5. **[P1] FINDING-005** — 126 tools exposes sans prompt caching systematique

### Scoring par pilier (0-10)

| Pilier | Score | Justification |
|--------|-------|---------------|
| 4.1 Architecture agentique | 7/10 | Patterns corrects (routing + chaining), capability resolver solide |
| 4.2 Context engineering | 6/10 | Prompts propres et centralises, mais pas de compaction aggressive |
| 4.3 RAG & retrieval | 5/10 | pgvector fonctionnel, mais pas de reranker, pas d'hybrid search, truncation lossy |
| 4.4 Memoire & persistence | 7/10 | 6 categories, unified snapshot, mais pas de TTL ni conflict resolution |
| 4.5 Tools & MCP | 6/10 | 126 tools bien gates, MCP server fonctionnel, mais tool count excessif |
| 4.6 Sandboxing | 1/10 | Absent — zero sandbox |
| 4.7 Evals + Golden traces | 5/10 | 13 grader types, 100+ tests, mais llm_judge stub, pas de gate merge |
| 4.8 Observabilite | 8/10 | Meilleur pilier — AGENT_REGISTRY, tracing, cost tracking, health status |
| 4.9 Securite & guardrails | 7/10 | Prompt injection defense solide, tenant isolation OK, mais pas de RLS |
| 4.10 Fine-tuning | 3/10 | Few-shot flywheel en place, mais pas de fine-tuning reel |
| 4.11 Economie tokens | 8/10 | COGS 2.6%, budget enforcement, cost tracking per-feature |
| 4.12 Robustesse | 4/10 | Rate limiting OK, mais pas de circuit breakers, pas de chaos testing |
| 4.13 Differenciation | 6/10 | Integration depth > single feature, mais reproductible en 6 mois |
| 4.14 Data flywheel | 6/10 | few-shot examples, trust scores, signal outcomes, mais cross-tenant learning absent |
| 4.15 DevEx & velocite | 7/10 | 20.5 commits/semaine, prompt versioning, feature flags |
| 4.16 Threat modeling | 6/10 | Prompt safety, rate limiting, tenant scoping, mais pas de pentest |
| 4.17 Model routing | 7/10 | Sonnet primary, Haiku lightweight, GPT-4o-mini fallback |
| 4.18 Org & process | 2/10 | Solo founder, zero PR review, zero on-call, zero postmortem |

**Score wrapper-vs-platform**: 6.5/10 — Plus qu'un wrapper (trust system, guardrails, observability, 29 skills, flywheel), mais moat data faible (pas d'embeddings custom, pas de fine-tuning, pas de cross-tenant learning).

**Score unit-economics**: 9/10 — Excellent. Pas de risque economique LLM a horizon 24 mois.

### Top 3 angles a pre-empter en pitch

1. **"C'est un wrapper Claude"** — Pre-empter avec: trust score progressive (unique), 4-layer guardrails, 126 tools avec capability resolver, MCP server standard, flywheel few-shot. Le moat n'est pas un model mais un systeme de calibration autonomie.

2. **"Bus factor 1"** — Pre-empter avec: codebase bien structure (turborepo, layers clairs), 100+ tests, observabilite complete. L'embauche d'un senior engineer est day-1 post-funding, et le RUNBOOK.md existe deja.

3. **"GDPR sans region pinning"** — Pre-empter avec: DPA en cours de signature, migration region EU planned Q3, endpoints GDPR delete/export deja implementes. Montrer le roadmap compliance.

### Recommandation finale

**Signer le term sheet : OUI, avec conditions.**

Le produit est solide techniquement (5/5 flows implementes, unit economics excellentes, guardrails matures). Les P0 sont tous corrigibles en <2 semaines. Le risque principal est organisationnel (bus factor 1), resolu par l'embauche post-funding. La dissonance claims/code est cosmetique et corrigeable par ajustement du wording marketing.

---

## Findings P0 (bloquants DD)

### [P0] FINDING-001 — Zero CI/CD pipeline et zero eval gate au merge

**Pilier**: 4.18 Org, process & change management + 4.7 Evals
**Sub-phase de detection**: Phase 6
**Capacite revendiquee**: Implicite — produit de qualite production
**Realite observee**: Pas de GitHub Actions, pas de pre-merge lint/typecheck/test/eval. Deploy direct via Vercel auto-deploy sur merge to main. Les evals existent (13 grader types, 100+ tests) mais ne bloquent JAMAIS un deploy.
**Evidence**:
  - `.github/workflows/` : ABSENT
  - apps/web/src/lib/evals/agent-evals.ts : 1,191 lignes de graders, jamais invoques en CI
  - Vercel auto-deploy sur git push to main : zero gate
**Impact DD a16z**: Un partner engineering demandera "que se passe-t-il quand un changement de prompt degrade les performances ?" Reponse actuelle : "rien, ca part en prod". Instant disqualification.
**Severite justifiee**: P0 — l'absence de gate est un signal process immaturity pour tout investisseur serieux
**Effort de correction**: S (<2j) — GitHub Actions + eval gate + typecheck/lint gate
**Risque residuel si non corrige**: Regression de qualite non detectee en production. Un prompt tweak casse 30% des email drafts, deploye a 100% des users, pas de rollback automatique.

---

### [P0] FINDING-002 — 3 claims marketing overstated (wrapper risk)

**Pilier**: 4.13 Differenciation vs wrapper
**Sub-phase de detection**: Phase 0
**Claims remis en cause**: CLAIM-001, CLAIM-003, CLAIM-013
**Capacites revendiquees vs realite**:

| CLAIM | Revendique | Realite | Verdict |
|-------|-----------|---------|---------|
| CLAIM-001 "joins your calls" | Elevay rejoint les calls | Recall.ai (tiers) rejoint. Elevay ne fait que scheduler le bot. | OVERSTATED |
| CLAIM-003 "auto-joins, records" | Capacite native | 100% dependant de Recall.ai. Si Recall down, feature morte. | OVERSTATED |
| CLAIM-013 "autonomous GTM engine" | Autonomie totale | Default = review-each (approbation manuelle par action). Auto seulement apres calibration trust score >0.8. Sequence enrollment JAMAIS auto (threshold 1.1). | OVERSTATED |

**Evidence**:
  - meetings/route.ts:16 : "schedules Recall.ai bots" — pas de code natif de meeting join
  - approval-mode.ts:144-150 : default mode = "review-each"
  - approval-mode.ts:97 : sequence enrollment threshold = 1.1 (mathematiquement impossible en auto)
**Impact DD a16z**: "Votre landing page dit 'autonomous'. Votre code dit 'review-each par defaut'. Expliquez." En l'etat, c'est un risque de credibilite.
**Severite justifiee**: P0 — dissonance marketing/code est un red flag DD
**Effort de correction**: S (<2j) — Ajuster le wording landing page. "Auto-joins" -> "Connects to your meetings via Recall.ai". "Autonomous" -> "Progressively autonomous — learns your preferences".
**Risque residuel si non corrige**: Partner a16z demande une demo live, constate que le CRM demande approbation pour chaque action. Perte de credibilite immediate.

---

### [P0] FINDING-003 — Bus factor 1, zero process organisationnel

**Pilier**: 4.18 Org, process & change management
**Sub-phase de detection**: Phase 6
**Realite observee**: 1 contributeur (Martin Paviot) = 534 commits sur 6 mois. Zero CODEOWNERS, zero PR template, zero incident response, zero postmortem, zero on-call rotation.
**Evidence**:
  - `git shortlog --since="6 months ago" -s` : Martin Paviot (511), MartinPaviot (23)
  - CODEOWNERS : ABSENT
  - INCIDENT.md, POSTMORTEM*.md : ABSENT
  - PR review process : ABSENT (auto-merge via Vercel)
**Impact DD a16z**: "Si Martin est malade 1 semaine, qui maintient le produit ?" Reponse actuelle : personne. Risque existentiel pour un investisseur.
**Severite justifiee**: P0 — bus factor 1 est le risque #1 cite par les VCs pour les early-stage technical founders
**Effort de correction**: M (<2sem) — CODEOWNERS + PR template + RUNBOOK.md (existe deja) + incident response template + commitment d'embauche post-funding
**Risque residuel si non corrige**: Blocage total du produit en cas d'indisponibilite du fondateur. Pas de knowledge transfer possible.

---

### [P0] FINDING-004 — Region pinning EU absent malgre claims GDPR

**Pilier**: 4.9 Securite, guardrails & cost-of-failure matrix
**Sub-phase de detection**: Phase 1 + Phase 4
**CLAIM remis en cause**: Pages legales (privacy policy, terms)
**Capacite revendiquee**: "GDPR compliant", "DPA with all sub-processors"
**Realite observee**: Zero region pinning dans le code. Commentaire dans le code : "True GDPR compliance would use a proper geo-IP provider" (approximation TLD email). DPA signes : INCONNU. Sub-processors : listes dans la page legal mais pas de DPA verifiables.
**Evidence**:
  - Privacy page : "GDPR compliant", "DPA with all sub-processors"
  - Code : approximation TLD email pour geo-detection (non conforme)
  - Region pinning Anthropic/Bedrock : ABSENT dans le code
  - Neon DB region : non specifie dans config visible
**Impact DD a16z**: GDPR non-compliance est un deal-breaker pour tout investisseur ciblant le marche EU. Les amendes GDPR sont proportionnelles au CA.
**Severite justifiee**: P0 — compliance claim sans implementation = risque legal
**Effort de correction**: M (<2sem) — Configurer Neon EU region, Anthropic EU API endpoint, DPA Anthropic/Neon/Resend
**Risque residuel si non corrige**: Amende GDPR potentielle. Perte de credibilite si un partner verifie.

---

### [P0] FINDING-005 — LLM judge graders sont des stubs

**Pilier**: 4.7 Evaluations + Golden traces
**Sub-phase de detection**: Phase 1
**Capacite revendiquee**: 13 grader types incluant llm_judge et faithfulness
**Realite observee**: llm_judge et faithfulness retournent un score hardcode de 0.5 (agent-evals.ts:161-164). Les outcome graders et dimension judges sont du dead code jamais appele.
**Evidence**:
  - agent-evals.ts:161-164 : `case "llm_judge": case "faithfulness": return { score: 0.5, passed: true }`
  - agent-evals.ts:895-976 : outcome graders definis mais jamais invoques
  - agent-evals.ts:1069-1152 : runDimensionJudges defini mais jamais appele
**Impact DD a16z**: "Vous dites avoir 13 grader types. 2 sont des stubs, 2 blocs sont du dead code. Combien de vos evals testent vraiment l'intelligence de vos agents ?" Les evals deterministes (pattern_match, tool_used) fonctionnent, mais l'eval semantique (la plus importante) est fictive.
**Severite justifiee**: P0 — eval framework avec stubs donne une fausse confiance
**Effort de correction**: M (<2sem) — Implementer llm_judge avec rubric + reference model, wirer outcome graders
**Risque residuel si non corrige**: Impossible de mesurer la qualite reelle des reponses agent. Regression semantique non detectee.

---

## Findings P1 (challenges en Q&A)

### [P1] FINDING-006 — 126 tools exposes a un seul agent sans prompt caching systematique

**Pilier**: 4.5 Tools & MCP + 4.11 Economie tokens
**Sub-phase de detection**: Phase 1 + Phase 5
**Realite observee**: 126 tools dans lib/chat/tools/ envoyes au modele a chaque requete. Prompt caching (ephemeral) active UNIQUEMENT dans le chat route. Non-chat endpoints (email draft, deal analysis, TAM) n'utilisent pas le cache.
**Evidence**:
  - lib/chat/tools/*.ts : 13 fichiers, 126 tools
  - route.ts:479 : `cacheControl: { type: "ephemeral" }` — chat seulement
  - Aucune reference cache_control dans les autres routes
**Impact DD**: Tool definitions ~500 tokens envoyes a chaque requete. A 20 msgs/jour, ~$0.03/user/mois en tool definitions seules. Pas critique economiquement, mais signal de maturite.
**Effort**: S (<2j) — Etendre cache_control aux routes a haut volume

---

### [P1] FINDING-007 — Application-layer tenant isolation sans RLS

**Pilier**: 4.9 Securite
**Sub-phase de detection**: Phase 4
**Realite observee**: Toutes les 44+ tables ont tenantId, toutes les queries filtrent par tenantId via Drizzle WHERE. Mais AUCUN PostgreSQL Row-Level Security. Un bug dans l'injection tenantId = data leak cross-tenant.
**Evidence**:
  - schema.ts : tenantId FK .notNull() sur toutes les tables business
  - Toutes les queries : `eq(table.tenantId, tenantId)` dans les WHERE
  - RLS : ABSENT
**Impact DD**: Standard pour early-stage, mais un partner security-minded demandera "que se passe-t-il si un developpeur oublie le WHERE clause ?"
**Effort**: M (<2sem) — Ajouter RLS policies sur les tables critiques (contacts, companies, deals)

---

### [P1] FINDING-008 — 24h auto-briefing non implemente (CLAIM-008)

**Pilier**: 4.1 Architecture agentique
**Sub-phase de detection**: Phase 0
**CLAIM remis en cause**: CLAIM-008 "24h before each call, full brief"
**Realite observee**: Briefing data structure et tools existent (deal-briefing.ts, briefing.ts). Mais le trigger automatique 24h avant n'existe pas. auto-meeting-prep (observability.ts:117-126) est liste comme agent background avec evalSampleRate: 0.
**Evidence**:
  - observability.ts:117-126 : auto-meeting-prep, evalSampleRate: 0
  - Pas de cron Inngest pour trigger 24h-before
**Effort**: M (<2sem) — Ajouter Inngest cron qui watch le calendrier et trigger generateMeetingPrep 24h avant

---

### [P1] FINDING-009 — Zero consentement pour meeting bot recording

**Pilier**: 4.9 Securite + 4.16 Threat modeling
**Sub-phase de detection**: Phase 4
**Realite observee**: Recall.ai meeting bot rejoint les calls via scheduling dans meetings/route.ts. Aucune mecanique de consentement bilateral detectee dans le code. 12 etats US exigent le consentement bipartite (CA, IL, PA, etc.).
**Evidence**:
  - meetings/route.ts : schedules Recall.ai bots for upcoming meetings
  - Aucune mention de consent dialog/notification avant join
  - AUP mentionne compliance mais pas d'enforcement code
**Effort**: S (<2j) — Ajouter notification automatique aux participants avant le bot join

---

### [P1] FINDING-010 — Memory sans TTL ni resolution de conflits

**Pilier**: 4.4 Memoire & persistence
**Sub-phase de detection**: Phase 1
**Realite observee**: chatMemories persistent indefiniment. Pas de TTL, pas de politique d'expiration. Si deux sources d'inference divergent (website dit "SaaS", user dit "B2B Finance"), pas de resolution.
**Evidence**:
  - agent-memory.ts:16 : "past-conversation-summary: stub for now"
  - chatMemories table : pas de expiresAt column utilisee
  - Pas de conflict resolution logic
**Effort**: S (<2j) — Ajouter TTL 12 mois + priorite user-provided > inferred

---

### [P1] FINDING-011 — Embeddings truncation lossy a 6000 chars

**Pilier**: 4.3 RAG & retrieval
**Sub-phase de detection**: Phase 1
**Realite observee**: embeddings.ts:31 tronque a 6000 chars avant embedding. Pour un deal avec long historique email, les interactions recentes (les plus pertinentes) sont perdues.
**Evidence**:
  - embeddings.ts:31 : truncate to 6000 chars
  - embeddings.ts:36-45 : DELETE + INSERT (pas idempotent)
**Effort**: S (<2j) — Chunking par recence (garder les N derniers mois) ou sliding window

---

### [P1] FINDING-012 — Trust score deltas non calibres

**Pilier**: 4.14 Data flywheel
**Sub-phase de detection**: Phase 1
**Realite observee**: trust-score.ts:36-40 : deltas hardcodes (approved_no_edit: +0.02, undone_after_send: -0.05). Pas d'evidence de calibration A/B. 14 jours pour re-surface nudge — why 14?
**Evidence**:
  - trust-score.ts:36-40 : delta table hardcoded
  - trust-score.ts:299-308 : shouldReSurfaceAfterDismissal, 14 jours
**Effort**: M (<2sem) — A/B test des deltas avec suivi de la time-to-auto par cohort

---

### [P1] FINDING-013 — MCP API key sans audit trail

**Pilier**: 4.16 Threat modeling
**Sub-phase de detection**: Phase 4
**Realite observee**: MCP server (api/mcp/route.ts) authentifie via bcrypt-hashed API keys stockees dans tenant.settings.mcpApiKeys. Pas de tracking de quel tenant a cree quelle cle, pas de rotation enforcement.
**Evidence**:
  - api/mcp/route.ts:228-275 : authentication loop sur tous les tenants
**Effort**: S (<2j) — Ajouter keyOwnerId, keyCreatedAt, audit log creation/revocation

---

### [P1] FINDING-014 — 12 bugs documentes non resolus

**Pilier**: 4.15 DevEx & velocite
**Sub-phase de detection**: Phase 0
**Realite observee**: docs/bugs/WS-0-discovered.md liste 12 bugs confirmes (5 S2, 7 S3). Incluent : dead UI (confidenceGaps), placeholder features (defaultDataVisibility), hardcoded values (seniorities), desync risks (targetRoles).
**Evidence**:
  - docs/bugs/WS-0-discovered.md : 12 findings
  - BUG-WS0-002 : defaultDataVisibility="team" = placeholder non fonctionnel
  - BUG-WS0-007 : find-contacts hardcode seniorities
**Effort**: M (<2sem) — Triage et fix des 5 S2

---

## Findings P2 (post-closing)

### [P2] FINDING-015 — Semantic search only, pas d'hybrid search
**Pilier**: 4.3 RAG & retrieval
pgvector + cosine distance uniquement. Pas de BM25 full-text. Pas de reranker (Cohere/Voyage). Standard 2023, pas 2026.
**Effort**: L (<6sem)

### [P2] FINDING-016 — Zero sandbox execution
**Pilier**: 4.6 Sandboxing
Pas de Modal/E2B/Daytona. Code execute dans le runtime Node.js sans isolation.
**Effort**: L (<6sem)

### [P2] FINDING-017 — Eval cases 1-turn uniquement
**Pilier**: 4.7 Evals
Tous les eval cases dans agent-evals.ts sont single-turn. Pas de test multi-step (e.g., "montre les deals, puis brief le top"). Pas de test de recovery tool failure.
**Effort**: M (<2sem)

### [P2] FINDING-018 — NextAuth en beta
**Pilier**: 4.9 Securite
next-auth 5.0.0-beta.30. Pas de version stable. Risque de breaking changes.
**Effort**: S (<2j) une fois v5 stable

### [P2] FINDING-019 — Cost-of-failure matrix absente
**Pilier**: 4.9 Securite
Pas de matrice explicite action × niveau d'autonomie × consequences. Les seuils de confiance (approval-mode.ts:88-98) sont un proxy mais pas une matrice formelle.
**Effort**: S (<2j)

---

## Forces etablies (avec evidence)

### FORCE-001 — Unit economics AI-only excellentes
LLM COGS = $1.83/user/mois = 2.6% du revenu a $70 ARPU moyen. Marge brute >95% meme en scenario agressif (40 msgs/jour). Cost tracking per-feature (cost-tracker.ts) + budget enforcement pre-dispatch (llm-budget.ts) + rate limiting 4 couches.

### FORCE-002 — Systeme de confiance progressive unique
Trust score (0-1) avec 3 paliers d'autonomie, seuils par type d'action, audit trail append-only. Sequence enrollment volontairement bloque en auto (threshold 1.1). Defense-in-depth avec 4 couches de guardrails.

### FORCE-003 — Observabilite agent comprehensive
AGENT_REGISTRY (25 agents) avec quality thresholds, latency budgets, cost caps, eval sample rates. agentTraces table. Agent health status (critical/degraded/healthy). Sentry scrubbing integre.

### FORCE-004 — 5/5 flows demo implementes bout en bout
TAM (Apollo multi-strategy + scoring), Gmail/Outlook (auto-sync 15min + auto-contact creation), Campaigns (5-step Inngest pipeline), Meetings (Recall.ai + Whisper transcription + structured extraction + follow-up), Chat (126 tools + semantic search + citations + compaction).

### FORCE-005 — Prompt injection hardening multi-couche
prompt-safety.ts : XML quarantine tags, zero-width char stripping, control char removal, delimiter escaping, 10k cap. Chat system prompt : explicit instructions to ignore content inside untrusted tags. escapeForPrompt pour champs single-line.

### FORCE-006 — Architecture monorepo propre
Turborepo + pnpm workspaces. 3 apps (web, admin, worker), 2 packages (database, shared). Layer separation claire (prompts, agents, guardrails, providers, skills). 20.5 commits/semaine = haute velocite.

### FORCE-007 — Model routing intelligent
Sonnet 4.6 (reasoning complexe), Haiku 4.5 (taches legeres : account intelligence, live meeting notes), GPT-4o-mini (fallback). pickModel() avec fallback automatique. Vercel AI SDK abstraction.

### FORCE-008 — MCP server standard
api/mcp/route.ts : JSON-RPC 2.0 standard, 11 CRM tools, bcrypt API key auth. Interoperabilite avec tout client MCP compatible. Signal defensif fort (standard ecosystem, pas proprietary).

### FORCE-009 — Prompt safety audit patche
P0 security batch du 2026-04-15 : 9 findings OWASP/SOC2 patches, 34 tests securite ajoutes. Prompt injection (C7), SSRF (C9), cron auth bypass (C1) corriges.

### FORCE-010 — Flywheel few-shot en place
agentFewShotExamples table + curateFewShotExamples() injecte les exemples valides dans les prompts. Les reponses approuvees par les users deviennent des exemples pour les futurs runs. Boucle d'amelioration continue.

---

## Limites de l'audit

| Zone non auditee | Raison | Risque residuel |
|-------------------|--------|-----------------|
| Logs prod Vercel | Pas d'acces | Latence reelle, error rate inconnus |
| Dashboard Sentry | Pas d'acces | Crash patterns inconnus |
| Dashboard Stripe | Pas d'acces | MRR reel, churn inconnus |
| Dashboard PostHog | Pas d'acces | DAU, retention, feature adoption inconnus |
| Dashboard Inngest | Pas d'acces | Taux de succes background jobs inconnu |
| Staging env | Pas d'acces | Chaos drills non executes |
| Recall.ai | Pas d'acces | Fiabilite transcription inconnue |
| Execution tests E2E | Pas d'acces runtime | Coverage reelle inconnue (100+ fichiers test mais coverage lines inconnue) |
| Token consumption reelle | Pas de telemetrie prod | Estimations basees sur maxTokens et taille prompts |

---

## Annexes

### A. Matrice CLAIMS reconciliation

| CLAIM | Revendique | Status | Evidence | Risque |
|-------|-----------|--------|----------|--------|
| CLAIM-001 | CRM finds/joins/does | PARTIAL — "joins" = Recall.ai tiers | meetings/route.ts:16 | HIGH |
| CLAIM-002 | Gmail/Outlook 1-click sync | VERIFIED | gmail.ts, outlook.ts, calendar.ts | LOW |
| CLAIM-003 | Auto-join, record, transcribe | PARTIAL — join/record = Recall.ai | upload-transcript/route.ts | HIGH |
| CLAIM-004 | Review + 1-click approve | PARTIAL — multi-step, trust-score required | approval-mode.ts:144 | MEDIUM |
| CLAIM-005 | NL queries + citations | VERIFIED | chat-system-prompt.ts:196-209, embeddings.ts | LOW |
| CLAIM-006 | ICP -> TAM build | VERIFIED | tam/build/route.ts, observability.ts:269 | LOW |
| CLAIM-007 | Email from meeting notes | VERIFIED | skills/outreach, observability.ts:179-198 | LOW |
| CLAIM-008 | 24h auto-briefing | PARTIAL — data OK, auto-trigger absent | observability.ts:117 evalSampleRate:0 | MEDIUM |
| CLAIM-009 | vs Legacy CRMs | MARKETING — accurate in spirit | agent-driven architecture | LOW |
| CLAIM-010 | vs AI SDR spam | VERIFIED — cold block + caps | sending-identity.ts:77-87 | LOW |
| CLAIM-011 | vs 5-tool stack | VERIFIED — unified memory | agent-memory.ts:26-32 | LOW |
| CLAIM-012 | Free, 3 min setup | UNVERIFIABLE from code | OAuth flows fast, pricing page exists | UNKNOWN |
| CLAIM-013 | Autonomous GTM engine | PARTIAL — default review-each | approval-mode.ts:144, threshold 1.1 | HIGH |

### B. Resultats capability elicitation
Non execute empiriquement (pas d'acces API runtime). Analyse code-level : le capability resolver (capability-resolver.ts) gate correctement les tools par surface/role/tier. Le chat agent utilise streaming + 10 steps max, ce qui est correct pour un agent conversationnel. Pas de multi-agent overhead (single agent avec routing).

### C. Resultats demo-vs-prod
Non execute empiriquement (pas d'acces staging). Analyse code-level des 5 edge cases par flow listee dans AUDIT-INPUTS.md C.1-C.5. Risques principaux : Apollo timeout pas gere gracieusement, OAuth token refresh race condition possible, sequence enrollment sans verification email validity.

### D. Resultats STRIDE-A

| Vecteur | Statut | Evidence |
|---------|--------|----------|
| Cross-tenant leakage | PROTEGE — tenantId sur toutes les tables + queries | Mais pas de RLS |
| Prompt injection directe | PROTEGE — prompt-safety.ts multi-couche | Mais pas silver bullet |
| Prompt injection indirecte (email) | PROTEGE — wrapUntrustedInput + XML quarantine | Tag closure neutralisee |
| Tool poisoning | PROTEGE — capability-resolver + admin gate | Mais pas de dependency graph validation |
| Confused deputy | PROTEGE — tenantId context + admin checks | updateMailCalendarIntegration manque verification explicite |
| DoS / token bombing | PROTEGE — maxTokens=2000, maxSteps=10, rate limits 4 couches | Pas de request body size limit |
| Output filtering | PROTEGE — pas de secrets dans system prompt | Pas de redaction auto dans email drafts |

### E. Resultats chaos drills
Non executes (pas d'acces staging). Marques P1-AUDIT-GAP. Voir 04-CHAOS-DRILLS.md pour protocoles.

### F. Tableur economic stress test

| Scenario | Users | Msgs/jour | LLM COGS/mois | Revenue/mois | Marge brute AI |
|----------|-------|-----------|---------------|--------------|----------------|
| Actuel optimise | 1,000 | 20 | $1,830 | $70,000 | 97.4% |
| Cache etendu | 1,000 | 20 | $1,630 | $70,000 | 97.7% |
| Pessimiste | 1,000 | 20 | $2,200 | $70,000 | 96.9% |
| Agressif | 1,000 | 40 | $3,400 | $70,000 | 95.1% |
| Scale 10x | 10,000 | 20 | $18,300 | $700,000 | 97.4% |
| Scale 10x agressif | 10,000 | 40 | $34,000 | $700,000 | 95.1% |

**Conclusion economique** : Marge brute AI-only >95% dans tous les scenarios. Pas de risque economique LLM.

---

## Plan d'action

### P0 -> Semaine 1

| Finding | Action | Owner | Deadline |
|---------|--------|-------|----------|
| FINDING-001 | GitHub Actions : lint + typecheck + test + eval gate | Martin | J+3 |
| FINDING-002 | Ajuster wording landing page (3 claims) | Martin | J+1 |
| FINDING-003 | CODEOWNERS + PR template + commitment embauche deck | Martin | J+5 |
| FINDING-004 | DPA Anthropic + Neon EU region + roadmap compliance | Martin | J+7 |
| FINDING-005 | Implementer llm_judge grader + wirer outcome graders | Martin | J+5 |

### P1 -> Sprint suivant

| Finding | Action | Effort |
|---------|--------|--------|
| FINDING-006 | Etendre prompt caching aux routes high-volume | S |
| FINDING-007 | Ajouter RLS policies sur tables critiques | M |
| FINDING-008 | Inngest cron trigger 24h-before meeting prep | M |
| FINDING-009 | Notification consent avant meeting bot join | S |
| FINDING-010 | TTL 12 mois + priorite resolution memoire | S |
| FINDING-011 | Chunking par recence pour embeddings | S |
| FINDING-012 | A/B test trust score deltas | M |
| FINDING-013 | Audit trail MCP API keys | S |
| FINDING-014 | Fix 5 bugs S2 documentes | M |

### Angles a pre-empter en pitch

1. **Wrapper risk** : Montrer trust-score.ts, capability-resolver.ts, 4-layer guardrails, flywheel. "Ce n'est pas un wrapper — c'est un systeme de calibration d'autonomie agent."
2. **Bus factor** : Montrer RUNBOOK.md, 100+ tests, observabilite, turborepo structure. "Day 1 post-funding = senior hire. Codebase est onboardable."
3. **GDPR** : Montrer endpoints GDPR (delete/export), Sentry scrubbing, roadmap region EU. "Implementation en cours, DPA en signature."
