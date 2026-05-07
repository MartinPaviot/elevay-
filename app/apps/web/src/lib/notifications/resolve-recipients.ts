/**
 * Resolve notification recipients per tenant (P0-4 follow-up).
 *
 * The `notifications` schema requires `userId NOT NULL` ; system-
 * level alerts (freshness, cap-warning, etc.) need a recipient
 * picked. The rule mirrors how Lightfield / Monaco frame "system
 * messages to the founder" :
 *
 *  1. Prefer admin-role users — they're the ones who can act on
 *     "re-connect Recall.ai" / "bump cap" CTAs.
 *  2. Fall back to ALL users when there's no explicit admin (every
 *     user gets the alert ; better one redundant copy than none).
 *  3. Cap at MAX_RECIPIENTS to bound row count when a tenant has
 *     thousands of users (rare in our pricing tier but defensive).
 *
 * Pure : caller injects `findTenantUsers(tenantId)`. Tests pin
 * every branch deterministically.
 */

const MAX_RECIPIENTS = 5;

export interface TenantUser {
  id: string;
  role: string | null;
}

export interface ResolveDeps {
  findTenantUsers: (tenantId: string) => Promise<TenantUser[]>;
}

/**
 * Pure decider : given a list of tenant users, return the user
 * ids who should receive a system-alert notification.
 *
 * Rules :
 *  - Admin role wins exclusively when present (we don't spam
 *    every member if there's a clear escalation path).
 *  - When no admin exists, every user receives the alert
 *    (capped at MAX_RECIPIENTS) — better redundant than missed.
 *  - Empty input → empty output (caller will skip the insert).
 */
export function pickRecipients(
  users: ReadonlyArray<TenantUser>,
): string[] {
  if (users.length === 0) return [];
  const admins = users.filter((u) => u.role === "admin");
  const pool = admins.length > 0 ? admins : users;
  return pool.slice(0, MAX_RECIPIENTS).map((u) => u.id);
}

/**
 * DB-backed wrapper : composes the pure decider with the inject-
 * able user-fetch dep. Surfaces the choice via the returned
 * `source` so callers can log what path resolved.
 */
export async function resolveTenantRecipients(args: {
  tenantId: string;
  deps: ResolveDeps;
}): Promise<{
  userIds: string[];
  source: "admin" | "all_users" | "none";
}> {
  const users = await args.deps.findTenantUsers(args.tenantId);
  if (users.length === 0) {
    return { userIds: [], source: "none" };
  }
  const admins = users.filter((u) => u.role === "admin");
  const userIds = pickRecipients(users);
  return {
    userIds,
    source: admins.length > 0 ? "admin" : "all_users",
  };
}

export const RESOLVE_RECIPIENTS_LIMITS = { MAX_RECIPIENTS };
