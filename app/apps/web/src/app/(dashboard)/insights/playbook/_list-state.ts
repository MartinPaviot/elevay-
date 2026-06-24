/**
 * Pure list-state decision for the Playbook page (P1 27 hydration fix).
 *
 * The page was H2 on the refresh path: the "Loading…" cue was gated on
 * `loading && entries.length === 0`, so switching the type filter re-fetched
 * while the previous filter's cards stayed on screen with NO loading cue — a
 * silent-stale window where the list shows the wrong filter's data. This maps
 * (loading, count) to an explicit state so the call-site can show:
 *   - initial-loading → "Loading…" (first paint, nothing to show yet)
 *   - refreshing      → keep the list but dim it + show a "Refreshing…" cue
 *   - empty           → the written empty state
 *   - list            → the cards, fresh
 */

export type PlaybookListState =
  | "initial-loading"
  | "refreshing"
  | "empty"
  | "list";

export function playbookListState(
  loading: boolean,
  count: number,
): PlaybookListState {
  if (loading && count === 0) return "initial-loading";
  if (loading && count > 0) return "refreshing";
  if (count === 0) return "empty";
  return "list";
}
