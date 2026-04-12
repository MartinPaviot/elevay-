# Architecture Decision — Skills System for Elevay

## Decision: Lightweight skill modules in existing codebase

The Elevay codebase already has a mature architecture with:
- Strong observability (`traceAgent`, `AGENT_REGISTRY`, `SpanRecorder`)
- Event-driven processing (Inngest functions)
- Prospect context assembly (`buildProspectContext`)
- Scoring pipeline (`scoreContact`, `calculateFitScore`)
- Sequence generation (`generateSequence`)

**Decision**: Skills are simple modules that plug into the existing infrastructure. No new framework, no complex registry pattern. Each skill is a function that:
1. Takes typed input (Zod schema)
2. Uses existing Elevay libs (apollo-client, scoring, prospect-context, etc.)
3. Returns typed output (Zod schema)
4. Is wrapped in `traceAgent` for observability
5. Can be triggered via API route or Inngest event

## Structure de dossiers

```
apps/web/src/skills/
  types.ts           — Shared types: SkillDefinition, SkillResult, SkillRunOptions
  registry.ts        — Simple Map<string, SkillDefinition> + runSkill() function
  runner.ts          — Core runner: validation, dry-run, tracing, error wrapping, cost tracking
  
  enrichment/
    tam-builder/
      index.ts       — Export: skillDefinition + handler
      schema.ts      — Zod input/output schemas
      handler.ts     — Business logic using apollo-client.ts
      SKILL.md       — Documentation
    apollo-lead-finder/
      ...
    company-contact-finder/
      ...
    inbound-lead-enrichment/
      ...
  
  scoring/
    lead-qualification/
      ...
    icp-identification/
      ...
    inbound-lead-qualification/
      ...
  
  outreach/
    cold-email-outreach/
      ...
    email-drafting/
      ...
  
  signals/
    signal-scanner/
      ...
    contact-cache/
      ...
  
  intelligence/
    meeting-brief/
      ...
    sales-call-prep/
      ...
    pipeline-review/
      ...
    battlecard-generator/
      ...
    competitor-intel/
      ...
    sequence-performance/
      ...
    sales-coaching/
      ...
```

## Types partages

```typescript
// Based on existing Elevay patterns
import { z } from "zod";

interface SkillDefinition<TInput, TOutput> {
  slug: string;
  name: string;
  category: "enrichment" | "scoring" | "outreach" | "signals" | "intelligence";
  description: string;
  costEstimate: string;           // e.g., "1 Apollo credit per contact"
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  handler: (input: TInput, options: SkillRunOptions) => Promise<TOutput>;
}

interface SkillRunOptions {
  tenantId: string;
  dryRun: boolean;         // Default: true
  traceContext?: TraceContext;  // From observability.ts
}

interface SkillResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  dryRun: boolean;
  costIncurred?: number;
  duration: number;
}
```

## Pattern runner

The runner wraps each skill execution with:
1. **Input validation** — Zod parse on input
2. **Dry-run check** — If dryRun=true, validate input and return mock/estimate only
3. **Tracing** — Wrap in `traceAgent` from existing observability.ts
4. **Cost tracking** — Log to cost-tracker.ts
5. **Error wrapping** — Catch errors, return structured SkillResult

```typescript
async function runSkill<TInput, TOutput>(
  skill: SkillDefinition<TInput, TOutput>,
  rawInput: unknown,
  options: SkillRunOptions
): Promise<SkillResult<TOutput>> {
  // 1. Validate input
  const input = skill.inputSchema.parse(rawInput);
  
  // 2. Dry-run mode
  if (options.dryRun) {
    return { success: true, dryRun: true, duration: 0, data: undefined };
  }
  
  // 3. Trace + execute
  const start = Date.now();
  return traceAgent(
    { agentId: `skill-${skill.slug}`, tenantId: options.tenantId },
    async (span) => {
      span.setInput(JSON.stringify(input));
      const result = await skill.handler(input, options);
      span.setOutput(JSON.stringify(result));
      return { success: true, data: result, dryRun: false, duration: Date.now() - start };
    }
  );
}
```

## Registry

Simple Map — no factory, no DI:

```typescript
const SKILL_REGISTRY = new Map<string, SkillDefinition<any, any>>();

function registerSkill(skill: SkillDefinition<any, any>) {
  SKILL_REGISTRY.set(skill.slug, skill);
}

function getSkill(slug: string) {
  return SKILL_REGISTRY.get(slug);
}
```

Skills self-register in their index.ts via `registerSkill(definition)`.

## Integration avec Inngest

Skills can be triggered as Inngest functions:

```typescript
// In inngest/functions.ts
inngest.createFunction(
  { id: "skill-tam-builder", name: "TAM Builder Skill" },
  { event: "skill/tam-builder" },
  async ({ event, step }) => {
    const result = await runSkill(tamBuilderSkill, event.data.input, {
      tenantId: event.data.tenantId,
      dryRun: false,
    });
    return result;
  }
);
```

## Integration avec API routes

Skills are exposed via a single API route:

```typescript
// /api/skills/[slug]/route.ts
export async function POST(req, { params }) {
  const skill = getSkill(params.slug);
  const body = await req.json();
  const result = await runSkill(skill, body.input, {
    tenantId: session.tenantId,
    dryRun: body.dryRun ?? true,
  });
  return Response.json(result);
}
```

## Dry-run

Default mode. Every skill must support dry-run which:
- Validates input
- Returns cost estimate
- Returns expected output shape (empty/mock data)
- Does NOT call external APIs
- Does NOT write to database

## Why this architecture

1. **Matches existing patterns** — Elevay already uses function modules (apollo-client, scoring, etc.)
2. **Minimal new code** — Runner is ~50 lines, registry is ~10 lines, types is ~30 lines
3. **Reuses observability** — Every skill is traced via existing `traceAgent`
4. **Reuses validation** — Zod is already used throughout the project
5. **No dead code** — Every line is used by actual skill implementations
6. **Progressive** — Start with Wrappers around existing code, add new features later
