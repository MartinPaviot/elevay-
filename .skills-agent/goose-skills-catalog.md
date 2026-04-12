# Goose Skills Catalog — Filtered for Elevay Relevance

## CAPABILITIES (Atomic skills)

### apollo-lead-finder
- **Type**: capability
- **Ce que ca fait**: Two-phase Apollo prospecting — free People Search then paid enrichment
- **APIs utilisees**: Apollo API (People Search free, Bulk Match 1 credit/contact)
- **Pattern interessant**: Separates free discovery from paid enrichment for cost control
- **Pertinent pour Elevay**: oui — wraps existing apollo-client.ts

### champion-tracker
- **Type**: capability
- **Ce que ca fait**: Track product champions for job changes, qualify new companies against ICP
- **APIs utilisees**: Apify LinkedIn profile enrichment, CSV
- **Pattern interessant**: Baseline snapshot then diff-based change detection; ICP 0-4 scoring
- **Pertinent pour Elevay**: oui — champion signals feed into scoring pipeline

### cold-email-outreach
- **Type**: capability
- **Ce que ca fait**: End-to-end cold email campaign: lead ingestion, sequence design, email gen, launch
- **APIs utilisees**: Smartlead MCP, CSV export for Instantly/Lemlist/Apollo
- **Pattern interessant**: Tool-agnostic adapter pattern — same logic exports to 5+ platforms
- **Pertinent pour Elevay**: oui — maps to existing sequence feature

### company-contact-finder
- **Type**: capability
- **Ce que ca fait**: Find decision-makers at a specific company
- **APIs utilisees**: Crustdata, SixtyFour via Gooseworks MCP
- **Pattern interessant**: Three-layer fallback until 3+ quality matches found
- **Pertinent pour Elevay**: oui — uses apollo searchPeople as primary

### competitor-post-engagers
- **Type**: capability
- **Ce que ca fait**: Find leads by scraping engagers from competitor LinkedIn posts
- **APIs utilisees**: Apify harvestapi/linkedin-company-posts, Apollo
- **Pattern interessant**: Scrapes all posts, locally ranks top N, extracts only those engagers
- **Pertinent pour Elevay**: oui — signal detection for scoring

### contact-cache
- **Type**: capability
- **Ce que ca fait**: CSV-backed contact dedup database
- **APIs utilisees**: CSV file system, SHA256 hashing
- **Pattern interessant**: Dedup by LinkedIn URL or email with status lifecycle
- **Pertinent pour Elevay**: oui — dedup logic for contact management

### customer-discovery
- **Type**: capability
- **Ce que ca fait**: Find all customers of a company by scanning public data sources
- **APIs utilisees**: WebSearch, WebFetch, Wayback Machine, Apify review scrapers, BuiltWith
- **Pattern interessant**: Multi-source triangulation with confidence scoring
- **Pertinent pour Elevay**: oui — competitive intel

### email-drafting
- **Type**: capability
- **Ce que ca fait**: Write cold emails using structured frameworks
- **APIs utilisees**: None (pure reasoning)
- **Pattern interessant**: 8 proven templates with "why it works" annotations; 10 hard rules
- **Pertinent pour Elevay**: oui — email generation engine

### icp-identification
- **Type**: capability
- **Ce que ca fait**: Research company, define ICP, route to TAM building or lead finding
- **APIs utilisees**: WebSearch, WebFetch
- **Pattern interessant**: Entry-point orchestrator with inclusion AND exclusion criteria
- **Pertinent pour Elevay**: oui — ICP definition feeds scoring engine

### job-posting-intent
- **Type**: capability
- **Ce que ca fait**: Detect buying intent from job postings
- **APIs utilisees**: Apify LinkedIn job search, Google Sheets
- **Pattern interessant**: Job = budget signal; auto-suggests decision-maker title and outreach angle
- **Pertinent pour Elevay**: oui — hiring signals for signal detection

### landing-page-intel
- **Type**: capability
- **Ce que ca fait**: Extract competitor intel from landing page HTML
- **APIs utilisees**: HTTP requests only (free)
- **Pattern interessant**: Single-page deep scan: ad pixels, chat widgets, CDPs, hidden elements
- **Pertinent pour Elevay**: oui — competitive intel and prospect research

### lead-qualification
- **Type**: capability
- **Ce que ca fait**: Qualify leads with conversational intake, batch enrichment, parallel scoring
- **APIs utilisees**: Apify LinkedIn, LLM scoring
- **Pattern interessant**: Three-mode operation; parallelized scoring in 15-lead batches
- **Pertinent pour Elevay**: oui — lead scoring is core

### linkedin-outreach
- **Type**: capability
- **Ce que ca fait**: End-to-end LinkedIn outreach with Supabase integration
- **APIs utilisees**: Supabase, CSV export for Dripify/Botdog/Expandi/PhantomBuster
- **Pattern interessant**: 84-day cross-channel cooldown enforcement
- **Pertinent pour Elevay**: oui — multi-channel outreach with cooldown

### pain-language-engagers
- **Type**: capability
- **Ce que ca fait**: Find warm leads from LinkedIn pain-language posts and their engagers
- **APIs utilisees**: Apify (post search, company posts, profile scraper)
- **Pattern interessant**: Searches PAIN language not SOLUTION language
- **Pertinent pour Elevay**: oui — pain-signal detection for scoring

### review-site-scraper
- **Type**: capability
- **Ce que ca fait**: Scrape reviews from G2, Capterra, Trustpilot
- **APIs utilisees**: Apify (3 platform-specific actors)
- **Pattern interessant**: Normalized output across 3 platforms; G2 includes reviewer company/size
- **Pertinent pour Elevay**: oui — competitive intel

### signal-scanner
- **Type**: capability
- **Ce que ca fait**: Detect buying signals across TAM using diff-based detection + Apify
- **APIs utilisees**: Supabase, Apify (job search, LinkedIn), Apollo
- **Pattern interessant**: Three-phase: free diff signals, Apify-powered signals, post-processing
- **Pertinent pour Elevay**: oui — core signal detection pipeline

### tam-builder
- **Type**: capability
- **Ce que ca fait**: Build scored TAM using Apollo Company Search
- **APIs utilisees**: Apollo Company Search (free), Apollo People Search (free)
- **Pattern interessant**: Three modes (build/refresh/status); 0-100 scoring with tier assignment
- **Pertinent pour Elevay**: oui — TAM building directly maps to existing feature

### tech-stack-teardown
- **Type**: capability
- **Ce que ca fait**: Reverse-engineer company's sales/marketing tech stack from public signals
- **APIs utilisees**: DNS records, website HTML, Apify
- **Pattern interessant**: Detects CRMs, email tools from DNS SPF/DKIM records
- **Pertinent pour Elevay**: oui — prospect research

## COMPOSITES (Multi-skill chains)

### battlecard-generator
- **Type**: composite
- **Ce que ca fait**: Research competitor and produce structured sales battlecard
- **Pattern interessant**: Positioning traps, objection handlers, landmine questions
- **Pertinent pour Elevay**: oui — competitive deal coaching

### champion-move-outreach
- **Type**: composite
- **Ce que ca fait**: Champion job-change detection + personalized outreach
- **Pattern interessant**: Tool-agnostic composite: any source + detection + outreach
- **Pertinent pour Elevay**: oui — champion tracking for pipeline

### churn-risk-detector
- **Type**: composite
- **Ce que ca fait**: Scan support/usage data to flag churn risk accounts
- **Pattern interessant**: Weekly risk scorecard with severity tiers and save plays
- **Pertinent pour Elevay**: oui — customer health signals

### competitor-intel
- **Type**: composite
- **Ce que ca fait**: Deep competitor research across web, Reddit, Twitter, LinkedIn
- **Pattern interessant**: Builds profiles with content tracking, positioning changes, gaps
- **Pertinent pour Elevay**: oui — competitive intelligence

### customer-win-back-sequencer
- **Type**: composite
- **Ce que ca fait**: Research churned accounts for win-back sequences
- **Pattern interessant**: Researches what changed since churn for re-engagement
- **Pertinent pour Elevay**: oui — win-back sales workflow

### expansion-signal-spotter
- **Type**: composite
- **Ce que ca fait**: Monitor customers for upsell/cross-sell signals
- **Pattern interessant**: Weekly expansion list with context and talk tracks
- **Pertinent pour Elevay**: oui — expansion revenue signals

### funding-signal-outreach
- **Type**: composite
- **Ce que ca fait**: Detect funding events, qualify, find people, draft outreach
- **Pattern interessant**: Signal-to-outreach pipeline
- **Pertinent pour Elevay**: oui — signal-to-outreach

### hiring-signal-outreach
- **Type**: composite
- **Ce que ca fait**: Detect job postings, find hiring managers, draft outreach
- **Pattern interessant**: "before you fill that [role]..." hook
- **Pertinent pour Elevay**: oui — hiring signal to outreach

### inbound-lead-enrichment
- **Type**: composite
- **Ce que ca fait**: Fill missing data for inbound leads
- **Pattern interessant**: Tool-agnostic; checks for existing relationships
- **Pertinent pour Elevay**: oui — inbound lead enrichment

### inbound-lead-qualification
- **Type**: composite
- **Ce que ca fait**: Qualify inbound leads against ICP with company/role/fit
- **Pattern interessant**: CRM dedup check; scored CSV with reasoning
- **Pertinent pour Elevay**: oui — inbound qualification

### inbound-lead-triage
- **Type**: composite
- **Ce que ca fait**: Triage all inbound leads: classify, qualify, enrich, prioritize
- **Pattern interessant**: Handles demo requests, trials, content downloads in one pass
- **Pertinent pour Elevay**: oui — inbound routing

### industry-scanner
- **Type**: composite
- **Ce que ca fait**: Daily industry intelligence scanning
- **Pattern interessant**: Comprehensive briefing plus strategic GTM opportunities
- **Pertinent pour Elevay**: oui — proactive business intelligence

### leadership-change-outreach
- **Type**: composite
- **Ce que ca fait**: Detect leadership changes (VP+, C-suite hires) + outreach
- **Pattern interessant**: Apollo free search for detection + paid enrichment for confirmed
- **Pertinent pour Elevay**: oui — leadership change signals

### meeting-brief
- **Type**: composite
- **Ce que ca fait**: Calendar check, attendee research, personalized briefs
- **Pattern interessant**: Automated morning routine per attendee
- **Pertinent pour Elevay**: oui — meeting prep is core feature

### news-signal-outreach
- **Type**: composite
- **Ce que ca fait**: Take news event, evaluate ICP fit, find people, draft outreach
- **Pattern interessant**: Accepts any news trigger; maps to product connection
- **Pertinent pour Elevay**: oui — news-triggered outbound

### pipeline-review
- **Type**: composite
- **Ce que ca fait**: Analyze deal/meeting data for pipeline health
- **Pattern interessant**: Tool-agnostic diagnostics: volume, qualification, velocity, stuck deals
- **Pertinent pour Elevay**: oui — pipeline analysis core feature

### sales-call-prep
- **Type**: composite
- **Ce que ca fait**: Pre-call deep dive on person AND company with product-mapped talking points
- **Pattern interessant**: Maps findings to product for objection prep
- **Pertinent pour Elevay**: oui — sales call preparation

### sales-coaching
- **Type**: composite
- **Ce que ca fait**: AI sales coach analyzing campaigns, calls, replies, pipeline
- **Pattern interessant**: Pattern-finding in top performers
- **Pertinent pour Elevay**: oui — deal coaching

### sequence-performance
- **Type**: composite
- **Ce que ca fait**: Email sequence performance review with copy analysis
- **Pattern interessant**: Reads actual copy alongside metrics; analyzes reply content
- **Pertinent pour Elevay**: oui — sequence analytics

### company-current-gtm-analysis
- **Type**: composite
- **Ce que ca fait**: Comprehensive GTM analysis of any company across 10+ dimensions
- **Pattern interessant**: Content, founder activity, SEO, hiring, social, reviews, positioning
- **Pertinent pour Elevay**: oui — prospect/competitive research

### funding-signal-monitor
- **Type**: composite
- **Ce que ca fait**: Monitor web for Series A-C funding announcements
- **Pattern interessant**: Aggregates from 5+ sources; filters by stage/amount/industry
- **Pertinent pour Elevay**: oui — funding signals for scoring

## PLAYBOOKS (Recurring workflows)

### outbound-prospecting-engine
- **Type**: playbook
- **Ce que ca fait**: Full outbound: signal detection -> research -> contacts -> personalize -> launch
- **Pattern interessant**: The "full engine" — orchestrates entire outbound flow
- **Pertinent pour Elevay**: oui — this IS what Elevay does

### signal-detection-pipeline
- **Type**: playbook
- **Ce que ca fait**: Multi-source signal detection, qualification, outreach context
- **Pattern interessant**: Multi-signal fusion from different sources for higher confidence
- **Pertinent pour Elevay**: oui — multi-signal detection for scoring

### competitor-monitoring-system
- **Type**: playbook
- **Ce que ca fait**: Ongoing competitive intelligence monitoring setup
- **Pattern interessant**: Establishes monitoring cadence, not one-shot
- **Pertinent pour Elevay**: oui — ongoing competitive monitoring

## PACKS (lead-gen-devtools)

### community-signals
- **Type**: pack
- **Ce que ca fait**: Extract leads from HN/Reddit by detecting intent signals
- **Pattern interessant**: Scores by intent AND cross-platform presence
- **Pertinent pour Elevay**: oui — community intent signals

### competitor-signals
- **Type**: pack
- **Ce que ca fait**: Extract leads from competitor PH activity, HN, case studies, switching signals
- **Pattern interessant**: Detects people actively switching from competitors
- **Pertinent pour Elevay**: oui — competitor-switching signals

### lead-discovery
- **Type**: pack
- **Ce que ca fait**: Orchestrator: gathers context, identifies competitors, builds ICP, routes
- **Pattern interessant**: Entry-point that pre-configures all downstream skills
- **Pertinent pour Elevay**: oui — orchestration pattern
