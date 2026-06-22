/**
 * Spec 17 — contact email verification waterfall + send-eligibility guards.
 * See _specs/17-email-verification-waterfall/RECONCILE.md.
 */

export {
  type EmailVerificationStatus,
  type CandidateEmail,
  type VerifySignal,
  type VerifyProvider,
  type EmailVerification,
  type VerifyCache,
  type MeterOp,
  type VerifyEmailDeps,
  type FindAndVerifyDeps,
  EMAIL_VERIFY_TTL_MS,
  isSyntaxValid,
  statusFromSignal,
  verifyEmail,
  findAndVerifyEmail,
} from "./verify-email";

export {
  type SendEligibilityContact,
  EMAIL_SENDABLE_STATUSES,
  isEmailSendable,
  isLinkedInSendable,
  sendEligibility,
} from "./send-eligibility";
