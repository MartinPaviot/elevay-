/**
 * "Proposed by Elevay" — pure proposal engine (home-proposed-lane).
 *
 * Aggregates the STANDING STOCK of fresh company signals into founder-facing
 * launch proposals ("Recent funding — 7 accounts → post-funding sequence").
 * The pull-side complement to `signalAutoEnroll` (inngest/signal-to-sequence.ts),
 * which is push, per-detection, and never digests the existing stock.
 *
 * Pure: no DB, no clock ambient (time injected), no LLM. The cron
 * (inngest/home-proposals-cron.ts) maps live rows in, this decides. See
 * _specs/home-proposed-lane/.
 *
 * Taxonomy: `properties.signals[]` carries PRODUCER keys (funding_recent,
 * hiring_surge, executive_hire…). We fold them onto their canonical family via
 * SIGNAL_CANONICAL_ALIAS, then bridge family → proven template with
 * FAMILY_TO_TEMPLATE — nothing else in the codebase bridges these two
 * taxonomies (pickSequenceForSignal matches raw types; templates stamp
 * KnownSignalType triggers).
 */

import { createHash } from "node:crypto";
import { SIGNAL_CANONICAL_ALIAS, priorMultiplier } from "@/lib/scoring/signal-outcomes";
import { isSignalFresh } from "@/lib/signals/freshness";
import { getTemplate } from "@/lib/sequences/templates/registry";
import type { ProvenSequenceTemplate, TemplateStepType } from "@/lib/sequences/templates/types";

/** Canonical signal family → proven-template id (catalog.ts). Families absent
 *  here (acquisition, warm_connection, positive_reply, investor_overlap…) have
 *  no proven template yet and are SKIPPED — never a broken proposal. Adding a
 *  template later is one line here. */
export const FAMILY_TO_TEMPLATE: Record<string, string> = {
  funding: "post-funding",
  hiring: "hiring-signal",
  leadership_change: "leadership-change",
  tech_stack_change: "tech-stack-change",
  website_visit: "website-visit",
  exec_engagement: "exec-engagement",
  review_left: "review-left",
  competitor_mention: "competitor-mention",
  product_launch: "product-launch",
};

/** Plain-language why-now per family — card title copy (EN, product default). */
const FAMILY_TITLE: Record<string, string> = {
  funding: "Recent funding",
  hiring: "Hiring surge",
  leadership_change: "New leadership",
  tech_stack_change: "Tech stack change",
  website_visit: "Website visits",
  exec_engagement: "Exec engagement",
  review_left: "Review activity",
  competitor_mention: "Competitor mentions",
  product_launch: "Product launch",
};

/** A proposal needs at least this many companies to be worth a launch. */
export const MIN_COHORT = 2;
/** Never crowd /home — the top proposals only. */
export const PROPOSALS_MAX = 3;
/** A proposal the founder ignored for a week is stale (mold: nudge 5d). */
export const PROPOSAL_TTL_DAYS = 7;

export interface CompanySignalRow {
  companyId: string;
  name: string | null;
  excludedReason: string | null;
  signals: Array<{ type?: unknown; detectedAt?: unknown }>;
}

export interface CohortContactStats {
  /** Contacts of the company the enrollment stack can actually take —
   *  EMAIL-holders only (checkContactEligibility rejects `no_email`). */
  contactable: number;
}

export interface ProposalCandidate {
  signalFamily: string;
  templateId: string;
  title: string;
  companyIds: string[];
  companyNames: string[];
  companyCount: number;
  contactableCount: number;
  freshestAt: Date;
  cohortHash: string;
  /** multiplier × cohort size — ordering only, not persisted. */
  rank: number;
}

/** Content hash of a cohort — dedupe + staleness key. Order-insensitive. */
export function cohortHashOf(companyIds: ReadonlyArray<string>): string {
  return createHash("sha1").update([...companyIds].sort().join("\n")).digest("hex");
}

const asDate = (v: unknown): Date | null => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" && v) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/**
 * The engine. Groups fresh signals by canonical family, dedupes per company
 * (a company with 2 funding_recent entries is ONE cohort member — prod showed
 * BTG Group ×2), drops excluded companies and unmapped families, requires
 * MIN_COHORT companies and ≥1 contactable contact, ranks by
 * multiplier(family) × cohort size, caps at PROPOSALS_MAX.
 *
 * `multipliers` = getSignalMultipliers(tenantId).multipliers (learned when the
 * tenant has outcomes, informed priors otherwise; opens are absent by #609 —
 * INV-7 holds by construction).
 */
export function computeProposalCandidates(input: {
  companies: CompanySignalRow[];
  contactStats: Map<string, CohortContactStats>;
  multipliers: Record<string, number>;
  now: Date;
}): ProposalCandidate[] {
  const { companies, contactStats, multipliers, now } = input;

  // family → companyId → freshest detectedAt (null = fresh-but-undated)
  const byFamily = new Map<string, Map<string, { name: string | null; at: Date | null }>>();

  for (const c of companies) {
    if (c.excludedReason) continue;
    if (!Array.isArray(c.signals)) continue;
    for (const s of c.signals) {
      const rawType = typeof s.type === "string" ? s.type.trim().toLowerCase() : "";
      if (!rawType) continue;
      const family = SIGNAL_CANONICAL_ALIAS[rawType] ?? rawType;
      if (!(family in FAMILY_TO_TEMPLATE)) continue;
      const at = asDate(s.detectedAt);
      if (!isSignalFresh(rawType, at, now)) continue;
      let cohort = byFamily.get(family);
      if (!cohort) {
        cohort = new Map();
        byFamily.set(family, cohort);
      }
      const prev = cohort.get(c.companyId);
      // Keep the freshest dated entry; a dated entry beats an undated one.
      if (!prev || (at && (!prev.at || at > prev.at))) {
        cohort.set(c.companyId, { name: c.name, at });
      }
    }
  }

  const out: ProposalCandidate[] = [];
  for (const [family, cohort] of byFamily) {
    if (cohort.size < MIN_COHORT) continue;
    const ids = [...cohort.keys()];
    const contactable = ids.reduce(
      (n, id) => n + (contactStats.get(id)?.contactable ?? 0),
      0,
    );
    if (contactable < 1) continue;
    const dated = [...cohort.values()].map((v) => v.at).filter((d): d is Date => !!d);
    // A cohort can be all-undated (isSignalFresh keeps undated entries);
    // fall back to `now` so freshestAt stays NOT NULL.
    const freshestAt = dated.length ? new Date(Math.max(...dated.map((d) => d.getTime()))) : now;
    const names = [...cohort.values()]
      .map((v) => v.name)
      .filter((n): n is string => !!n)
      .slice(0, 6);
    const multiplier = multipliers[family] ?? priorMultiplier(family);
    out.push({
      signalFamily: family,
      templateId: FAMILY_TO_TEMPLATE[family],
      title: `${FAMILY_TITLE[family] ?? family} — ${ids.length} account${ids.length > 1 ? "s" : ""}`,
      companyIds: ids,
      companyNames: names,
      companyCount: ids.length,
      contactableCount: contactable,
      freshestAt,
      cohortHash: cohortHashOf(ids),
      rank: multiplier * ids.length,
    });
  }

  out.sort((a, b) => b.rank - a.rank || a.signalFamily.localeCompare(b.signalFamily));
  return out.slice(0, PROPOSALS_MAX);
}

/** "3 steps · email → LinkedIn → email" — the card's cadence line. */
export function cadenceSummary(template: ProvenSequenceTemplate): string {
  const CHANNEL_LABEL: Record<TemplateStepType, string> = {
    email: "email",
    linkedin_message: "LinkedIn",
    phone_task: "call",
  };
  const chain = template.steps.map((s) => CHANNEL_LABEL[s.stepType]).join(" → ");
  return `${template.steps.length} steps · ${chain}`;
}

/** Cadence line for a template id; empty string when the id is unknown
 *  (defensive — FAMILY_TO_TEMPLATE only maps to catalog ids). */
export function cadenceSummaryFor(templateId: string): string {
  const t = getTemplate(templateId);
  return t ? cadenceSummary(t) : "";
}
