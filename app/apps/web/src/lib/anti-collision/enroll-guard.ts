/**
 * Spec 14 — the shared enrollment guard the live enroll sites call before
 * creating a sequenceEnrollments row.
 *
 * SAFE ROLLOUT on a live path: the lock is always acquired (so collisions are
 * recorded and observable), but a lost claim only BLOCKS when
 * `ANTI_COLLISION_ENFORCE` is on. Default OFF = record-only = zero behavior
 * change. FAIL-OPEN: any lock-store error proceeds (a lock outage must never
 * halt enrollment). Flip the flag once the lock is proven in record-only.
 */

import { acquireEnrollmentLock, releaseEnrollmentLock, DEFAULT_LOCK_TTL_MS } from "./collision";
import { collisionLockForTenant } from "./db-lock";
import { recordCollisionRow } from "./db-collision-log";
import { db } from "@/db";
import { sequenceEnrollments } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Enforcement flag. Default OFF — record-only until the lock is proven live. */
export function isAntiCollisionEnforced(): boolean {
  const v = process.env.ANTI_COLLISION_ENFORCE;
  return v === "1" || v === "true";
}

export interface EnrollGuardResult {
  /** Whether the caller may create the enrollment. */
  proceed: boolean;
  /** The enrollment already holding the contact, when a collision was detected. */
  collidedWith: string | null;
  /** True when proceed was forced by record-only mode (a collision was ignored). */
  recordedOnly: boolean;
}

/**
 * Try to claim `contactId` for `enrollmentId` before enrolling. Returns whether
 * to proceed. Never throws — a lock error fails open.
 */
export async function guardEnrollment(args: {
  tenantId: string | null;
  contactId: string;
  enrollmentId: string;
  ttlMs?: number;
}): Promise<EnrollGuardResult> {
  const { tenantId, contactId, enrollmentId, ttlMs } = args;
  try {
    let collidedWith: string | null = null;
    const won = await acquireEnrollmentLock(contactId, enrollmentId, {
      lock: collisionLockForTenant(tenantId),
      ttlMs: ttlMs ?? DEFAULT_LOCK_TTL_MS,
      recordCollision: async (rec) => {
        collidedWith = rec.heldBy;
        const enforced = isAntiCollisionEnforced();
        console.warn(
          `[anti-collision] contact ${contactId} held by enrollment ${rec.heldBy}; ` +
            `blocked enrollment ${enrollmentId} (enforced=${enforced})`,
        );
        // Observe-phase persistence (spec 14): record the would-have-blocked
        // event so the collision rate is measurable before flipping to enforce.
        // Best-effort — recordCollisionRow swallows its own errors.
        await recordCollisionRow(tenantId, rec, enforced);
      },
    });
    if (won) return { proceed: true, collidedWith: null, recordedOnly: false };
    // Lost the claim: block only when enforcement is on; else record-only.
    if (isAntiCollisionEnforced()) return { proceed: false, collidedWith, recordedOnly: false };
    return { proceed: true, collidedWith, recordedOnly: true };
  } catch {
    // Lock store unavailable — never halt enrollment on infra error.
    return { proceed: true, collidedWith: null, recordedOnly: false };
  }
}

/**
 * Release a contact's lock on a terminal enrollment event (complete / reply /
 * opt-out). Never throws. Pass `enrollmentId` to FENCE the release to the holder
 * (a late/duplicate terminal event for a prior enrollment can't free a
 * re-enrolled contact's lock); omit it for an unconditional release.
 */
export async function releaseEnrollment(
  tenantId: string | null,
  contactId: string,
  enrollmentId?: string,
): Promise<void> {
  try {
    await releaseEnrollmentLock(contactId, { lock: collisionLockForTenant(tenantId) }, enrollmentId);
  } catch {
    /* best-effort; the TTL self-heals a stuck lock */
  }
}

/**
 * Release by enrollment id — resolves the enrollment's contact, then frees the
 * lock, FENCED to this enrollment so a late/duplicate terminal event can't free a
 * successor's lock (the re-enrol/nurture-recycle race). For terminal-status sites
 * that hold only the enrollmentId. The DELETE keys on the globally-unique
 * contactId + this enrollmentId, so tenant binding is unneeded here. Never throws
 * (best-effort; the 30-day TTL self-heals if this is ever missed).
 */
export async function releaseEnrollmentById(enrollmentId: string): Promise<void> {
  try {
    const [row] = await db
      .select({ contactId: sequenceEnrollments.contactId })
      .from(sequenceEnrollments)
      .where(eq(sequenceEnrollments.id, enrollmentId))
      .limit(1);
    if (row?.contactId) await releaseEnrollment(null, row.contactId, enrollmentId);
  } catch {
    /* best-effort */
  }
}
