/**
 * Spam conversations (Upstream `is:spam`). The user's spam-flagged thread keys,
 * owner-scoped in user_preferences JSONB (resource "inbox", key "spam") — a
 * structural sibling of trash-store.ts, NO migration (prod-safe). A spammed
 * conversation is hidden from every normal lane and surfaced only in the Spam
 * folder; "Not spam" removes the key.
 */

import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const RESOURCE = "inbox";
const KEY = "spam";

export const MAX_SPAM = 5000;

export async function getSpamKeys(userId: string): Promise<string[]> {
  const [row] = await db
    .select({ value: userPreferences.value })
    .from(userPreferences)
    .where(and(eq(userPreferences.userId, userId), eq(userPreferences.resource, RESOURCE), eq(userPreferences.key, KEY)))
    .limit(1);
  const v = row?.value;
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];
}

async function saveSpamKeys(userId: string, keys: string[]): Promise<void> {
  const capped = keys.slice(-MAX_SPAM);
  await db
    .insert(userPreferences)
    .values({ userId, resource: RESOURCE, key: KEY, value: capped })
    .onConflictDoUpdate({
      target: [userPreferences.userId, userPreferences.resource, userPreferences.key],
      set: { value: capped, updatedAt: new Date() },
    });
}

/** Flag (true) or un-flag (false) a conversation as spam. Returns the new state. */
export async function toggleSpam(userId: string, conversationKey: string, spam?: boolean): Promise<boolean> {
  const key = conversationKey.trim();
  if (!key) return false;
  const current = await getSpamKeys(userId);
  const has = current.includes(key);
  const next = spam === undefined ? !has : spam;
  if (next === has) return has;
  const updated = next ? [...current.filter((k) => k !== key), key] : current.filter((k) => k !== key);
  await saveSpamKeys(userId, updated);
  return next;
}
