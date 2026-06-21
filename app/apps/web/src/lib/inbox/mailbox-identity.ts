/**
 * Per-mailbox identity (A3) — an optional display-name, signature, and writing-
 * voice override per connected mailbox, stored owner-scoped in user_preferences
 * JSONB (resource "inbox", key "mailboxIdentity"; NO migration). Identity is
 * per-(user, mailbox): a shared box can read with a different signature per user,
 * which a single column on the tenant-shared row could not express.
 *
 * Pure helpers (clamp / applySignature / stripSignature / buildMailboxVoiceBlock)
 * are unit-tested with no DB. The signature uses the standard "-- " email marker,
 * strip-then-append, so it is idempotent + swap-safe and never duplicated on send.
 */

import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { isAutoSendInstruction } from "@/lib/inbox/ai-memory";

// Pure signature helpers live in a DB-free module so the client composer can
// import them too; re-exported here for callers of the identity module.
export { applySignature, stripSignature } from "@/lib/inbox/mailbox-signature";

export interface MailboxIdentity {
  displayName?: string;
  signature?: string;
  voice?: string;
}

const RESOURCE = "inbox";
const KEY = "mailboxIdentity";
const MAX = { displayName: 120, signature: 2000, voice: 2000 } as const;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Trim, cap, drop blanks; returns null when the identity is fully empty (R3.2/R4.3). */
export function clampMailboxIdentity(input: Partial<MailboxIdentity> | null | undefined): MailboxIdentity | null {
  const displayName = str(input?.displayName).trim().slice(0, MAX.displayName);
  const signature = str(input?.signature).trim().slice(0, MAX.signature);
  const voice = str(input?.voice).trim().slice(0, MAX.voice);
  const out: MailboxIdentity = {};
  if (displayName) out.displayName = displayName;
  if (signature) out.signature = signature;
  if (voice) out.voice = voice;
  return Object.keys(out).length === 0 ? null : out;
}

/** Drop any auto-send/skip-approval line so the override can't reopen never-auto-send. */
function scrubAutoSend(text: string): string {
  return (text || "")
    .split("\n")
    .filter((line) => !(line.trim() && isAutoSendInstruction(line)))
    .join("\n")
    .trim();
}

/** The per-mailbox voice directive appended to the draft instructions; "" when absent. */
export function buildMailboxVoiceBlock(identity: MailboxIdentity | undefined): string {
  const voice = scrubAutoSend(identity?.voice ?? "");
  if (!voice) return "";
  return `For this mailbox, also write in this voice:\n${voice}`;
}

export async function getMailboxIdentities(userId: string): Promise<Record<string, MailboxIdentity>> {
  const [row] = await db
    .select({ value: userPreferences.value })
    .from(userPreferences)
    .where(and(eq(userPreferences.userId, userId), eq(userPreferences.resource, RESOURCE), eq(userPreferences.key, KEY)))
    .limit(1);
  const v = row?.value;
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, MailboxIdentity>) : {};
}

/** Merge a clamped patch at mailboxId (dropping the key when it clamps to empty), upsert the map. */
export async function saveMailboxIdentity(
  userId: string,
  mailboxId: string,
  patch: Partial<MailboxIdentity>,
): Promise<MailboxIdentity | null> {
  const map = await getMailboxIdentities(userId);
  const merged = clampMailboxIdentity({ ...map[mailboxId], ...patch });
  if (merged) map[mailboxId] = merged;
  else delete map[mailboxId];
  await db
    .insert(userPreferences)
    .values({ userId, resource: RESOURCE, key: KEY, value: map })
    .onConflictDoUpdate({
      target: [userPreferences.userId, userPreferences.resource, userPreferences.key],
      set: { value: map, updatedAt: new Date() },
    });
  return merged;
}
