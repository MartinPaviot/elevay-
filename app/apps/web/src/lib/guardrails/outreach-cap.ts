/**
 * INV-1 (outreach-autopilot M5-R1) — the tenant-wide daily outreach cap.
 *
 * THE CAP IS AN ARCHITECTURAL CONSTANT, not configuration: no env var, no
 * tenant-settings key, no DB column can change it. Raising it requires a
 * reviewed commit to this file. This is the product's founding safety
 * invariant ("100 emails/jour/tenant, non contournable") — see
 * _specs/outreach-autopilot/requirements.md INV-1.
 *
 * Concurrency: the slot is granted by ONE atomic conditional UPDATE
 * (`SET sent_count = sent_count + 1 WHERE … AND sent_count < cap RETURNING`).
 * Two workers racing for the last slot serialize on the row lock — exactly one
 * gets a row back. There is no read-then-write anywhere.
 *
 * Accounting: the counter counts AUTHORIZED sends (slots granted by the gate),
 * not delivered mail. A downstream transport failure does NOT refund the slot —
 * conservative in the safe direction (we can only send less than the cap, never
 * more). Blocked sends never consume: the gate consumes the slot LAST, after
 * every other check has allowed the send (lib/guardrails/sending-gate.ts).
 */

import { db } from "@/db";
import { tenantSendCounters } from "@/db/schema";
import { and, eq, lt, sql } from "drizzle-orm";

export const OUTREACH_DAILY_TENANT_CAP = 100 as const;

/**
 * Stable prefix of the gate's refusal reason. The workers persist the full
 * reason into `outbound_emails.error_message` on requeue; the cockpit API
 * (app/api/outreach/cap) identifies deferred rows by THIS prefix — keep the
 * two in sync through this constant, never by retyping the string.
 */
export const OUTREACH_CAP_REASON_PREFIX = "Tenant daily outreach cap reached";

/**
 * The tenant's current calendar day as YYYY-MM-DD in ITS timezone (the reset
 * boundary is the tenant's midnight, M5-R1). Invalid/missing timezone falls
 * back to UTC — a wrong-but-stable boundary, never a crash.
 */
export function tenantDayKey(
  timeZone: string | null | undefined,
  now: Date = new Date(),
): string {
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  try {
    return fmt(timeZone || "UTC");
  } catch {
    return fmt("UTC");
  }
}

/**
 * Atomically consume one outreach slot for (tenant, day).
 * Returns { granted: false } when the day's 100 slots are exhausted.
 * Throws on DB failure — the caller (sending gate) fails CLOSED on throw.
 */
export async function consumeOutreachCapSlot(
  tenantId: string,
  day: string,
): Promise<{ granted: boolean; sentCount: number }> {
  await db
    .insert(tenantSendCounters)
    .values({ tenantId, day, sentCount: 0 })
    .onConflictDoNothing();

  const updated = await db
    .update(tenantSendCounters)
    .set({ sentCount: sql`${tenantSendCounters.sentCount} + 1` })
    .where(
      and(
        eq(tenantSendCounters.tenantId, tenantId),
        eq(tenantSendCounters.day, day),
        lt(tenantSendCounters.sentCount, OUTREACH_DAILY_TENANT_CAP),
      ),
    )
    .returning({ sentCount: tenantSendCounters.sentCount });

  if (updated.length > 0) {
    return { granted: true, sentCount: updated[0].sentCount };
  }
  return { granted: false, sentCount: await getOutreachCapCount(tenantId, day) };
}

/** Read-only count for UI/state (cockpit gauge — ux 3.2). 0 when no row yet. */
export async function getOutreachCapCount(
  tenantId: string,
  day: string,
): Promise<number> {
  const [row] = await db
    .select({ sentCount: tenantSendCounters.sentCount })
    .from(tenantSendCounters)
    .where(
      and(
        eq(tenantSendCounters.tenantId, tenantId),
        eq(tenantSendCounters.day, day),
      ),
    )
    .limit(1);
  return row?.sentCount ?? 0;
}
