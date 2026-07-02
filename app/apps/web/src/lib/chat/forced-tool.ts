/**
 * Chip pre-routing (opener v3): an opener chip can name the tool it
 * targets; /api/chat then forces that tool on the FIRST agent step
 * (AI SDK prepareStep + toolChoice), eliminating tool-selection detours
 * for one-tap actions — the Monaco "quick-action as router shortcut"
 * pattern. Later steps run the normal loop (synthesis, follow-ups).
 *
 * Safety, two gates:
 *  1. ALLOWLIST — `forcedTool` arrives from the client body, so it is
 *     only honored for the exact tools the opener chips can emit. This
 *     stops a client from forcing an arbitrary (possibly mutating) tool
 *     with mismatched intent. All allowlisted tools are read/analyze/
 *     draft — none mutate. Adding a new chip tool means adding it here
 *     (a drift-guard test enforces the pairing with opener.ts/recipes.ts).
 *  2. CAPABILITY — even an allowlisted tool must exist in the
 *     capability-resolved set; permission/surface drops always win. The
 *     text-router's narrowing is only a relevance heuristic, so a
 *     router-filtered (but allowed) tool is re-added rather than ignored.
 */

/**
 * The exact tools opener chips force. Must equal the union of `tool:`
 * fields in opener.ts (work chips) + recipes.ts (recipe chips) — the
 * drift-guard test pins that. All non-mutating: getCallList /
 * getDealsAtRisk / searchEmailsByMetadata are read; getDealCoaching /
 * generateMeetingPrep / scanSignals / analyzeSequencePerformance /
 * defineICP are analyze; suggestEmailReply is draft-only.
 */
export const OPENER_FORCEABLE_TOOLS: ReadonlySet<string> = new Set([
  "suggestEmailReply",
  "getDealCoaching",
  "generateMeetingPrep",
  "getCallList",
  "searchEmailsByMetadata",
  "getDealsAtRisk",
  "scanSignals",
  "analyzeSequencePerformance",
  "defineICP",
]);

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
  // Gate 1: only the opener's own toolset may be force-routed (the client
  // supplies forcedTool, so never honor an arbitrary — possibly mutating —
  // tool name).
  if (!OPENER_FORCEABLE_TOOLS.has(forcedTool)) {
    return { toolName: null, tools: chatTools };
  }
  // Gate 2: capability/permission must still allow it.
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
