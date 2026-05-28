/**
 * Bulk approve — pure validation helpers (B5, _specs/pilae-machine/spec-v2.md R7.4).
 *
 * The batch endpoint `POST /api/sequences/drafts/bulk-approve` runs:
 *   1. validateBulkInput()   — sanity-check request body
 *   2. fetch all drafts (tenant-scoped, by ids)
 *   3. validateBulkApprove() — per-draft `canTransition()` over the
 *      state machine; fails the whole batch if any draft can't move
 *   4. db.transaction() — atomically flip the surviving drafts to
 *      `approved`, asserting `version` to catch races
 *
 * Atomicity rationale (R7.4 / guardrail): if a founder selects 12
 * drafts and one was just rejected by a parallel reviewer (or expired
 * by the 24h cron), we DO NOT half-approve. The batch returns 409 with
 * the list of failures and the founder retries with the surviving ids.
 * Half-approving would mute the version-mismatch signal that the state
 * machine was designed to surface.
 *
 * MAX_BATCH_SIZE is set at 100 to mirror the single-tenant manual enroll
 * cap in `/api/sequences/:id/enroll`. Higher batches would just chunk
 * client-side; lower would be needlessly chatty during a daily morning
 * review session.
 */

import { canTransition, type DraftStatus } from "./state-machine";

export const MAX_BATCH_SIZE = 100;

export type BulkInputValidation =
  | { ok: true; ids: string[] }
  | { ok: false; error: string };

export function validateBulkInput(ids: unknown): BulkInputValidation {
  if (!Array.isArray(ids)) {
    return { ok: false, error: "`ids` must be an array" };
  }
  if (ids.length === 0) {
    return { ok: false, error: "`ids` cannot be empty" };
  }
  if (ids.length > MAX_BATCH_SIZE) {
    return {
      ok: false,
      error: `Maximum ${MAX_BATCH_SIZE} drafts per batch (got ${ids.length})`,
    };
  }
  if (!ids.every((id) => typeof id === "string" && id.length > 0)) {
    return { ok: false, error: "All ids must be non-empty strings" };
  }
  // Dedupe: a single draft passed twice would generate two version
  // bumps in the transaction and the second would race-fail.
  const unique = Array.from(new Set(ids as string[]));
  return { ok: true, ids: unique };
}

export type DraftForBulkValidation = {
  id: string;
  status: DraftStatus;
};

export type BulkApproveValidation = {
  ok: boolean;
  failures: Array<{ id: string; reason: string }>;
};

/**
 * Run `canTransition("approve")` against every draft. The batch is
 * approvable only when ALL drafts pass — one bad draft fails the whole
 * thing. Caller responds 409 with the failures list.
 */
export function validateBulkApprove(
  drafts: DraftForBulkValidation[],
): BulkApproveValidation {
  const failures: Array<{ id: string; reason: string }> = [];
  for (const d of drafts) {
    const t = canTransition(d.status, "approve");
    if (!t.allowed) {
      failures.push({
        id: d.id,
        reason: t.reason ?? `Cannot approve from '${d.status}'`,
      });
    }
  }
  return { ok: failures.length === 0, failures };
}

/**
 * Detect the "some requested ids were not found / belong to another
 * tenant" case. Both situations resolve to 404 at the endpoint to
 * avoid leaking cross-tenant existence.
 */
export function findMissingIds(
  requested: string[],
  found: { id: string }[],
): string[] {
  const foundSet = new Set(found.map((d) => d.id));
  return requested.filter((id) => !foundSet.has(id));
}
