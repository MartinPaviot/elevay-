# Campaign Engine 1000x — Design

## System Fit

This module replaces/extends the existing campaign pipeline:

```
BEFORE:
  Campaign Wizard → buildProspectContext() → generateSequence() → fixed waterfall → send

AFTER:
  Signal/Trigger
       ↓
  Intelligence Brief (replaces buildProspectContext)
       ↓
  Strategy Selector (new — picks from 10 playbooks)
       ↓
  Content Generator (uses playbook-specific prompts)
       ↓
  Execution Gate (new — applies autonomy permissions)
       ↓
  Send / Queue for Approval / Schedule with delay
       ↓
  Outcome Tracking → Trust Score update → Evolution Engine (Phase 2)
```

### Integration Points

| Existing module | How it connects |
|---|---|
| `lib/prospect-context.ts` | `buildIntelligenceBrief()` supersedes `buildProspectContext()`. Existing callers migrate incrementally. |
| `lib/signal-detectors.ts` | Signals feed the Strategy Selector's activation conditions. Brief refresh triggered on new signal. |
| `lib/tam-stream/` | TAM build populates companies. Signal Monitor (Phase 2) re-checks signals continuously. |
| `db/schema.ts` (contextGraphNodes/Edges) | Warm Path Resolver traverses edges to find intro paths. |
| `db/schema.ts` (trustEvents) | Existing trust events extend to include campaign actions. System trust score aggregates from these. |
| `inngest/campaign-functions.ts` | Existing campaign prep fires Intelligence Brief generation. |
| `inngest/reply-handler.ts` | Feeds outcome data back to trust score and strategy metrics. |
| `app/api/campaigns/generate/route.ts` | Uses Intelligence Brief instead of `buildProspectContext`. |

---

## Data Model Changes

### New table: `intelligence_briefs`

```sql
CREATE TABLE intelligence_briefs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,

  -- Research results
  website_summary TEXT,
  recent_news JSONB DEFAULT '[]',
  job_postings JSONB DEFAULT '[]',
  tech_stack JSONB DEFAULT '[]',
  linkedin_activity JSONB,
  public_content JSONB DEFAULT '[]',
  competitor_detected TEXT,
  communication_style JSONB,

  -- LLM-derived synthesis
  pain_points JSONB DEFAULT '[]',
  best_angle TEXT,
  warmth_signals JSONB DEFAULT '[]',
  public_content_depth INTEGER DEFAULT 0,

  -- Source tracking
  sources_attempted INTEGER DEFAULT 0,
  sources_succeeded INTEGER DEFAULT 0,
  source_errors JSONB DEFAULT '[]',

  -- Freshness
  researched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Indexes
  CONSTRAINT uq_brief_company_contact UNIQUE(tenant_id, company_id, contact_id)
);

CREATE INDEX idx_briefs_tenant ON intelligence_briefs(tenant_id);
CREATE INDEX idx_briefs_expires ON intelligence_briefs(expires_at);
CREATE INDEX idx_briefs_company ON intelligence_briefs(company_id);
```

### New table: `outreach_playbooks`

```sql
CREATE TABLE outreach_playbooks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  strategy_type TEXT NOT NULL,
  -- One of: warm_intro, trigger_based, smykm, displacement, value_first,
  --         social_first, multi_thread, re_engagement, event_triggered, long_game
  is_active BOOLEAN DEFAULT true,
  custom_system_prompt TEXT,
  activation_overrides JSONB,

  -- Metrics (aggregated)
  total_sent INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_positive INTEGER DEFAULT 0,
  avg_reply_rate REAL,
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT uq_playbook_tenant_type UNIQUE(tenant_id, strategy_type)
);
```

### New table: `enrollment_strategy`

```sql
CREATE TABLE enrollment_strategy (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id TEXT NOT NULL REFERENCES sequence_enrollments(id) ON DELETE CASCADE,
  playbook_id TEXT NOT NULL REFERENCES outreach_playbooks(id),
  variant_id TEXT,

  -- Selection context
  selection_score REAL NOT NULL,
  selection_reason TEXT NOT NULL,
  alternatives_considered JSONB DEFAULT '[]',

  -- Warm path context
  warm_path_used BOOLEAN DEFAULT false,
  connector_contact_id TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT uq_enrollment_strategy UNIQUE(enrollment_id)
);
```

### New table: `autonomy_config`

```sql
CREATE TABLE autonomy_config (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'copilot',
  -- CHECK (level IN ('copilot', 'guided', 'autonomous', 'strategic'))

  permissions JSONB NOT NULL DEFAULT '{
    "coldEmailSend": "manual",
    "replyPositive": "manual",
    "replyObjection": "manual",
    "replyNegative": "auto_stop",
    "warmIntroSend": "manual",
    "linkedInActions": "draft_only",
    "newProspectAdd": "manual",
    "strategySwitch": "ask",
    "sequencePause": "ask"
  }',

  guardrails JSONB NOT NULL DEFAULT '{
    "maxEmailsPerDay": 40,
    "maxNewProspectsPerWeek": 25,
    "maxEmailsPerProspect": 5,
    "maxEmailsPerProspectDays": 21,
    "neverContact": [],
    "alwaysEscalateWhen": [],
    "sendWindow": {"start": "08:00", "end": "18:00", "days": ["mon","tue","wed","thu","fri"], "timezone": "recipient"},
    "language": "auto",
    "maxDailySpend": 5.0
  }',

  brand JSONB NOT NULL DEFAULT '{
    "writingStyle": "Direct and concise",
    "forbiddenWords": [],
    "signatureTemplate": "",
    "formalityLevel": "match_prospect"
  }',

  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### New table: `system_trust_score`

```sql
CREATE TABLE system_trust_score (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  overall REAL NOT NULL DEFAULT 50.0,
  per_playbook JSONB DEFAULT '{}',
  per_action JSONB DEFAULT '{}',
  actions_count INTEGER DEFAULT 0,
  approvals_without_edit INTEGER DEFAULT 0,
  rejections INTEGER DEFAULT 0,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  last_downgrade_at TIMESTAMPTZ,
  last_upgrade_at TIMESTAMPTZ
);
```

### New table: `content_variants`

```sql
CREATE TABLE content_variants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  playbook_id TEXT NOT NULL REFERENCES outreach_playbooks(id) ON DELETE CASCADE,
  segment TEXT,
  prompt_hash TEXT NOT NULL,
  mutation_type TEXT,
  is_baseline BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Metrics
  sent INTEGER DEFAULT 0,
  opened INTEGER DEFAULT 0,
  replied INTEGER DEFAULT 0,
  positive_replied INTEGER DEFAULT 0,
  meetings_booked INTEGER DEFAULT 0,
  reply_rate REAL,
  positive_rate REAL,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_variants_playbook ON content_variants(playbook_id, is_active);
CREATE INDEX idx_variants_tenant ON content_variants(tenant_id);
```

---

## API Contracts

### POST /api/campaign-engine/research

Generates an Intelligence Brief for a company/contact pair.

**Request:**
```typescript
{
  companyId: string;
  contactId?: string;       // optional — enriches with contact-specific data
  forceRefresh?: boolean;   // bypass cache
}
```

**Response (200):**
```typescript
{
  brief: IntelligenceBrief;
  cached: boolean;
  generationTimeMs: number;
}
```

**Response (202 — generation in progress):**
```typescript
{
  status: "generating";
  estimatedMs: number;
}
```

**Errors:**
- 404: Company not found or not in tenant
- 429: Too many concurrent brief generations (max 5 per tenant)

---

### GET /api/campaign-engine/strategy

Returns ranked strategy recommendations for a prospect.

**Query params:**
```
companyId: string (required)
contactId: string (optional)
```

**Response (200):**
```typescript
{
  candidates: Array<{
    strategyId: string;      // e.g. "warm_intro", "trigger_based"
    score: number;           // 0-100
    reason: string;          // human-readable
    activationFactors: string[];
  }>;
  briefUsed: { id: string; researchedAt: string };
  warmPathAvailable: boolean;
  signalsActive: string[];
}
```

**Errors:**
- 404: Company not found
- 409: Brief not yet generated (client should call /research first)

---

### PUT /api/settings/autonomy

Updates the tenant's autonomy configuration.

**Request:**
```typescript
{
  level?: "copilot" | "guided" | "autonomous" | "strategic";
  permissions?: Partial<PermissionsMap>;
  guardrails?: Partial<GuardrailsConfig>;
  brand?: Partial<BrandConfig>;
}
```

**Response (200):**
```typescript
{
  config: AutonomyConfig;   // full merged config
  trustScore: number;       // current score
  levelChangeApplied: boolean;
}
```

**Errors:**
- 403: Cannot upgrade to Strategic if trust score < 80
- 400: Invalid guardrail values (e.g. maxEmailsPerDay < 0)

---

### GET /api/campaign-engine/trust-score

Returns the current trust score with breakdown.

**Response (200):**
```typescript
{
  overall: number;
  trend: "rising" | "stable" | "falling";
  actionsCount: number;
  approvalsWithoutEdit: number;
  rejections: number;
  perPlaybook: Record<string, number>;
  suggestedLevel: AutonomyLevel;
  readyForUpgrade: boolean;
  shouldDowngrade: boolean;
  recentEvents: Array<{
    type: string;
    delta: number;
    reason: string;
    createdAt: string;
  }>;
}
```

---

## Data Flow

### Intelligence Brief Generation

```
1. Caller invokes POST /api/campaign-engine/research { companyId, contactId }
2. Check cache: SELECT from intelligence_briefs WHERE company_id AND contact_id AND expires_at > now()
3. If cache hit → return immediately
4. If cache miss → launch parallel research:
   a. fetchAndParseWebsite(company.domain)     // cheerio + LLM summarize
   b. fetchRecentNews(company.name)            // NewsAPI or RSS
   c. scrapeJobPostings(company.domain)        // careers page detect + parse
   d. detectTechStack(company.domain)          // wappalyzer-core
   e. fetchLinkedInActivity(contact.linkedinUrl) // public profile scrape
5. Collect results via Promise.allSettled (soft-fail per source)
6. LLM synthesis: Claude Sonnet → structured brief (pain points, best angle, etc.)
7. UPSERT into intelligence_briefs
8. Return brief
```

### Strategy Selection

```
1. Caller invokes GET /api/campaign-engine/strategy?companyId=X&contactId=Y
2. Load Intelligence Brief (must exist — 409 if not)
3. Load warm path data: BFS on context_graph_edges from team nodes to target
4. Load active signals: from companies.properties.signals + custom signals
5. Load competitor detection: from brief.competitorDetected
6. Load previous outreach history: from sequence_enrollments for this contact
7. Run deterministic scoring (no LLM):
   - For each of 10 playbooks, compute activation score based on conditions
   - Apply penalties (previous failure with this strategy: -20)
   - Apply channel exclusions (opted-out channels)
8. Sort by score, return top 3
```

### Execution Gate (Autonomy Filter)

```
1. Decision Engine produces an action (send email, reply, request intro, etc.)
2. Execution Gate receives: { action, enrollment, autonomyConfig, trustScore }
3. Check guardrails (hard limits):
   - Daily email count < maxEmailsPerDay?
   - Prospect not in neverContact?
   - Deal value escalation rule?
   → If violated: BLOCK + notify user
4. Check escalation rules:
   - Does the action match any alwaysEscalateWhen rule?
   → If yes: queue for approval
5. Check permission for this action type:
   - "manual" → queue for approval
   - "delayed" → schedule with timer, notify user
   - "auto" → execute immediately
6. Log the decision (action, permission applied, outcome)
7. Update trust score based on outcome (approval/rejection/result)
```

---

## Failure Handling

| Failure mode | Handling |
|---|---|
| Website scrape timeout (>10s) | Skip source, continue with others. Log in `source_errors`. |
| Website returns 403/challenge | Skip. Set `websiteSummary: null`. |
| News API rate limit | Use cached results if <7d old, else return `[]`. |
| All sources fail | Return minimal brief with only DB-known data (company name, industry, size). Mark `sources_succeeded: 0`. Strategy Selector will only offer Long Game. |
| LLM timeout during synthesis | Return raw source data as-is without LLM-derived fields (pain_points, best_angle will be null). |
| LLM returns malformed JSON | Retry once with explicit schema reminder. If still fails, return partial. |
| Strategy Selector: no brief exists | Return 409 with instruction to call /research first. |
| Autonomy config missing | Auto-create with copilot defaults on first access. |
| Trust score below 0 | Clamp to 0. Auto-downgrade to copilot. Notify. |
| Concurrent brief generation | Deduplicate: if a brief generation is already in-flight for this company, return 202 with estimated completion. |

---

## Security Considerations

- Intelligence briefs are tenant-isolated (all queries include tenant_id filter)
- Web scraping respects robots.txt for the company's domain
- LLM prompts never include data from other tenants
- Trust score cannot be manually set (only computed from events)
- Guardrails cannot be bypassed programmatically (enforced at Execution Gate layer, not client-side)
- Rate limit on brief generation: max 5 concurrent per tenant, 200/day total

---

## TypeScript Interfaces

```typescript
// lib/campaign-engine/types.ts

export interface IntelligenceBrief {
  id: string;
  tenantId: string;
  companyId: string;
  contactId: string | null;
  websiteSummary: string | null;
  recentNews: NewsItem[];
  jobPostings: JobPosting[];
  techStack: TechEntry[];
  linkedinActivity: LinkedInActivity | null;
  publicContent: PublicContentPiece[];
  competitorDetected: string | null;
  communicationStyle: CommunicationStyle | null;
  painPoints: string[];
  bestAngle: string | null;
  warmthSignals: WarmthSignal[];
  publicContentDepth: number;
  sourcesAttempted: number;
  sourcesSucceeded: number;
  sourceErrors: SourceError[];
  researchedAt: string;
  expiresAt: string;
}

export interface NewsItem {
  title: string;
  date: string;
  summary: string;
  url: string;
  relevance: "high" | "medium" | "low";
}

export interface JobPosting {
  title: string;
  department: string | null;
  senioritySignal: string | null; // "hiring VP Sales" = buying signal
  url: string | null;
  detectedAt: string;
}

export interface TechEntry {
  tool: string;
  category: string; // "analytics", "crm", "email", "hosting", etc.
  confidence: "high" | "medium" | "low";
}

export interface LinkedInActivity {
  postsPerWeek: number;
  recentTopics: string[];
  tone: "formal" | "casual" | "technical" | "thought-leader";
  lastPostDate: string | null;
}

export interface PublicContentPiece {
  type: "linkedin_post" | "blog_post" | "podcast" | "talk" | "tweet";
  title: string;
  quote: string; // citable snippet
  url: string;
  date: string;
}

export interface StrategyCandidate {
  strategyId: StrategyType;
  score: number;
  reason: string;
  activationFactors: string[];
}

export type StrategyType =
  | "warm_intro"
  | "trigger_based"
  | "smykm"
  | "displacement"
  | "value_first"
  | "social_first"
  | "multi_thread"
  | "re_engagement"
  | "event_triggered"
  | "long_game";

export type AutonomyLevel = "copilot" | "guided" | "autonomous" | "strategic";

export type PermissionValue = "manual" | "delayed" | "auto" | "auto_if_preapproved" | "auto_if_icp_match" | "draft_only" | "ask" | "auto_with_log" | "auto_with_notification" | "auto_stop";

export interface AutonomyConfig {
  level: AutonomyLevel;
  permissions: Record<string, PermissionValue>;
  guardrails: GuardrailsConfig;
  brand: BrandConfig;
}

export interface GuardrailsConfig {
  maxEmailsPerDay: number;
  maxNewProspectsPerWeek: number;
  maxEmailsPerProspect: number;
  maxEmailsPerProspectDays: number;
  neverContact: string[];
  alwaysEscalateWhen: EscalationRule[];
  sendWindow: { start: string; end: string; days: string[]; timezone: "recipient" | string };
  language: "auto" | string;
  maxDailySpend: number;
}

export interface EscalationRule {
  id: string;
  condition: EscalationCondition;
  action: "escalate" | "pause" | "stop";
  label: string; // human-readable name shown in UI
}

export type EscalationCondition =
  | { type: "deal_value_above"; threshold: number }
  | { type: "prospect_seniority"; levels: string[] }
  | { type: "reply_contains"; keywords: string[] }
  | { type: "reply_sentiment"; sentiment: "negative" | "angry" }
  | { type: "prospect_in_network"; degree: number }
  | { type: "retry_count_above"; count: number }
  | { type: "competitor_mentioned" };

export interface BrandConfig {
  writingStyle: string;
  forbiddenWords: string[];
  signatureTemplate: string;
  formalityLevel: "casual" | "professional" | "match_prospect";
}
```
