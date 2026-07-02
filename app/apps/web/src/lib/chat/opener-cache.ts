/**
 * Shared sessionStorage cache for the opener payload — the dock and the
 * /chat page consume the same GET /api/chat/opener, so they share one
 * cache entry: opening the dock then visiting /chat (or the reverse)
 * within the TTL is instant and shows the same briefing.
 */

import type { OpenerPayload } from "./opener";

/** What GET /api/chat/opener actually returns. */
export interface OpenerResponse extends OpenerPayload {
  firstName?: string | null;
  generatedAt?: string;
}

export const OPENER_CACHE_KEY = "elevay:chat-opener:v1";
export const OPENER_CACHE_TTL_MS = 60_000;

export function readOpenerCache(): OpenerResponse | null {
  try {
    const raw = window.sessionStorage.getItem(OPENER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: OpenerResponse };
    if (!parsed?.data || Date.now() - parsed.at > OPENER_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeOpenerCache(data: OpenerResponse): void {
  try {
    window.sessionStorage.setItem(
      OPENER_CACHE_KEY,
      JSON.stringify({ at: Date.now(), data }),
    );
  } catch {
    // Quota/privacy-mode failures just cost a refetch next open.
  }
}
