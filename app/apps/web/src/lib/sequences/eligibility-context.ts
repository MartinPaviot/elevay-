/**
 * M13-G1 (outreach-autopilot T5) — DB-aware loader for the G1 eligibility
 * context: fresh-signal count + ICP fit per company, batched (one query per
 * enrollment request, never per contact).
 *
 * Freshness is the SAME rule the scorer applies (filterFreshSignals, TTL per
 * type): a signal that no longer lifts the priority score can no longer
 * justify an enrollment either (INV-2 / M2-R4).
 *
 * `icpScoringActive` — the tenant has at least one ICP-scored company. With
 * no ICP model, the fit threshold is meaningless: G1 degrades to the
 * fresh-signal rule alone (sane default, M11-R5) instead of blocking every
 * enrollment of an un-scored tenant.
 *
 * Fail-CLOSED: a thrown lookup propagates — the enrollment path refuses
 * rather than enrolling without the G1 facts.
 */

import { db } from "@/db";
import { companies } from "@/db/schema";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { filterFreshSignals } from "@/lib/signals/freshness";
import type { SignalEntry } from "@/lib/signals/record-signal";
import type { G1Context } from "./enrollment-eligibility";

export interface G1ContextMap {
  /** G1 facts for a contact's company; null/unknown company = zero signals. */
  forCompany(companyId: string | null | undefined): G1Context;
}

export async function loadG1Context(
  tenantId: string,
  companyIds: Array<string | null | undefined>,
): Promise<G1ContextMap> {
  const ids = [...new Set(companyIds.filter((c): c is string => !!c))];

  const [scored] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.tenantId, tenantId), isNotNull(companies.score)))
    .limit(1);
  const icpScoringActive = !!scored;

  const byCompany = new Map<string, G1Context>();
  if (ids.length > 0) {
    const rows = await db
      .select({
        id: companies.id,
        score: companies.score,
        properties: companies.properties,
      })
      .from(companies)
      .where(and(eq(companies.tenantId, tenantId), inArray(companies.id, ids)));
    const now = new Date();
    for (const row of rows) {
      const props = (row.properties ?? {}) as Record<string, unknown>;
      const raw = Array.isArray(props.signals) ? (props.signals as SignalEntry[]) : [];
      // Same defensive pre-filter as the outcome attribution path: a
      // type-less entry would throw inside normalizeType.
      const entries = raw.filter((s) => s && typeof s.type === "string" && s.type.length > 0);
      byCompany.set(row.id, {
        freshSignalCount: filterFreshSignals(entries, now).length,
        icpScore: row.score ?? null,
        icpScoringActive,
      });
    }
  }

  const noCompany: G1Context = { freshSignalCount: 0, icpScore: null, icpScoringActive };
  return {
    forCompany(companyId) {
      if (!companyId) return noCompany;
      // A company we could not load gets ZERO fresh signals (fail-closed:
      // unknown facts never justify a "why now").
      return byCompany.get(companyId) ?? noCompany;
    },
  };
}
