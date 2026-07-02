import { withAuthRLS } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { outboundEmails } from "@/db/schema";
import { and, desc, eq, like } from "drizzle-orm";
import { getTenantSettings } from "@/lib/config/tenant-settings";
import {
  getOutreachCapCount,
  OUTREACH_CAP_REASON_PREFIX,
  OUTREACH_DAILY_TENANT_CAP,
  tenantDayKey,
} from "@/lib/guardrails/outreach-cap";

/**
 * `/api/outreach/cap` — the cockpit's INV-1 gauge (ux 3.2, T2).
 * Returns the day's consumption against the hard 100/day tenant cap plus the
 * sends DEFERRED at the cap (rows the workers requeued with the cap reason —
 * they go out tomorrow, they are not failures). Read-only; the cap itself is
 * a compiled constant and is deliberately not writable from any API.
 */
export async function GET() {
  return withAuthRLS(async (authCtx) => {
    const settings = await getTenantSettings(authCtx.tenantId);
    const timezone = settings?.timezone ?? "UTC";
    const day = tenantDayKey(settings?.timezone);

    const [sent, deferred] = await Promise.all([
      getOutreachCapCount(authCtx.tenantId, day),
      db
        .select({
          id: outboundEmails.id,
          toAddress: outboundEmails.toAddress,
          subject: outboundEmails.subject,
          queuedAt: outboundEmails.queuedAt,
        })
        .from(outboundEmails)
        .where(
          and(
            eq(outboundEmails.tenantId, authCtx.tenantId),
            eq(outboundEmails.status, "queued"),
            like(outboundEmails.errorMessage, `${OUTREACH_CAP_REASON_PREFIX}%`),
          ),
        )
        .orderBy(desc(outboundEmails.queuedAt))
        .limit(50),
    ]);

    return Response.json({
      sent,
      cap: OUTREACH_DAILY_TENANT_CAP,
      day,
      timezone,
      // The counter resets at the tenant's next local midnight; the client
      // renders "reprise demain 00:00 (<timezone>)" from these two fields —
      // no UTC conversion server-side (Intl-only, no tz library).
      resetsAtLocalMidnight: true,
      deferredCount: deferred.length,
      deferred,
    });
  });
}
