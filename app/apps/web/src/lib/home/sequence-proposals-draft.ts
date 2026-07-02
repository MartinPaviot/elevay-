/**
 * "Proposed by Elevay" — DB orchestration (home-proposed-lane).
 *
 * Mold: lib/inbox/followup-nudge-draft.ts — reconcile stale pendings, then
 * draft the new ones; the decision core stays pure (sequence-proposals.ts).
 * Exported as a plain function so the cron, a script, or a live-verify can
 * invoke it without waiting for the schedule.
 *
 * Scan cost: one full-tenant read of companies carrying a non-empty
 * `properties.signals[]` — the same cost class as signal-score-daily's scan.
 * Pilae today: 816 companies, ~13 with signals.
 */

import { db } from "@/db";
import { companies, contacts, homeSequenceProposals } from "@/db/schema";
import { and, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { getSignalMultipliers } from "@/lib/scoring/signal-outcomes";
import {
  computeProposalCandidates,
  PROPOSAL_TTL_DAYS,
  type CompanySignalRow,
  type CohortContactStats,
  type ProposalCandidate,
} from "@/lib/home/sequence-proposals";

const DAY_MS = 86_400_000;

/** Load every company of the tenant that carries at least one signal entry. */
async function loadSignalCompanies(tenantId: string): Promise<CompanySignalRow[]> {
  const rows = await db
    .select({
      companyId: companies.id,
      name: companies.name,
      excludedReason: companies.excludedReason,
      properties: companies.properties,
    })
    .from(companies)
    .where(
      and(
        eq(companies.tenantId, tenantId),
        isNull(companies.deletedAt),
        sql`jsonb_array_length(coalesce(${companies.properties}->'signals', '[]'::jsonb)) > 0`,
      ),
    );
  return rows.map((r) => ({
    companyId: r.companyId,
    name: r.name,
    excludedReason: r.excludedReason,
    signals: (() => {
      const s = (r.properties as Record<string, unknown> | null)?.signals;
      return Array.isArray(s) ? (s as CompanySignalRow["signals"]) : [];
    })(),
  }));
}

/** Contactable contacts per company, one grouped query. EMAIL-ONLY on
 *  purpose: the enrollment stack rejects `no_email` contacts
 *  (lib/sequences/enrollment-eligibility.ts:71), so counting LinkedIn-only
 *  people here would over-promise a reach the Launch can't deliver. */
async function loadContactStats(
  tenantId: string,
  companyIds: string[],
): Promise<Map<string, CohortContactStats>> {
  if (!companyIds.length) return new Map();
  const rows = await db
    .select({
      companyId: contacts.companyId,
      contactable: sql<number>`count(*)::int`,
    })
    .from(contacts)
    .where(
      and(
        eq(contacts.tenantId, tenantId),
        isNull(contacts.deletedAt),
        inArray(contacts.companyId, companyIds),
        isNotNull(contacts.email),
        sql`${contacts.email} <> ''`,
      ),
    )
    .groupBy(contacts.companyId);
  const out = new Map<string, CohortContactStats>();
  for (const r of rows) {
    if (r.companyId) out.set(r.companyId, { contactable: r.contactable });
  }
  return out;
}

export interface ProposalDraftResult {
  drafted: number;
  expired: number;
  candidates: number;
}

/**
 * One tenant pass: compute the current candidates, expire pendings that no
 * longer match reality (cohort changed / past TTL), insert the new ones.
 * Insert is conflict-safe on hsp_dedupe_idx (tenant, family, cohortHash) —
 * a cohort already proposed in ANY status is never re-inserted; only a
 * CHANGED cohort (new hash) yields a new row.
 */
export async function draftProposalsForTenant(
  tenantId: string,
  now: Date = new Date(),
): Promise<ProposalDraftResult> {
  const companiesRows = await loadSignalCompanies(tenantId);
  const contactStats = await loadContactStats(
    tenantId,
    companiesRows.map((c) => c.companyId),
  );
  const { multipliers } = await getSignalMultipliers(tenantId);
  const candidates = computeProposalCandidates({
    companies: companiesRows,
    contactStats,
    multipliers,
    now,
  });

  // Reconcile: a pending row is stale when its family's current cohort hash
  // differs (or the family produced no candidate at all), or when past its
  // hard TTL. Mold: reconcileStaleNudges.
  const currentHashByFamily = new Map(candidates.map((c) => [c.signalFamily, c.cohortHash]));
  const pendings = await db
    .select({
      id: homeSequenceProposals.id,
      signalFamily: homeSequenceProposals.signalFamily,
      cohortHash: homeSequenceProposals.cohortHash,
      expiresAt: homeSequenceProposals.expiresAt,
    })
    .from(homeSequenceProposals)
    .where(
      and(
        eq(homeSequenceProposals.tenantId, tenantId),
        eq(homeSequenceProposals.status, "pending_review"),
      ),
    );
  const staleIds = pendings
    .filter(
      (p) =>
        now >= new Date(p.expiresAt) ||
        currentHashByFamily.get(p.signalFamily) !== p.cohortHash,
    )
    .map((p) => p.id);
  if (staleIds.length) {
    await db
      .update(homeSequenceProposals)
      .set({ status: "expired", updatedAt: now })
      .where(inArray(homeSequenceProposals.id, staleIds));
  }

  // Insert the new candidates (conflict-safe: content-based dedupe).
  let drafted = 0;
  for (const c of candidates) {
    const inserted = await db
      .insert(homeSequenceProposals)
      .values({
        tenantId,
        signalFamily: c.signalFamily,
        templateId: c.templateId,
        title: c.title,
        companyIds: c.companyIds,
        companyNames: c.companyNames,
        companyCount: c.companyCount,
        contactableCount: c.contactableCount,
        freshestAt: c.freshestAt,
        cohortHash: c.cohortHash,
        generatedAt: now,
        expiresAt: new Date(now.getTime() + PROPOSAL_TTL_DAYS * DAY_MS),
      })
      .onConflictDoNothing()
      .returning({ id: homeSequenceProposals.id });
    drafted += inserted.length;
  }

  return { drafted, expired: staleIds.length, candidates: candidates.length };
}

export type { ProposalCandidate };
