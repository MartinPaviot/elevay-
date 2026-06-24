/**
 * Starter-suggestion display logic for /chat, extracted so it is unit-testable
 * without mounting the whole chat page.
 *
 * The chat empty state shows 4 starter prompts personalized from the tenant's
 * onboarding (GET /api/chat/suggestions). Previously the page rendered a
 * hardcoded fallback immediately and then visibly SWAPPED to the fetched copy
 * once the request resolved. `starterSuggestions` returns `null` while the fetch
 * is still in flight so the caller can render skeleton rows instead of the
 * canned text — no swap. Once loaded it returns the fetched suggestions, or the
 * generic fallback when the fetch returned nothing / failed (an acceptable,
 * silent personalization fallback — not an error worth a banner).
 */

export const FALLBACK_SUGGESTIONS = [
  "What should I focus on today?",
  "Summarize my active opportunities",
  "Which deals are at risk of stalling?",
  "Research my top accounts to refine my ICP",
] as const;

/** Number of skeleton rows to show while suggestions load. */
export const STARTER_SUGGESTION_COUNT = 4;

/**
 * Returns the suggestions to render, or `null` to signal "still loading — show
 * skeletons". Caps at 4.
 */
export function starterSuggestions(
  loaded: boolean,
  fetched: readonly string[],
): string[] | null {
  if (!loaded) return null;
  const list = fetched.length > 0 ? fetched : FALLBACK_SUGGESTIONS;
  return list.slice(0, STARTER_SUGGESTION_COUNT);
}
