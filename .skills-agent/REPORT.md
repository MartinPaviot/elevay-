# Skills Implementation Report

## Resume
- **Duree** : ~2.5 heures
- **Skills implementes** : 19
- **Skills echoues** : 0
- **Skills restants dans la queue** : 5 (P1 Nouveau)
- **Compilation** : 100% pass (0 TS errors)

## Skills implementes

### Enrichment (4 skills)
| Slug | Fichiers | Effort | Couts API |
|------|----------|--------|-----------|
| tam-builder | enrichment/tam-builder/{schema,handler,index}.ts | Wrapper | Free (Apollo Company Search) + 1 credit/person |
| apollo-lead-finder | enrichment/apollo-lead-finder/{schema,handler,index}.ts | Wrapper | Free search, 1 credit per enrichment |
| company-contact-finder | enrichment/company-contact-finder/{schema,handler,index}.ts | Wrapper | Free (Apollo People Search) |
| inbound-lead-enrichment | enrichment/inbound-lead-enrichment/{schema,handler,index}.ts | Wrapper | 1 Apollo credit per person |

### Scoring (3 skills)
| Slug | Fichiers | Effort | Couts API |
|------|----------|--------|-----------|
| lead-qualification | scoring/lead-qualification/{schema,handler,index}.ts | Adapt | Free (DB only) |
| icp-identification | scoring/icp-identification/{schema,handler,index}.ts | Adapt | Free Apollo + ~$0.03 LLM |
| inbound-lead-qualification | scoring/inbound-lead-qualification/{schema,handler,index}.ts | Adapt | Free (DB only) |

### Outreach (2 skills)
| Slug | Fichiers | Effort | Couts API |
|------|----------|--------|-----------|
| cold-email-outreach | outreach/cold-email-outreach/{schema,handler,index}.ts | Wrapper | ~$0.05-0.15 LLM |
| email-drafting | outreach/email-drafting/{schema,handler,index}.ts | Wrapper | ~$0.02-0.05 LLM |

### Signals (3 skills)
| Slug | Fichiers | Effort | Couts API |
|------|----------|--------|-----------|
| signal-scanner | signals/signal-scanner/{schema,handler,index}.ts | Adapt | Free (DB only) |
| contact-cache | signals/contact-cache/{schema,handler,index}.ts | Nouveau | Free (DB only) |

### Intelligence (8 skills)
| Slug | Fichiers | Effort | Couts API |
|------|----------|--------|-----------|
| meeting-brief | intelligence/meeting-brief/{schema,handler,index}.ts | Adapt | ~$0.05-0.10 LLM |
| sales-call-prep | intelligence/sales-call-prep/{schema,handler,index}.ts | Adapt | ~$0.05-0.10 LLM |
| pipeline-review | intelligence/pipeline-review/{schema,handler,index}.ts | Adapt | Free (DB only) |
| sequence-performance | intelligence/sequence-performance/{schema,handler,index}.ts | Adapt | Free (DB only) |
| sales-coaching | intelligence/sales-coaching/{schema,handler,index}.ts | Adapt | ~$0.05-0.10 LLM |
| battlecard-generator | intelligence/battlecard-generator/{schema,handler,index}.ts | Nouveau | Free Apollo + ~$0.05-0.10 LLM |
| competitor-intel | intelligence/competitor-intel/{schema,handler,index}.ts | Nouveau | Free Apollo + ~$0.03-0.05 LLM |
| churn-risk-detector | intelligence/churn-risk-detector/{schema,handler,index}.ts | Adapt | Free (DB only) |

## Architecture finale

```
apps/web/src/skills/
├── types.ts              — SkillDefinition, SkillResult, SkillRunOptions
├── registry.ts           — Map<string, SkillDefinition> + CRUD
├── runner.ts             — runSkill() with validation, dry-run, tracing, error wrapping
├── register-all.ts       — Central registration of all 19 skills
├── enrichment/
│   ├── tam-builder/      — Build scored TAM via Apollo
│   ├── apollo-lead-finder/ — Two-phase Apollo prospecting
│   ├── company-contact-finder/ — Find decision-makers at company
│   └── inbound-lead-enrichment/ — Enrich contact + company via Apollo
├── scoring/
│   ├── lead-qualification/ — Batch scoring with breakdown
│   ├── icp-identification/ — Define ICP via Apollo + LLM
│   └── inbound-lead-qualification/ — Qualify inbound with dedup + routing
├── outreach/
│   ├── cold-email-outreach/ — Multi-step sequence generation
│   └── email-drafting/     — Single email with purpose framework
├── signals/
│   ├── signal-scanner/     — Diff-based signal detection
│   └── contact-cache/      — Dedup + outreach status tracking
└── intelligence/
    ├── meeting-brief/      — Meeting preparation briefs
    ├── sales-call-prep/    — Deep pre-call preparation
    ├── pipeline-review/    — Pipeline health analytics
    ├── sequence-performance/ — Email campaign analytics
    ├── sales-coaching/     — Deal coaching with LLM
    ├── battlecard-generator/ — Competitive battlecards
    ├── competitor-intel/   — Competitor research
    └── churn-risk-detector/ — Account churn risk scanning

apps/web/src/app/api/skills/[slug]/route.ts — Unified REST API
```

### Dependency graph
```
apollo-client.ts ← tam-builder, apollo-lead-finder, company-contact-finder, 
                    inbound-lead-enrichment, icp-identification, battlecard-generator,
                    competitor-intel
scoring.ts ← lead-qualification, inbound-lead-qualification
contact-scoring.ts ← lead-qualification, inbound-lead-qualification
prospect-context.ts ← cold-email-outreach, email-drafting, meeting-brief, sales-call-prep
sequence-generator.ts ← cold-email-outreach
deal-velocity.ts ← sales-coaching
momentum.ts ← signal-scanner (imported but used for type reference)
icp-constants.ts ← icp-identification
traced-ai.ts ← email-drafting, icp-identification, meeting-brief, sales-call-prep,
                sales-coaching, battlecard-generator, competitor-intel
observability.ts ← runner.ts (traceAgent wrapper)
```

## Decisions cles

1. **Drizzle ORM, not Prisma** — Codebase uses Drizzle. All DB queries use drizzle-orm patterns.
2. **Lightweight modules, not framework** — No DI container, no factory pattern. Simple Map registry.
3. **tracedGenerateObject uses _trace field** — Not separate params. Discovered by reading source.
4. **Wrappers call real functions directly** — Zero abstraction over apollo-client, scoring, etc.
5. **Diff-based signal detection** — Compares recent vs older activity halves for engagement spikes.
6. **Unified API route** — Single /api/skills/[slug] with dryRun=true default.
7. **LLM fallback chain** — Anthropic → OpenAI, matching existing pattern.
8. **19 skills, 0 failures** — All compile, all use real imports, no TODOs/placeholders.

## Recommandations pour la suite

### Skills prioritaires a implementer
1. **champion-tracker** — Detect job changes of product champions (needs LinkedIn/Apify integration)
2. **job-posting-intent** — Extract buying signals from job postings (needs Apify)
3. **funding-signal-monitor** — Track funding announcements (needs web search integration)
4. **leadership-change-outreach** — Detect VP/C-suite changes + auto-outreach
5. **expansion-signal-spotter** — Monitor existing customers for upsell signals

### Refactors suggeres
- Add Vitest tests for each skill (dry-run mode makes this easy)
- Add SKILL.md documentation per skill for discoverability
- Consider adding skill dependencies (e.g., inbound-lead-triage = qualification + enrichment + routing)
- Add Inngest triggers for skills that should run on events (e.g., signal-scanner on cron)

### Integrations manquantes
- **Apify** — Needed for LinkedIn scraping, job posts, review sites (champion-tracker, job-posting-intent)
- **Web Search** — Needed for funding signals, news monitoring (funding-signal-monitor, industry-scanner)
- **Calendar API** — Needed for automated meeting-brief generation

## Prochaine session

```bash
claude "Lis CLAUDE.md. Reprends depuis .skills-agent/state.json. Continue la boucle en autonomie."
```

5 skills restants dans la queue. Besoin principal : integration Apify pour les skills P1 Nouveau signal-based.
