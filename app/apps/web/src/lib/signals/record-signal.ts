/**
 * Record a buying signal on companies.properties.signals[] — the array the
 * priority-score cron reads (signal-score-daily.ts `bestMultiplierForCompany`).
 *
 * Without this, the signal-detector skills (funding-signal-monitor,
 * job-posting-intent, …) produced findings but never wrote the array the
 * scorer consumes, so detected signals never lifted priority_score. This is
 * the single write point that closes that gap.
 *
 * `detectedAt` drives freshness (lib/signals/freshness.ts): a signal past its
 * type's TTL stops boosting the score. The signal `type` keys into the tenant's
 * outcome-attribution multiplier table (lib/scoring/signal-outcomes.ts).
 */

import { db } from "@/db";
import { companies } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export type SignalStrength = "high" | "medium" | "low";

export type SignalEntry = {
  /** Signal type — must match a key in SIGNAL_TTL_DAYS / the multiplier table. */
  type: string;
  /** ISO timestamp; drives freshness decay. */
  detectedAt: string;
  strength?: SignalStrength;
  /** Where it came from (e.g. "apollo", "engagement") — provenance only. */
  source?: string;
};

/**
 * Pure: upsert a signal by type — the newest entry of a type replaces the
 * prior one (a fresher funding signal supersedes a stale one); all other
 * types are preserved. Append-if-absent. Order-stable for the kept entries.
 */
export function upsertSignalEntry(
  signals: SignalEntry[],
  entry: SignalEntry,
): SignalEntry[] {
  const kept = signals.filter((s) => s.type !== entry.type);
  return [...kept, entry];
}

/**
 * Read → upsert → write `properties.signals[]`, merging ONLY the signals key
 * (`||`) so concurrent property writers (lastKnownFunding, lastKnownEmployeeCount,
 * primaryIcpId, …) are preserved. No-op if the company is gone.
 */
export async function recordCompanySignal(
  tenantId: string,
  companyId: string,
  entry: SignalEntry,
): Promise<void> {
  const [row] = await db
    .select({ properties: companies.properties })
    .from(companies)
    .where(and(eq(companies.tenantId, tenantId), eq(companies.id, companyId)));
  if (!row) return;

  const props = (row.properties as Record<string, unknown> | null) ?? {};
  const current = Array.isArray(props.signals)
    ? (props.signals as SignalEntry[])
    : [];
  const next = upsertSignalEntry(current, entry);
  const patch = JSON.stringify({ signals: next });

  await db
    .update(companies)
    .set({
      properties: sql`COALESCE(${companies.properties}, '{}'::jsonb) || ${patch}::jsonb`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(companies.tenantId, tenantId), eq(companies.id, companyId)));
}
