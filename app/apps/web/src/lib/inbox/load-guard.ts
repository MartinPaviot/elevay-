/**
 * F2 — a tiny generation guard for overlapping async loads. When the user switches
 * lanes rapidly, an earlier request can resolve AFTER a later one; committing its
 * result would flash a stale lane. Each load mints a token via `next()`; a
 * post-await commit is allowed only while `isCurrent(token)` holds. Pure — no
 * React, no timers — so the discard logic is unit-testable in isolation.
 */

export interface LoadGuard {
  /** Begin a new load: bump the generation and return its token. */
  next(): number;
  /** True only for the most recently issued token (the live load). */
  isCurrent(token: number): boolean;
}

export function createLoadGuard(): LoadGuard {
  let current = 0;
  return {
    next() {
      current += 1;
      return current;
    },
    isCurrent(token: number) {
      return token === current;
    },
  };
}
