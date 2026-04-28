# Elevay — Carte de competences (100 points)

> Audit expert, 27 avril 2026. Score 1-5 par competence.
> 1=absent, 2=stub/placeholder, 3=fonctionne basique, 4=production-grade, 5=best-in-class
> Chaque note est justifiee par du code lu, pas par des intentions.

---

## A. FRONTEND UX (21 competences)

| # | Competence | Score | Verdict |
|---|-----------|-------|---------|
| 1 | Landing page copy/design | 4 | "Progressively autonomous GTM engine", Recall.ai attribue, 7 steps, comparatif 3 colonnes, FAQ. Propre. |
| 2 | Login/signup flow | 4 | OAuth Google+Microsoft, credentials, HIBP k-anonymity check, brute-force lockout, callback sanitization. |
| 3 | Onboarding wizard | 3 | Dual v1/v2 avec feature flags. v1 complet, v2 experimental. confidenceGaps maintenant interactif. aiTone visible. |
| 4 | Dashboard/home | 4 | Stats 7j avec deltas, deals at risk, priorities, meetings, hot contacts, recommendations, tasks due. Hydrate endpoint. |
| 5 | Accounts list+detail | 4 | Search NL, TAM stream, signal chips (investor overlap, funding, hiring), logos, bulk actions, saved views, custom fields. |
| 6 | Contacts list+detail | 4 | Smart import, enrich batch, merge contacts, pagination, custom fields, bulk actions. |
| 7 | Deals/pipeline view | 4 | Kanban board + table view, analytics sidebar, probability, age-in-stage, risk scoring, close reason dialog. |
| 8 | Chat interface | 4 | Streaming via AI SDK React, tool call groups, action card approval, email composer, file attach, citations, follow-up pills, thread persistence. |
| 9 | Sequences/campaigns UI | 4 | Campaign wizard, status badges, email stats, step count, enrolled count. |
| 10 | Meetings page | 4 | Calendar sync status, prep generation, transcript/notes, attendees, recording URL, upcoming/past filter. |
| 11 | Tasks page | 3 | CRUD inline, toggle completion, priority, due date. Basique mais fonctionnel. |
| 12 | Notes page | 3 | CRUD inline, entity linking. Basique. |
| 13 | Settings pages | 2 | Profile=4, mais 20+ tabs sont des placeholders sans fonctionnalite reelle. |
| 14 | Deliverability | 3 | Health score, sent/opened/replied/bounced/spam rates, warnings. Dashboard view. |
| 15 | Reports | 3 | Pipeline report, weekly report, win/loss report. Generation via LLM. |
| 16 | Custom objects | 3 | Dynamic type CRUD, 15 icon types, 6 field types. Basique mais extensible. |
| 17 | Responsive design | 4 | Tailwind mobile-first, grid breakpoints, CSS variables theming. |
| 18 | Loading states/skeletons | 4 | Skeletons sur toutes les pages principales, animate-pulse. |
| 19 | Error/empty states | 4 | Contextuels, role-aware, avec suggestions d'actions. |
| 20 | Keyboard shortcuts | 1 | **ABSENT.** Aucun raccourci clavier implemente. |
| 21 | Slide-over/detail panels | 4 | Action preview, 400px, slide-in-right animation, scroll content. |

**Moyenne Frontend: 3.4/5** — Core pages production-grade, settings en retard.

---

## B. DATA MODEL (6 competences)

| # | Competence | Score | Verdict |
|---|-----------|-------|---------|
| 22 | Schema completeness | 4 | 44+ tables, tous les entities GTM CRM couverts. chatThreads/Messages avec branching (CHAT-05). |
| 23 | Index quality | 5 | Tenant-first composite indexes, UNIQUE constraints, HNSW vector index. Strategique. |
| 24 | Multi-tenant isolation | 4 | tenantId FK NOT NULL sur toutes les tables business. App-layer + RLS migration prete (0028). |
| 25 | Audit trail | 3 | activities (entity changes) + toolCallEvents (chat mutations avec snapshot pour undo). Pas de signing cryptographique. |
| 26 | Soft delete | 2 | **CASCADE hard delete.** Pas de deletedAt. toolCallEvents permet undo mais pas de soft delete generique. |
| 27 | JSON vs relations | 3 | properties JSONB pour custom fields (pragmatique), core relations normalises (FK). Score hybride intentionnel. |

**Moyenne Data Model: 3.5/5** — Solide, indexes excellent, mais soft delete absent.

---

## C. API ROUTES (6 competences)

| # | Competence | Score | Verdict |
|---|-----------|-------|---------|
| 28 | Route count | N/A | 201 routes. Couverture large. |
| 29 | Auth enforcement | 4 | getAuthContext() + tenantId WHERE systematique. withAuthRLS() pour les routes migrees. |
| 30 | Rate limiting | 4 | IP-based middleware (200/min general, 10/min auth). User-level: LLM 20/min, enrich 30/min, bulk 5/min. Redis-backed. |
| 31 | Input validation | 3 | 190 instances Zod detectees. Pas systematique — certaines routes sans validation. |
| 32 | Error handling | 3 | 401/400/500 pattern. try/catch + console.warn. Pas de codes d'erreur structures. |
| 33 | Response format | 3 | Dual shape (legacy items + canonical pagination). Migration en cours. |

**Moyenne API: 3.4/5** — Auth solide, validation a renforcer.

---

## D. BACKGROUND JOBS (3 competences)

| # | Competence | Score | Verdict |
|---|-----------|-------|---------|
| 34 | Function count | N/A | 30+ Inngest functions. Couverture large (enrichment, sync, coaching, campaigns, signals). |
| 35 | Error handling/retry | 4 | retries: 2, onFailure dead letter handler, step.run() isolation, fallback chains (Apollo->LLM->mark unavailable). |
| 36 | Cron coverage | 4 | 5 Vercel crons (email-sync 15min, stale-deals, world-model, mailbox-reset, deal-progression). Inngest crons en plus. |

**Moyenne Background Jobs: 4/5** — Robuste.

---

## E. AI/LLM ENGINEERING (16 competences)

| # | Competence | Score | Verdict |
|---|-----------|-------|---------|
| 37 | System prompt quality | 5 | 318 lignes, personnalise, capabilities listees, forbidden phrases, coaching direct, citations obligatoires, multi-langue. |
| 38 | Shared rules library | 4 | Anti-hallucination, quality rubric, email rules. Importe largement. |
| 39 | Email few-shot examples | 5 | 10 golden examples, 4 methodologies (BASHO, Challenger, Problem-Solution, Product-Led), annotes "why-it-works". |
| 40 | Tool descriptions | 4 | Claires, actionnables, schemas Zod, exemples d'usage. 126 tools. |
| 41 | Capability resolver | 4 | Admin-only (16), destructive (12), pro-tier gated. Surface-aware prompt addenda. |
| 42 | Model routing | 4 | Sonnet primary, Haiku lightweight, GPT-4o fallback. Circuit breaker aware. EU routing pret. |
| 43 | Prompt injection defense | 4 | escapeForPrompt (500 chars, control chars), wrapUntrustedInput (XML quarantine, zero-width, 10k cap). |
| 44 | Context compaction | 3 | compactMessages() garde first + 24 recents, summarise le reste. Basique mais fonctionnel. |
| 45 | RAG pipeline | 4 | pgvector cosine + BM25 tsvector + RRF fusion (searchHybrid). Migration 0029 fulltext index. |
| 46 | Memory system | 4 | 6 categories, TTL 12 mois sur inferred, priority resolution, audit trail. |
| 47 | Flywheel few-shot | 3 | agentFewShotExamples table + curateFewShotExamples(). **Framework present mais boucle de feedback pas active.** |
| 48 | Eval framework | 3 | 13 grader types (llm_judge reel maintenant), eval-runner.ts. **Mais couverture eval datasets inconnue.** |
| 49 | Agent observability | 4 | AGENT_REGISTRY (25 agents), agentTraces, health status (critical/degraded/healthy), cost tracking. |
| 50 | Cost tracking | 4 | usage_events table, per-feature breakdown, cost per token. |
| 51 | LLM budget enforcement | 5 | Pre-dispatch check, monthly cap, 30s cache, BudgetExceededError, fails open. |
| 52 | Skills framework | 4 | 26 skills, 6 categories, handler.ts/schema.ts structure. Context-aware. |

**Moyenne AI/LLM: 4/5** — Point fort du produit.

---

## F. SECURITE (15 competences)

| # | Competence | Score | Verdict |
|---|-----------|-------|---------|
| 53 | Authentication | 4 | NextAuth v5, OAuth Google+Microsoft, credentials, timing-safe bcrypt, lockout, HIBP. |
| 54 | Authorization | 3 | admin/member roles. Capability resolver gate. Pas de permissions granulaires. |
| 55 | Tenant isolation (queries) | 4 | tenantId WHERE systematique. withAuthRLS() sur routes migrees. |
| 56 | PostgreSQL RLS | 3 | Migration 0028 existe, rls.ts existe, setTenantId() wire dans chat + 6 routes. Pas partout. |
| 57 | Prompt injection | 4 | Multi-couche. escapeForPrompt + wrapUntrustedInput + system prompt directives. |
| 58 | Rate limiting | 4 | 4 couches: IP middleware, user-level, per-feature, auth-specific. Upstash Redis. |
| 59 | Secrets management | 4 | .env.example documente, .gitignore exclut .env*, zero secrets commites. Sentry scrubbing. |
| 60 | Security headers | 5 | CSP strict, X-Frame-Options DENY, HSTS preload, COOP, Permissions-Policy complet. |
| 61 | GDPR endpoints | 4 | /api/gdpr/delete (cascade complete, confirmation header), /api/gdpr/export. SOC2 logging. |
| 62 | Audit logging | 3 | activities + toolCallEvents. Simple, sans signature cryptographique. Silent fail. |
| 63 | Trust score system | 5 | Progressive autonomy 0-1, decay 30j, asymmetric loss, audit trail, nudge gates. |
| 64 | Approval mode | 5 | 3 modes, per-action thresholds (email 0.85, sequence 1.1=never auto), legacy coercion. |
| 65 | Sending identity | 5 | Cold block default, daily cap, progressive warmup (5->15->30->cap), bounce monitoring. |
| 66 | MCP auth | 4 | bcrypt API keys, keyCreatedAt/keyOwnerId, audit logging auth/create/revoke. |
| 67 | Circuit breakers | 4 | Apollo 5/30s, Recall 3/60s, Anthropic with immediate OpenAI fallback. Per-isolate state. |

**Moyenne Securite: 4.1/5** — Point fort. Guardrails uniques.

---

## G. INFRASTRUCTURE (9 competences)

| # | Competence | Score | Verdict |
|---|-----------|-------|---------|
| 68 | Vercel deployment | 5 | vercel.json, 5 crons actifs, security headers. |
| 69 | Cron coverage | 4 | Vercel crons + Inngest crons. email-sync 15min, deal-progression 2x/jour, auto-briefing hourly. |
| 70 | Email infra (Resend) | 4 | Tracking pixel, click rewriting, CAN-SPAM footer, progressive warmup, bounce monitoring. |
| 71 | Meeting bot (Recall.ai) | 3 | createBot(), getBotStatus(), consent notification. Attribution WS-1. Profondeur integration moyenne. |
| 72 | Apollo integration | 4 | enrichOrganization, searchPeople, searchOrganizations. Circuit breaker. Multi-skill. |
| 73 | Stripe/billing | 2 | **STUB.** Schema billing existe, Stripe SDK importe, mais pas de subscription enforcement visible. |
| 74 | Calendar sync | 3 | OAuth scopes (Google calendar.readonly, Microsoft Calendars.Read). Cron 15min. Profondeur inconnue. |
| 75 | Email sync | 4 | Gmail readonly + Outlook Mail.Read. Cron 15min. Auto-contact creation. Sentiment analysis. |
| 76 | Worker service | 3 | apps/worker avec BullMQ. Send, reply, warmup, health workers. Deploiement separe. |

**Moyenne Infra: 3.6/5** — Solide sauf billing.

---

## H. DEVEX & PROCESS (8 competences)

| # | Competence | Score | Verdict |
|---|-----------|-------|---------|
| 77 | CI/CD pipeline | 3 | GitHub Actions cree (lint+tsc+test+eval), CODEOWNERS, PR template. **Pas encore push (scope token).** |
| 78 | Test coverage | 4 | 1228 tests, 118 fichiers, vitest + playwright. 35 nouveaux tests pour modules audit. |
| 79 | Eval gate au merge | 3 | Script eval:run existe. **Pas encore actif comme required check (CI pas deploy).** |
| 80 | Prompt versioning | 3 | agentPromptVersions table avec version counter, evalScore, isActive. Pas de UI visible. |
| 81 | Feature flags | 4 | experiments.ts, DB-backed, 4 flags actifs. Tenant-scoped. |
| 82 | CODEOWNERS | 4 | 8 critical paths proteges (prompts, agents, guardrails, evals, schema, mcp, chat). |
| 83 | Documentation | 2 | RUNBOOK.md existe (186 lignes). Pas de README, CONTRIBUTING, API docs. |
| 84 | Incident response | 3 | Template incident cree. Pas de postmortem existant. Pas d'on-call. |

**Moyenne DevEx: 3.3/5** — Fondations posees, pas encore active.

---

## I. BUSINESS MODEL & COMPLIANCE (8 competences)

| # | Competence | Score | Verdict |
|---|-----------|-------|---------|
| 85 | Pricing implementation | 2 | Pricing page UI existe (Free/Starter $49/Pro $99). **Stripe enforcement absent.** |
| 86 | Usage metering | 4 | usage_events table, per-feature tracking, budget caps. |
| 87 | GDPR compliance | 3 | Delete/export endpoints, privacy page, Sentry scrubbing. **Region pinning EU pret (code) mais pas active (env).** |
| 88 | DPA status | 1 | **AUCUN DPA signe verifiable.** Claims legales non prouvees. |
| 89 | Terms/Privacy pages | 4 | Comprehensive legal pages. GDPR rights, CAN-SPAM, data retention. |
| 90 | Consent mecanisms | 3 | Bot consent notification ajoutee. Pas d'opt-out mecanique (juste notification). |
| 91 | Data retention policy | 2 | Claim "30 jours post-cloture" en page privacy. **Aucun cron de purge dans le code.** |
| 92 | Compliance audit trail | 3 | GDPR delete logs SOC2 CC6.7. Audit-log.ts basique. |

**Moyenne Business/Compliance: 2.8/5** — Le plus faible pilier. Billing et DPA manquent.

---

## J. DIFFERENCIATION & MOAT (8 competences)

| # | Competence | Score | Verdict |
|---|-----------|-------|---------|
| 93 | Trust score system (unique) | 5 | Aucun concurrent n'a un systeme de calibration d'autonomie progressive avec decay. |
| 94 | 4-layer guardrails | 5 | capability-resolver + approval-mode + sending-identity + prompt-safety. Defense-in-depth unique. |
| 95 | Flywheel data (actif) | 3 | agentFewShotExamples + signalOutcomes + trustEvents. **Framework present, boucle pas encore active.** |
| 96 | Cross-tenant learning | 1 | **ABSENT.** Chaque tenant est isole. Pas de signal agrege anonymise. |
| 97 | Embeddings/fine-tuning custom | 1 | **ABSENT.** OpenAI text-embedding-3-small standard. Pas de fine-tuning. |
| 98 | MCP server standard | 4 | JSON-RPC 2.0, 11 tools CRM, bcrypt auth. Interoperabilite ecosystem. |
| 99 | Knowledge graph | 3 | contextGraphNodes/Edges avec bi-temporal (tValid/tInvalid). Structure ambitieuse, profondeur d'usage inconnue. |
| 100 | Switch cost / reproductibilite | 3 | Integration depth (126 tools, 26 skills, 30+ Inngest functions) = 6-12 mois a reproduire. Mais pas de donnee proprietaire irreproductible. |

**Moyenne Differenciation: 3.1/5** — Le trust system est unique, le reste est reproductible.

---

## SYNTHESE

| Categorie | Moyenne | Points forts | Trous |
|-----------|---------|-------------|-------|
| **A. Frontend UX** | 3.4 | Dashboard, chat, deals pipeline | Settings (20 tabs placeholder), keyboard shortcuts |
| **B. Data Model** | 3.5 | Indexes, tenant isolation | Soft delete absent |
| **C. API Routes** | 3.4 | Auth enforcement | Validation input partielle |
| **D. Background Jobs** | 4.0 | Error handling, retry, fallbacks | — |
| **E. AI/LLM** | 4.0 | System prompt, email examples, budget | Flywheel pas actif, eval couverture inconnue |
| **F. Securite** | 4.1 | Trust score, approval mode, sending identity | RLS partiel, audit non-signe |
| **G. Infra** | 3.6 | Vercel, email, Apollo | Stripe/billing stub |
| **H. DevEx** | 3.3 | Tests, feature flags | CI pas encore live, pas de docs |
| **I. Business** | 2.8 | Usage metering | **Billing stub, DPA absent, retention non enforcee** |
| **J. Differenciation** | 3.1 | Trust system unique | **Pas de donnee proprietaire, pas de fine-tuning, pas de cross-tenant learning** |

---

## SCORE GLOBAL : 3.5/5

**Ce qui fait qu'Elevay n'est PAS encore un top produit :**

1. **Billing/Stripe est un stub** (#73, #85) — Un utilisateur peut utiliser le produit sans jamais payer. Il n'y a pas d'enforcement des limites par tier.

2. **20 settings tabs sont des placeholders** (#13) — Un utilisateur qui clique sur "Workflows", "Notifications", "Privacy", "Billing" tombe sur une page vide. Ca casse la confiance.

3. **Pas de keyboard shortcuts** (#20) — Un power user (founder qui vit dans le produit) attend Cmd+K, raccourcis navigation.

4. **Le flywheel n'apprend pas encore** (#47, #95) — La structure existe (agentFewShotExamples) mais la boucle de feedback user -> meilleurs exemples n'est pas active.

5. **Zero DPA signe** (#88) — Les pages legales clament "DPA with all sub-processors" mais aucune preuve.

6. **Pas de data retention enforcement** (#91) — La privacy page dit "30 jours" mais il n'y a pas de cron de purge.

7. **Le knowledge graph est ambitieux mais sous-utilise** (#99) — contextGraphNodes/Edges bi-temporal existent, mais l'usage reel dans les flows est flou.

**Ce qui fait qu'Elevay est DEJA au-dessus du marche :**

1. **Trust score + 4-layer guardrails** (#63, #64, #65, #93, #94) — Aucun concurrent n'a ca. C'est le vrai moat.
2. **System prompt + email examples** (#37, #39) — Quality tier-1.
3. **126 tools avec capability resolver** (#40, #41) — Couverture massive, bien gatee.
4. **LLM budget enforcement** (#51) — Pas de surprise de cout.
5. **Security headers** (#60) — CSP best-in-class.
