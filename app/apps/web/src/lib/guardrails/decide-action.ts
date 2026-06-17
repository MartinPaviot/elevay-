/**
 * decideAction — the single decision authority for the Chat Live Executor
 * (README §3.5bis). One function decides whether an action — headless OR a
 * page action — executes directly, shows a confirm card, queues, or is refused.
 *
 * STATUS: CONSERVATIVE STUB (CLE-04). The SIGNATURE below is the frozen contract
 * (README §3.5bis) and MUST NOT change. CLE-10 replaces the BODY with the unified
 * control plane: it will fold in `approvalMode` (review-each/batch-daily/
 * auto-high-confidence) and a real `confidence` signal, and it will absorb
 * CLE-00's `chatCreateDisposition` (approval-mode.ts) so create/update tools,
 * invokePageAction, and the background loops all route through this one function.
 *
 * Until then this stub gates on action METADATA + ROLE only (it accepts
 * `approvalMode`/`confidence` to fix the signature, but does not branch on them).
 * Every defaulting path resolves toward MORE confirmation, never less — the
 * "zero silent actions" posture CLE-00 established.
 */

import type { ApprovalModeV2 } from "@/lib/guardrails/approval-mode";

export type ActionDisposition = "execute" | "confirm" | "queue" | "refuse";

export interface DecideActionInput {
  action: {
    mutating: boolean;
    outbound?: boolean;
    reversible?: boolean;
    cost?: "free" | "credits" | "money";
    confirm: "never" | "risky" | "always";
  };
  approvalMode: ApprovalModeV2; // SSOT via readApprovalMode() — accepted now, branched on in CLE-10
  role: "admin" | "member" | "viewer";
  confidence?: number; // accepted now, branched on in CLE-10/CLE-16
}

export interface DecideActionResult {
  disposition: ActionDisposition;
  reason: string;
}

// Signature matches README §3.5bis as amended by §3.8 (CLE-10/CLE-16): an OPTIONAL 2nd
// arg `extra` is part of the frozen signature. The CLE-04 stub accepts but ignores it
// (CLE-10 fills the body; CLE-16 passes `extra.learnedThresholds`), so the signature
// never changes downstream.
export function decideAction(
  input: DecideActionInput,
  _extra?: { actionKey?: string; learnedThresholds?: Record<string, number> },
): DecideActionResult {
  const { action, role } = input;

  // Defensive normalization: a conformant manifest is already typed, but a
  // malformed scalar must fail SAFE.
  const mutating = typeof action.mutating === "boolean" ? action.mutating : true;
  const outbound = action.outbound === true;
  const reversible = action.reversible === true;
  const cost = action.cost ?? "free";
  const confirmPolicy =
    action.confirm === "never" || action.confirm === "risky" || action.confirm === "always"
      ? action.confirm
      : "always"; // unknown → safest

  // 1. Viewer may only drive pure-read actions. Any mutation/outbound → refuse.
  //    (The page-action TOOLS are reachable by viewers — the gate is HERE, not
  //    in capability-resolver. CLE-12 generalizes this into the unified matrix.)
  if (role === "viewer" && (mutating || outbound)) {
    return {
      disposition: "refuse",
      reason: "role:viewer — read-only; mutating/outbound actions require a member or admin",
    };
  }

  // 2. Spending money is always confirmed, regardless of mode.
  if (outbound && cost === "money") {
    return { disposition: "confirm", reason: "outbound+cost:money — always confirm a paid send" };
  }

  // 3. Any external send is confirmed (under the user's eyes).
  if (outbound) {
    return { disposition: "confirm", reason: "outbound — confirm external send" };
  }

  // 4. Irreversible mutation is always confirmed.
  if (mutating && !reversible) {
    return { disposition: "confirm", reason: "mutating+!reversible — confirm irreversible change" };
  }

  // 5. Reversible mutation honours the action's own confirm policy.
  if (mutating && reversible) {
    if (confirmPolicy === "always" || confirmPolicy === "risky") {
      return { disposition: "confirm", reason: `mutating+reversible, confirm:${confirmPolicy}` };
    }
    return { disposition: "execute", reason: "mutating+reversible, confirm:never — safe to execute" };
  }

  // 6. Pure read (filters, view toggles): execute. Allowed even for viewers.
  return { disposition: "execute", reason: "read-only action — execute" };
}
