/**
 * Not-noise overrides (B4 R3) — the user's "this isn't noise" decisions, stored
 * owner-scoped in user_preferences JSONB (resource "inbox", key "noiseOverrides";
 * NO migration). A structural sibling of lane-store.ts / filter-store.ts. The
 * override wins absolutely over every classification signal (classifyNoise step 0).
 */

import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export interface NoiseOverride {
  /** Lowercased counterparty address — the match key. */
  sender: string;
  /** Optional conversation key for a thread-only override. */
  threadKey?: string;
  /** Provider filter id (R4.4), for undo. */
  gmailFilterId?: string;
  /** ISO timestamp — audit + oldest-first eviction. */
  at: string;
}

const RESOURCE = "inbox";
const KEY = "noiseOverrides";

/** Cap so a runaway override list can't grow unbounded; oldest evicted first. */
export const MAX_OVERRIDES = 500;

export async function getNoiseOverrides(userId: string): Promise<NoiseOverride[]> {
  const [row] = await db
    .select({ value: userPreferences.value })
    .from(userPreferences)
    .where(
      and(
        eq(userPreferences.userId, userId),
        eq(userPreferences.resource, RESOURCE),
        eq(userPreferences.key, KEY),
      ),
    )
    .limit(1);
  const v = row?.value;
  return Array.isArray(v) ? (v as NoiseOverride[]) : [];
}

export async function saveNoiseOverrides(userId: string, overrides: NoiseOverride[]): Promise<void> {
  const capped = overrides.slice(-MAX_OVERRIDES);
  await db
    .insert(userPreferences)
    .values({ userId, resource: RESOURCE, key: KEY, value: capped })
    .onConflictDoUpdate({
      target: [userPreferences.userId, userPreferences.resource, userPreferences.key],
      set: { value: capped, updatedAt: new Date() },
    });
}

/**
 * Pure: does any override keep this conversation? A sender override matches the
 * (lowercased) from-address; a thread override matches the conversation key.
 */
export function noiseOverrideMatches(
  overrides: NoiseOverride[],
  fromAddress: string,
  threadKey: string,
): boolean {
  const from = (fromAddress || "").trim().toLowerCase();
  for (const o of overrides) {
    if (o.threadKey) {
      if (o.threadKey === threadKey) return true;
      continue;
    }
    if (o.sender && o.sender.trim().toLowerCase() === from && from.length > 0) return true;
  }
  return false;
}
