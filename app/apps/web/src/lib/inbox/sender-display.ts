/**
 * Human display of a raw RFC-5322 From header ("Jane Doe <jane@x.com>").
 *
 * The inbox deliberately never auto-promotes an inbound stranger to a CRM
 * contact (email-capture.ts CRM-graph rule), so most conversations only carry
 * the raw header. Live audit 2026-07-02: the UI rendered that raw header
 * verbatim in the list rows, the pane header (twice, side by side), the
 * per-message sender line and even the booking payload's contactName. These
 * helpers parse the header once so every surface shows "Jane Doe" with the
 * address as secondary metadata — matching what the capture path already does
 * server-side (extractNameFromHeader) without importing server code into
 * client components.
 *
 * Pure + unit-tested (sender-display.test.ts); safe for client and server.
 */

/** "Jane Doe <jane@x.com>" -> "jane@x.com"; "jane@x.com" -> itself. Lowercased. */
export function senderEmailOf(header: string | null | undefined): string {
  if (!header) return "";
  const m = header.match(/<([^>]+)>/);
  return (m ? m[1] : header).trim().toLowerCase();
}

/**
 * "Jane Doe <jane@x.com>" -> "Jane Doe"; '"Doe, Jane" <j@x>' -> "Doe, Jane";
 * "jane@x.com" -> "jane@x.com" (no name part — the address IS the display).
 */
export function senderNameOf(header: string | null | undefined): string {
  if (!header) return "";
  const m = header.match(/^([^<]+)</);
  const name = m ? m[1].trim().replace(/^"|"$/g, "").trim() : "";
  return name || senderEmailOf(header);
}

/**
 * Split a multi-recipient header ('a@x.com, "Doe, Jane" <j@y.com>') into its
 * individual mailbox parts, comma-splitting OUTSIDE quoted display-names so
 * '"Doe, Jane"' stays one recipient. Client-safe twin of user-scope.ts's
 * headerAddresses (which lives in a db-importing module the pane can't pull).
 */
export function recipientPartsOf(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((p) => p.trim())
    .filter(Boolean);
}
