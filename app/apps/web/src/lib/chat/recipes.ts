/**
 * Recipe catalog for the chat opener (v2) — capability-showcase chips,
 * gated on what the tenant's data can actually demo and slot-filled with
 * the tenant's own numbers. Deterministic: no inference, no storage.
 * See _specs/chat-opener/v2-recipe-catalog.md.
 *
 * Three rules, in order:
 * 1. GATE — a recipe only appears when the demo will land (a call-list
 *    chip with 0 phone numbers is a broken promise).
 * 2. SLOTS — labels carry real counts/names ("Scan my 885 accounts…"):
 *    the chip itself proves the agent knows the workspace.
 * 3. ROTATION — when more recipes are eligible than slots, a day-based
 *    circular pick cycles through them (discovery without an impression
 *    store; click-based ranking is deferred to v3).
 */

import type { OpenerChip } from "@/lib/chat/opener";

/** Cheap per-tenant counts the opener route assembles (each fail-soft). */
export interface TenantSignals {
  contactsTotal: number;
  contactsWithPhone: number;
  companiesTotal: number;
  knowledgeEntries: number;
  openDeals: number;
  icpCount: number;
  /** Inbound emails (activities email_received) in the last 7 days. */
  inbound7d: number;
  /** Largest account list, when one exists. */
  biggestList: { id: string; name: string; members: number } | null;
  sequencesTotal: number;
  sequencesWithEnrollments: number;
}

export const EMPTY_TENANT_SIGNALS: TenantSignals = {
  contactsTotal: 0,
  contactsWithPhone: 0,
  companiesTotal: 0,
  knowledgeEntries: 0,
  openDeals: 0,
  icpCount: 0,
  inbound7d: 0,
  biggestList: null,
  sequencesTotal: 0,
  sequencesWithEnrollments: 0,
};

interface RecipeDef {
  id: string;
  /** Lower = earlier in the eligible ordering (before rotation). */
  priority: number;
  /** Skip this recipe when a work chip of this kind already covers it. */
  redundantWithWorkKind?: OpenerChip["kind"];
  /**
   * Pre-routing hint: the single tool that answers this recipe (forced
   * on the first agent step by /api/chat). Multi-step recipes
   * (cold-sequence, enroll-list) leave it unset and keep the free loop.
   */
  tool?: string;
  gate(s: TenantSignals): boolean;
  label(s: TenantSignals): string;
  send(s: TenantSignals): string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The catalog. Every send targets a tool verified in the registry
 * (tool-router.ts) and stays draft-only / HITL-gated — a recipe never
 * sends or enrolls on its own.
 */
const CATALOG: RecipeDef[] = [
  {
    // The cold-start unlock: fdf9b795-class tenants have companies but no ICP.
    id: "recipe:define-icp",
    tool: "defineICP",
    priority: 10,
    gate: (s) => s.icpCount === 0 && s.companiesTotal >= 50,
    label: (s) => `Define my ICP from my ${s.companiesTotal} accounts`,
    send: () =>
      "Research my accounts and define my ICP. I have no ICP defined yet.",
  },
  {
    id: "recipe:call-list",
    tool: "getCallList",
    priority: 20,
    gate: (s) => s.contactsWithPhone >= 10,
    // "with phones" not "callable": the Call Mode queue then filters to
    // verified/reachable (DNC, quiet hours) — live on Pilae 152 phones
    // yielded a 1-contact queue. The chip must not overpromise.
    label: (s) => `Build today's call list (${s.contactsWithPhone} with phones)`,
    send: () => "Build my call list for today. Who should I call first?",
  },
  {
    // Gated on the KB: without assets the autopilot writes empty bodies
    // (copy-quality eval 2026-06-26) — never demo that.
    id: "recipe:cold-sequence",
    priority: 30,
    gate: (s) => s.knowledgeEntries > 0 && s.contactsTotal >= 20,
    label: (s) =>
      s.biggestList
        ? `Draft a cold sequence for "${s.biggestList.name}"`
        : "Draft a cold outreach sequence",
    send: (s) =>
      s.biggestList
        ? `Draft a cold outreach sequence targeting my "${s.biggestList.name}" account list. Ground the copy in my knowledge base. Draft only, do not enroll or send anyone.`
        : "Draft a cold outreach sequence for my ICP. Ground the copy in my knowledge base. Draft only, do not enroll or send anyone.",
  },
  {
    id: "recipe:inbound-recap",
    tool: "searchEmailsByMetadata",
    priority: 40,
    gate: (s) => s.inbound7d > 0,
    label: (s) => `Recap the ${plural(s.inbound7d, "email")} received this week`,
    send: () =>
      "Summarize the emails I received in the last 7 days. What needs attention?",
  },
  {
    id: "recipe:deals-at-risk",
    tool: "getDealsAtRisk",
    priority: 50,
    redundantWithWorkKind: "deal_risk",
    gate: (s) => s.openDeals > 0,
    label: (s) => `Check my ${plural(s.openDeals, "open deal")} for risk`,
    send: () => "Which deals are at risk?",
  },
  {
    id: "recipe:enroll-list",
    priority: 60,
    gate: (s) => (s.biggestList?.members ?? 0) >= 10 && s.sequencesTotal > 0,
    label: (s) =>
      `Enroll "${s.biggestList!.name}" (${s.biggestList!.members} accounts) in a campaign`,
    send: (s) =>
      `Enroll my "${s.biggestList!.name}" account list in the most appropriate sequence. Walk me through your plan before enrolling anyone.`,
  },
  {
    id: "recipe:signals-scan",
    tool: "scanSignals",
    priority: 70,
    gate: (s) => s.companiesTotal >= 50,
    label: (s) => `Scan my ${s.companiesTotal} accounts for buying signals`,
    send: () =>
      "Scan my accounts for buying signals like funding rounds and hiring. What did you find?",
  },
  {
    id: "recipe:sequence-performance",
    tool: "analyzeSequencePerformance",
    priority: 80,
    gate: (s) => s.sequencesWithEnrollments > 0,
    label: () => "How are my campaigns performing?",
    send: () =>
      "Analyze my sequence performance. Which campaigns work and which do not?",
  },
];

/** Exposed for tests (ids + count assertions without export-ing defs). */
export const RECIPE_IDS = CATALOG.map((r) => r.id);

/**
 * Pick up to `slots` recipe chips for this tenant/day.
 *
 * Eligible recipes are ordered by priority, then the start offset rotates
 * with the day (UTC day number), wrapping circularly — every eligible
 * recipe surfaces within eligible.length days, and the pick is stable
 * within a day (cache-friendly, resume-safe).
 *
 * `workKinds` drops recipes already covered by a work chip (a deal_risk
 * chip makes "check my deals for risk" noise).
 */
export function selectRecipeChips(
  signals: TenantSignals,
  slots: number,
  now: Date,
  workKinds: ReadonlySet<string> = new Set(),
): OpenerChip[] {
  if (slots <= 0) return [];
  const eligible = CATALOG.filter(
    (r) =>
      r.gate(signals) &&
      !(r.redundantWithWorkKind && workKinds.has(r.redundantWithWorkKind)),
  ).sort((a, b) => a.priority - b.priority);
  if (eligible.length === 0) return [];

  const dayIndex = Math.floor(now.getTime() / 86_400_000);
  const offset = dayIndex % eligible.length;
  const picked: RecipeDef[] = [];
  for (let i = 0; i < Math.min(slots, eligible.length); i++) {
    picked.push(eligible[(offset + i) % eligible.length]);
  }

  return picked.map((r) => ({
    id: r.id,
    kind: "recipe" as const,
    label: r.label(signals),
    send: r.send(signals),
    ...(r.tool ? { tool: r.tool } : {}),
  }));
}
