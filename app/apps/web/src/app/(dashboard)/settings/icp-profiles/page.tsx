/**
 * /settings/icp-profiles → /settings/icp (Phase 1,
 * _specs/icp-unification R4.1). The rule-builder that lived here is now
 * the "Advanced criteria" disclosure of the unified ICP page; this
 * route survives only as a redirect for old links.
 */

import { redirect } from "next/navigation";

export default function IcpProfilesRedirect() {
  redirect("/settings/icp");
}
