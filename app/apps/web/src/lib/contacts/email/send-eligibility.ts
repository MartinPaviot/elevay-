/**
 * Spec 17 — the verified-before-sequence invariant, enforced as a guard the
 * sending path (spec 23) READS, not as an optional flag (design note). AC2: an
 * unverified contact is not email-sendable. AC3: an invalid email excludes the
 * contact from email sends WHILE leaving LinkedIn eligibility intact when a
 * linkedin_url is known.
 */

import type { EmailVerificationStatus } from "./verify-email";

/** Statuses cleared for email sending. Default = only `valid` (strict, protects
 * domain reputation). `catch_all` / `risky` can be opted in per campaign by
 * passing a wider set — they are NOT sendable by default. */
export const EMAIL_SENDABLE_STATUSES: ReadonlySet<EmailVerificationStatus> = new Set<EmailVerificationStatus>(["valid"]);

export interface SendEligibilityContact {
  /** The authoritative verification status; null/undefined = unverified. */
  emailStatus?: EmailVerificationStatus | null;
  linkedinUrl?: string | null;
}

/**
 * AC2 — email-sendable only when verified to a sendable status. An unverified
 * contact (null/undefined status) and any non-sendable status (invalid, risky,
 * catch_all, unknown by default) are NOT email-sendable.
 */
export function isEmailSendable(
  contact: SendEligibilityContact,
  sendable: ReadonlySet<EmailVerificationStatus> = EMAIL_SENDABLE_STATUSES,
): boolean {
  return !!contact.emailStatus && sendable.has(contact.emailStatus);
}

/**
 * AC3 — LinkedIn eligibility is independent of email status: a contact with a
 * known linkedin_url stays LinkedIn-eligible even when their email is invalid.
 */
export function isLinkedInSendable(contact: SendEligibilityContact): boolean {
  return !!(contact.linkedinUrl && contact.linkedinUrl.trim());
}

/** Convenience: the per-channel send-eligibility partition for one contact. */
export function sendEligibility(
  contact: SendEligibilityContact,
  sendable?: ReadonlySet<EmailVerificationStatus>,
): { email: boolean; linkedin: boolean } {
  return { email: isEmailSendable(contact, sendable), linkedin: isLinkedInSendable(contact) };
}
