# Mapping Matrix — Goose Skills → Elevay

## Priority Legend
- **P0**: Core GTM flow (TAM, enrichment, scoring, outreach) — first
- **P1**: Competitive intel, signals, monitoring — high business impact
- **P2**: Nice-to-have, scraping, content

## Effort Legend
- **Wrapper** (<1h): Code exists in Elevay, just wrap it as a skill
- **Adapt** (1-2h): Code partially exists, needs adaptation
- **Nouveau** (2-3h): Build from scratch using existing infra

| Skill goose-skills | Existe dans Elevay ? | Fichier(s) Elevay | Effort | Priorite |
|---|---|---|---|---|
| tam-builder | Oui — apollo search + /api/tam/ | apollo-client.ts, /api/tam/ | Wrapper | P0 |
| apollo-lead-finder | Oui — enrichPerson/searchPeople exist | apollo-client.ts | Wrapper | P0 |
| company-contact-finder | Oui — searchPeople with org domain | apollo-client.ts | Wrapper | P0 |
| lead-qualification | Partiel — scoreContact exists, pas le batch parallel | contact-scoring.ts, scoring.ts | Adapt | P0 |
| icp-identification | Partiel — icp-constants.ts + /api/settings/icp/ | icp-constants.ts | Adapt | P0 |
| cold-email-outreach | Oui — sequence-generator + sequences | sequence-generator.ts, /api/sequences/ | Wrapper | P0 |
| email-drafting | Oui — sequence-generator handles this | sequence-generator.ts | Wrapper | P0 |
| signal-scanner | Partiel — momentum.ts + signals API, pas le diff-based | momentum.ts, /api/signals/ | Adapt | P0 |
| contact-cache | Non — dedup logic not centralized | — | Nouveau | P0 |
| inbound-lead-enrichment | Oui — enrich endpoints exist | /api/enrich/, apollo-client.ts | Wrapper | P0 |
| inbound-lead-qualification | Partiel — scoring exists, not inbound-specific routing | contact-scoring.ts | Adapt | P0 |
| inbound-lead-triage | Non — no unified triage flow | — | Nouveau | P1 |
| meeting-brief | Partiel — /api/meetings/prep/ exists | /api/meetings/prep/ | Adapt | P1 |
| sales-call-prep | Partiel — prospect-context.ts provides data | prospect-context.ts | Adapt | P1 |
| pipeline-review | Partiel — /api/pipeline/analytics/ exists | deal-velocity.ts | Adapt | P1 |
| sequence-performance | Partiel — outbound email tracking exists | /api/emails/, outboundEmails table | Adapt | P1 |
| battlecard-generator | Non — no battlecard feature | — | Nouveau | P1 |
| competitor-intel | Non — no structured competitor research | — | Nouveau | P1 |
| sales-coaching | Partiel — deal analysis exists | /api/deals/analyze/ | Adapt | P1 |
| champion-tracker | Non — no champion tracking | — | Nouveau | P1 |
| job-posting-intent | Non — no job posting signal detection | — | Nouveau | P1 |
| funding-signal-monitor | Non — no funding signal detection | — | Nouveau | P1 |
| funding-signal-outreach | Non — needs funding-signal-monitor first | — | Nouveau | P1 |
| hiring-signal-outreach | Non — needs job-posting-intent first | — | Nouveau | P1 |
| leadership-change-outreach | Non — needs Apollo people search diff | apollo-client.ts | Adapt | P1 |
| news-signal-outreach | Non — no news signal detection | — | Nouveau | P1 |
| expansion-signal-spotter | Non — no expansion signal detection | — | Nouveau | P1 |
| churn-risk-detector | Partiel — deal velocity has risk detection | deal-velocity.ts | Adapt | P1 |
| customer-win-back-sequencer | Non — no win-back workflow | — | Nouveau | P2 |
| customer-discovery | Non — no customer discovery feature | — | Nouveau | P2 |
| landing-page-intel | Non — no landing page analysis | — | Nouveau | P2 |
| tech-stack-teardown | Non — no tech stack detection | — | Nouveau | P2 |
| competitor-post-engagers | Non — no LinkedIn engagement scraping | — | Nouveau | P2 |
| pain-language-engagers | Non — no pain language detection | — | Nouveau | P2 |
| review-site-scraper | Non — no review scraping | — | Nouveau | P2 |
| linkedin-outreach | Non — no LinkedIn outreach feature | — | Nouveau | P2 |
| company-current-gtm-analysis | Non — no GTM analysis feature | — | Nouveau | P2 |
| industry-scanner | Non — no industry scanning | — | Nouveau | P2 |

## Summary
- **Wrapper (P0)**: 6 skills — tam-builder, apollo-lead-finder, company-contact-finder, cold-email-outreach, email-drafting, inbound-lead-enrichment
- **Adapt (P0)**: 4 skills — lead-qualification, icp-identification, signal-scanner, inbound-lead-qualification
- **Nouveau (P0)**: 1 skill — contact-cache
- **Adapt (P1)**: 6 skills — meeting-brief, sales-call-prep, pipeline-review, sequence-performance, sales-coaching, churn-risk-detector
- **Nouveau (P1)**: 8 skills — inbound-lead-triage, battlecard-generator, competitor-intel, champion-tracker, job-posting-intent, funding-signal-monitor, leadership-change-outreach, news-signal-outreach, expansion-signal-spotter, hiring-signal-outreach, funding-signal-outreach
- **P2**: 10+ skills
