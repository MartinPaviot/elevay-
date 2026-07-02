/**
 * Engagement → buying-signal bridge.
 *
 * Activities (email opens/clicks, booked meetings, inbound forms) were logged
 * but never reached `companies.properties.signals[]` — the array the daily
 * priority-score scorer reads (signal-score-daily.ts `bestMultiplierForCompany`).
 * So on a cold TAM with no external monitor feeds, `priority_score` stayed flat
 * and the Accounts SCORE column was empty. This is the free, first-party source
 * of signal the engine already produces; this helper routes it to the scorer.
 *
 * Each engagement type carries an informed prior in
 * `lib/scoring/signal-outcomes.ts` (email_clicked 1.4, meeting_booked 2.5,
 * demo_request 2.2), so recording it lifts the account immediately and accrues
 * outcome attribution once deals close. Exception: `email_opened` is still
 * recorded (visible, diagnostic) but deliberately has NO prior — Apple MPP
 * auto-opens make it score-neutral (1.0), never a lift.
 *
 * Best-effort + idempotent: `recordCompanySignal` upserts by type (a fresher
 * open replaces a stale one), so repeated calls are safe. Company-level: a
 * contact with no company yields no signal (the signal is about the account).
 * The engaged contact is named as the signal `person` so the autopilot routes
 * follow-up to them rather than the default top-seniority contact.
 */

import { db } from "@/db";
import { contacts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { recordCompanySignal, type SignalStrength } from "./record-signal";

/** Engagement signal types that have a defined prior in signal-outcomes.ts. */
export type EngagementSignalType =
  | "email_opened"
  | "email_clicked"
  | "meeting_booked"
  | "demo_request";

export async function recordEngagementSignal(
  tenantId: string,
  contactId: string | null | undefined,
  type: EngagementSignalType,
  opts: { companyId?: string | null; strength?: SignalStrength; detectedAt?: string } = {},
): Promise<void> {
  if (!contactId) return;

  let companyId = opts.companyId ?? null;
  if (!companyId) {
    const [c] = await db
      .select({ companyId: contacts.companyId })
      .from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
      .limit(1);
    companyId = c?.companyId ?? null;
  }
  if (!companyId) return; // company-less contact — the signal is account-level

  await recordCompanySignal(tenantId, companyId, {
    type,
    detectedAt: opts.detectedAt ?? new Date().toISOString(),
    ...(opts.strength ? { strength: opts.strength } : {}),
    source: "engagement",
    person: { contactId },
  });
}
