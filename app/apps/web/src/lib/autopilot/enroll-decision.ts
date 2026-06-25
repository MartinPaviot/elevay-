/**
 * Spec 37 (B2.2) — daily-autopilot enroll decision. PURE: maps the tenant's
 * approval mode (+ an explicit kill-switch) to whether the autopilot auto-enrolls
 * a selected prospect or queues it as a draft for human review.
 *
 * CRITICAL (R4.2): this is an ADDITIVE capability. It does NOT touch the shared
 * `sequence-enrollment` guarded-action gate (approval-mode.ts:155, confirm:"always")
 * or its 9 callers — they keep requiring confirmation. Only the autopilot path
 * consults this, so the founder's existing manual flows are unchanged.
 *
 * Blast radius: lib/autopilot/* only (imports a type from approval-mode, no runtime dep).
 */

import type { ApprovalModeV2 } from "@/lib/guardrails/approval-mode";

export type AutopilotEnrollAction = "auto" | "draft";

/**
 * `auto-high-confidence` → auto-enroll; `batch-daily` / `review-each` → draft.
 * `autopilotAutoEnroll === false` is a kill-switch: draft regardless of mode. The
 * permission defaults to following the mode (an explicit true never UPGRADES a
 * review/batch tenant to auto — that would defeat human-in-the-loop).
 */
export function decideAutopilotEnrollment(
  mode: ApprovalModeV2,
  opts: { autopilotAutoEnroll?: boolean } = {},
): AutopilotEnrollAction {
  if (opts.autopilotAutoEnroll === false) return "draft";
  return mode === "auto-high-confidence" ? "auto" : "draft";
}
