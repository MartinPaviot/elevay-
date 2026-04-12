import { z } from "zod";
import type { TraceContext } from "@/lib/observability";

// ─── Skill Categories ───────────────────────────────────────

export type SkillCategory =
  | "enrichment"
  | "scoring"
  | "outreach"
  | "signals"
  | "intelligence";

// ─── Skill Run Options ──────────────────────────────────────

export interface SkillRunOptions {
  tenantId: string;
  dryRun: boolean;
  traceContext?: TraceContext;
}

// ─── Skill Definition ───────────────────────────────────────

export interface SkillDefinition<TInput = unknown, TOutput = unknown> {
  slug: string;
  name: string;
  category: SkillCategory;
  description: string;
  costEstimate: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  handler: (input: TInput, options: SkillRunOptions) => Promise<TOutput>;
}

// ─── Skill Result ───────────────────────────────────────────

export interface SkillResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  dryRun: boolean;
  costIncurred?: number;
  durationMs: number;
  traceId?: string;
}
