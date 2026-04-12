import { ZodError } from "zod";
import { traceAgent } from "@/lib/observability";
import type { SkillDefinition, SkillRunOptions, SkillResult } from "./types";
import logger from "@/lib/logger";

// ─── Skill Runner ───────────────────────────────────────────

export async function runSkill<TInput, TOutput>(
  skill: SkillDefinition<TInput, TOutput>,
  rawInput: unknown,
  options: SkillRunOptions,
): Promise<SkillResult<TOutput>> {
  const start = Date.now();

  // 1. Validate input
  let input: TInput;
  try {
    input = skill.inputSchema.parse(rawInput);
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        success: false,
        error: `Validation error: ${err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
        dryRun: options.dryRun,
        durationMs: Date.now() - start,
      };
    }
    throw err;
  }

  // 2. Dry-run mode — validate only, no execution
  if (options.dryRun) {
    return {
      success: true,
      dryRun: true,
      durationMs: Date.now() - start,
    };
  }

  // 3. Execute with tracing
  try {
    const traceCtx = options.traceContext ?? {
      agentId: `skill-${skill.slug}`,
      tenantId: options.tenantId,
    };

    const data = await traceAgent(traceCtx, async (span) => {
      span.setInput(JSON.stringify(input).slice(0, 2000));
      const result = await skill.handler(input, options);
      span.setOutput(JSON.stringify(result).slice(0, 2000));
      return result;
    });

    return {
      success: true,
      data,
      dryRun: false,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Skill ${skill.slug} failed`, { error: errorMessage });
    return {
      success: false,
      error: errorMessage,
      dryRun: false,
      durationMs: Date.now() - start,
    };
  }
}
