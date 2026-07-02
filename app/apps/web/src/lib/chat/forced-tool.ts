/**
 * Chip pre-routing (opener v3): an opener chip can name the tool it
 * targets; /api/chat then forces that tool on the FIRST agent step
 * (AI SDK prepareStep + toolChoice), eliminating tool-selection detours
 * for one-tap actions — the Monaco "quick-action as router shortcut"
 * pattern. Later steps run the normal loop (synthesis, follow-ups).
 *
 * Safety: a forced tool must exist in the capability-resolved set —
 * capability/permission drops always win over the chip's hint. The
 * text-router's narrowing, however, is only a relevance heuristic, so a
 * router-filtered tool is re-added rather than silently ignored.
 */

export interface ResolvedForcedTool<T> {
  /** Tool name to force at step 0, or null when the hint can't apply. */
  toolName: string | null;
  /** chatTools, possibly widened with the router-filtered tool. */
  tools: Record<string, T>;
}

export function resolveForcedTool<T>(
  forcedTool: string | null | undefined,
  chatTools: Record<string, T>,
  capabilityTools: Record<string, T>,
): ResolvedForcedTool<T> {
  if (!forcedTool || typeof forcedTool !== "string") {
    return { toolName: null, tools: chatTools };
  }
  if (chatTools[forcedTool]) {
    return { toolName: forcedTool, tools: chatTools };
  }
  // Dropped by the text router but allowed by capabilities → re-add.
  if (capabilityTools[forcedTool]) {
    return {
      toolName: forcedTool,
      tools: { ...chatTools, [forcedTool]: capabilityTools[forcedTool] },
    };
  }
  // Not capability-allowed (permissions/surface) → ignore the hint.
  return { toolName: null, tools: chatTools };
}
