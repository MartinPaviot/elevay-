/**
 * Enrollment eligibility check — single source of truth for "can this
 * contact be enrolled into an outbound sequence right now?".
 *
 * Two consumers today:
 *   - /api/sequences/:id/enroll        (manual founder enrollment)
 *   - inngest/signal-to-sequence.ts    (auto-enroll on fresh signal)
 *
 * Both must reject contacts whose company carries an anti-ICP
 * `excluded_reason`, otherwise the founder can bypass anti-ICP rules
 * by re-enrolling. See _specs/pilae-machine/spec-v2.md (R2.3, R3.3, B1).
 *
 * Kept as a pure function so it tests without a DB and behaves
 * identically across both code paths.
 */

export type ContactEligibilityInput = {
  email: string | null;
  deletedAt: Date | null;
  companyExcludedReason: string | null;
  // P0-5 — presence in the tenant's email_optouts (hard bounce / complaint /
  // opt-out). Any non-null reason suppresses; null/undefined = not suppressed.
  suppressedReason?: "hard_bounce" | "complaint" | "opt_out" | null;
  /**
   * M13-G1 (outreach-autopilot T5) — the "why NOW" rule: an enrollment needs
   * at least one FRESH signal, and — when the tenant actually scores ICP fit —
   * a minimum fit. Populate via `loadG1Context` (lib/sequences/
   * eligibility-context.ts); omitted = legacy caller = G1 not evaluated (the
   * drift-guard tracks adoption).
   */
  g1?: G1Context;
};

export type G1Context = {
  /** Fresh (non-expired) signals on the contact's company — TTL per type. */
  freshSignalCount: number;
  /** companies.score — primary-ICP fit 0-100, null when never scored. */
  icpScore: number | null;
  /**
   * True when the tenant has ANY ICP-scored company. With no ICP model the
   * threshold is meaningless — G1 then degrades to the fresh-signal rule
   * alone (sane default, M11-R5) instead of blocking every enrollment.
   */
  icpScoringActive: boolean;
};

/** G1 fit threshold (companies.score is 0-100). One reviewed constant. */
export const G1_MIN_ICP_SCORE = 50;

export type EligibilityReason =
  | "deleted"
  | "no_email"
  | "suppressed" // P0-5
  | "excluded_company"
  | "no_fresh_signal" // M13-G1 / INV-2
  | "below_icp_threshold"; // M13-G1

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: EligibilityReason };

/**
 * Decide whether a contact can be enrolled in an outbound sequence.
 * Order is intentional — deletion overrides everything else, then
 * missing email (we can't email without one), then anti-ICP exclusion.
 */
export function checkContactEligibility(
  input: ContactEligibilityInput,
): EligibilityResult {
  if (input.deletedAt) return { eligible: false, reason: "deleted" };
  if (!input.email) return { eligible: false, reason: "no_email" };
  // Deliverability beats ICP: we already burned this address (bounce/complaint/
  // opt-out), so never re-email it regardless of company fit. (P0-5)
  if (input.suppressedReason) return { eligible: false, reason: "suppressed" };
  if (input.companyExcludedReason) {
    return { eligible: false, reason: "excluded_company" };
  }
  // M13-G1 — no fresh signal = no enrollment, whatever the static fit (INV-2:
  // "pas de signal pertinent = pas d'entrée en séquence"). The ICP threshold
  // only bites when the tenant actually scores fit.
  if (input.g1) {
    if (input.g1.freshSignalCount < 1) {
      return { eligible: false, reason: "no_fresh_signal" };
    }
    if (
      input.g1.icpScoringActive &&
      (input.g1.icpScore ?? 0) < G1_MIN_ICP_SCORE
    ) {
      return { eligible: false, reason: "below_icp_threshold" };
    }
  }
  return { eligible: true };
}

export type CompanyEligibilityInput = {
  excludedReason: string | null;
  deletedAt: Date | null;
};

/**
 * Coarser company-level check used by signal-to-sequence before it
 * even fetches contacts. Saves a round-trip when the company itself
 * is anti-ICP-flagged or soft-deleted.
 */
export function isCompanyEligible(input: CompanyEligibilityInput): boolean {
  return !input.deletedAt && !input.excludedReason;
}
