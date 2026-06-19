/**
 * Per-user custom intention-Split storage (B3 R4) in the existing user_preferences
 * JSONB k-v store (resource "inbox", key "splits") — NO schema migration. A
 * structural sibling of lane-store.ts; splits are personal, owner-scoped by userId.
 */

import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { CustomSplit } from "./splits";

const RESOURCE = "inbox";
const KEY = "splits";

export async function getUserSplits(userId: string): Promise<CustomSplit[]> {
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
  return Array.isArray(v) ? (v as CustomSplit[]) : [];
}

export async function saveUserSplits(userId: string, splits: CustomSplit[]): Promise<void> {
  await db
    .insert(userPreferences)
    .values({ userId, resource: RESOURCE, key: KEY, value: splits })
    .onConflictDoUpdate({
      target: [userPreferences.userId, userPreferences.resource, userPreferences.key],
      set: { value: splits, updatedAt: new Date() },
    });
}
