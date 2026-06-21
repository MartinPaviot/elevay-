/**
 * Optional Gmail-filter persistence for noise demotion (B4 R4) — best-effort,
 * capability-gated, never throws, never blocks the in-app override.
 *
 * VERIFIED SCOPE GAP: the granted Google scope is gmail.readonly + calendar
 * (src/auth.ts), but gmail.users.settings.filters.create requires
 * gmail.settings.basic / gmail.modify, which is NOT granted. So for a Gmail box
 * this returns { persisted:false, reason:"scope_not_granted" } WITHOUT making a
 * guaranteed-403 API call — the shim lights up the moment an A-track incremental
 * re-consent adds the scope (then this function makes the real
 * settings.filters.create call). The in-app demotion (the override store) is the
 * source of truth and is fully functional with zero provider involvement.
 */

import { db } from "@/db";
import { connectedMailboxes } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export type PersistResult =
  | { persisted: true; filterId: string }
  | { persisted: false; reason: "scope_not_granted" | "provider_unsupported" | "not_connected" | "error" };

export async function persistNoiseFilter(userId: string, _sender: string): Promise<PersistResult> {
  try {
    const boxes = await db
      .select({ provider: connectedMailboxes.provider })
      .from(connectedMailboxes)
      .where(and(eq(connectedMailboxes.userId, userId), eq(connectedMailboxes.status, "active")));

    if (boxes.length === 0) return { persisted: false, reason: "not_connected" };

    const hasGmail = boxes.some((b) => b.provider === "gmail");
    if (hasGmail) {
      // The granted scope (gmail.readonly) can't create a server filter; needs an
      // incremental re-consent for gmail.settings.basic (A-track). Typed no-op.
      return { persisted: false, reason: "scope_not_granted" };
    }

    // Outlook / smtp_custom (EmailEngine/IMAP) have no equivalent one-call filter
    // we control here — the in-app demotion remains the source of truth.
    return { persisted: false, reason: "provider_unsupported" };
  } catch {
    return { persisted: false, reason: "error" };
  }
}
