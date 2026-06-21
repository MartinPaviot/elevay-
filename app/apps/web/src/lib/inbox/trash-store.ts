/**
 * Trashed conversations (Upstream `is:trash`). The user's trashed thread keys,
 * owner-scoped in user_preferences JSONB (resource "inbox", key "trashed") — a
 * structural sibling of starred-store.ts, NO migration (prod-safe). A trashed
 * conversation is hidden from every normal lane and surfaced only in the Trash
 * folder; restoring removes the key. Soft-delete: the underlying messages are
 * untouched (they stay on the contact timeline).
 */

import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const RESOURCE = "inbox";
const KEY = "trashed";

/** Cap so a runaway trash list can't grow unbounded; oldest entries evicted first. */
export const MAX_TRASHED = 5000;

export async function getTrashedKeys(userId: string): Promise<string[]> {
  const [row] = await db
    .select({ value: userPreferences.value })
    .from(userPreferences)
    .where(and(eq(userPreferences.userId, userId), eq(userPreferences.resource, RESOURCE), eq(userPreferences.key, KEY)))
    .limit(1);
  const v = row?.value;
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];
}

async function saveTrashedKeys(userId: string, keys: string[]): Promise<void> {
  const capped = keys.slice(-MAX_TRASHED);
  await db
    .insert(userPreferences)
    .values({ userId, resource: RESOURCE, key: KEY, value: capped })
    .onConflictDoUpdate({
      target: [userPreferences.userId, userPreferences.resource, userPreferences.key],
      set: { value: capped, updatedAt: new Date() },
    });
}

/** Trash (true) or restore (false) a conversation. Returns the new trashed state.
 * Idempotent for a given desired state. */
export async function toggleTrashed(userId: string, conversationKey: string, trashed?: boolean): Promise<boolean> {
  const key = conversationKey.trim();
  if (!key) return false;
  const current = await getTrashedKeys(userId);
  const has = current.includes(key);
  const next = trashed === undefined ? !has : trashed;
  if (next === has) return has; // no change
  const updated = next ? [...current.filter((k) => k !== key), key] : current.filter((k) => k !== key);
  await saveTrashedKeys(userId, updated);
  return next;
}
