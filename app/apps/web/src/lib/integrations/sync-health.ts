/**
 * Per-connection OAuth sync health (needs-reauth tracking).
 *
 * A dead Google/Microsoft OAuth grant (invalid_grant / 401 / 403) was retried
 * by both 15-min sync crons forever, re-emitting an "Email sync disconnected"
 * notification every cycle. This module persists a per-connection `needs_reauth`
 * flag so the crons skip dead connections (stopping the loop) and the
 * notification fires once. The flag clears when the user reconnects.
 *
 * Stored in `tenants.settings.syncHealth[<authUserId>:<provider>]` (JSONB) —
 * no schema migration, and `jsonb_set` / `#-` only touch that one path so
 * sibling settings (contactCreationMode, backsyncRange, …) are preserved.
 */
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export type SyncProvider = "google" | "microsoft";

/** Normalize any provider spelling (google | microsoft | microsoft-entra-id |
 * undefined) to the two we track. Email's default path is Google. */
export function normSyncProvider(p?: string | null): SyncProvider {
  return p && p.toLowerCase().includes("microsoft") ? "microsoft" : "google";
}

/** Stable per-connection key within a tenant's settings. */
export function connKey(authUserId: string, provider?: string | null): string {
  return `${authUserId}:${normSyncProvider(provider)}`;
}

export interface SyncHealthEntry {
  status: "needs_reauth";
  reason?: string;
  failingSince: string; // ISO
  lastNotifiedAt?: string; // ISO — set when the user was notified
}

type SettingsShape = {
  syncHealth?: Record<string, SyncHealthEntry>;
} & Record<string, unknown>;

/** Heuristic: does this error message indicate a dead/expired OAuth grant
 * (user must reconnect) rather than a transient failure? */
export function isOAuthAuthError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("401") ||
    m.includes("403") ||
    m.includes("invalid_grant") ||
    m.includes("invalid_request") ||
    m.includes("token") ||
    m.includes("unauthorized") ||
    m.includes("auth") ||
    m.includes("not connected")
  );
}

/** Pure read: is this connection flagged needs_reauth? Pass the tenant's
 * already-loaded `settings` to avoid an extra query in hot loops. */
export function isNeedsReauth(
  settings: unknown,
  authUserId: string,
  provider?: string | null,
): boolean {
  const s = (settings || {}) as SettingsShape;
  return s.syncHealth?.[connKey(authUserId, provider)]?.status === "needs_reauth";
}

/** Read the entry for a connection (or null). */
export function getSyncHealthEntry(
  settings: unknown,
  authUserId: string,
  provider?: string | null,
): SyncHealthEntry | null {
  const s = (settings || {}) as SettingsShape;
  return s.syncHealth?.[connKey(authUserId, provider)] ?? null;
}

/**
 * Flag a connection as needing re-auth. Returns `{ newlyMarked }` — true only
 * on the healthy → needs_reauth transition, so callers fire the notification
 * exactly once. `failingSince` is preserved across repeated marks.
 */
export async function markNeedsReauth(
  tenantId: string,
  authUserId: string,
  provider: string | null | undefined,
  reason?: string,
): Promise<{ newlyMarked: boolean }> {
  const key = connKey(authUserId, provider);

  const [row] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const prev = getSyncHealthEntry(row?.settings, authUserId, provider);
  const already = prev?.status === "needs_reauth";
  const nowIso = new Date().toISOString();

  const entry: SyncHealthEntry = {
    status: "needs_reauth",
    reason: reason ? reason.slice(0, 200) : undefined,
    failingSince: already ? prev!.failingSince : nowIso,
    lastNotifiedAt: already ? prev!.lastNotifiedAt : nowIso,
  };

  await db
    .update(tenants)
    .set({
      // bare `settings` = the updated row's column (UPDATE SET RHS); bound
      // params for the dynamic key + value avoid any injection.
      settings: sql`jsonb_set(coalesce(settings, '{}'::jsonb), array['syncHealth'::text, ${key}::text], ${JSON.stringify(entry)}::jsonb, true)`,
    })
    .where(eq(tenants.id, tenantId));

  return { newlyMarked: !already };
}

/** Clear a connection's needs-reauth flag (called on successful reconnect). */
export async function clearSyncHealth(
  tenantId: string,
  authUserId: string,
  provider: string | null | undefined,
): Promise<void> {
  const key = connKey(authUserId, provider);
  await db
    .update(tenants)
    .set({
      settings: sql`coalesce(settings, '{}'::jsonb) #- array['syncHealth'::text, ${key}::text]`,
    })
    .where(eq(tenants.id, tenantId));
}
