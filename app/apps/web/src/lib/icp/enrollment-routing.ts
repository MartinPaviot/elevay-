/**
 * ICP-scoped enrollment routing (P3, _specs/multi-icp R9). Pure.
 *
 * When a company is about to be enrolled into an outbound sequence,
 * and the company fits one or more ICPs, we want it to ride the
 * sequence bound to its PRIMARY ICP (message/cadence tuned to that
 * segment) rather than a generic tenant-wide one.
 *
 * `pickIcpScopedSequence` is the routing decision:
 *   1. If the company has a primary ICP AND an active sequence is bound
 *      to that ICP → use it.
 *   2. Else fall back to a tenant-wide sequence (icpId === null).
 *   3. Else null — the caller keeps its existing selection logic
 *      (e.g. pickSequenceForSignal) so this is purely additive.
 *
 * The caller resolves the primary ICP from the company_icp_fit matrix
 * (companies.properties.primaryIcpId, written by the recompute job)
 * and passes the tenant's active sequences with their icpId.
 */

export type SequenceRef = {
  id: string;
  icpId: string | null;
};

export type EnrollmentRoutingResult =
  | { sequenceId: string; reason: "primary_icp_match" | "tenant_wide_fallback" }
  | { sequenceId: null; reason: "no_match" };

export function pickIcpScopedSequence(
  primaryIcpId: string | null,
  sequences: SequenceRef[],
): EnrollmentRoutingResult {
  // 1. Sequence bound to the company's primary ICP wins.
  if (primaryIcpId) {
    const bound = sequences.find((s) => s.icpId === primaryIcpId);
    if (bound) {
      return { sequenceId: bound.id, reason: "primary_icp_match" };
    }
  }

  // 2. Tenant-wide sequence (not bound to any ICP) as fallback.
  const tenantWide = sequences.find((s) => s.icpId === null);
  if (tenantWide) {
    return { sequenceId: tenantWide.id, reason: "tenant_wide_fallback" };
  }

  // 3. Nothing routable — caller keeps its own logic.
  return { sequenceId: null, reason: "no_match" };
}
