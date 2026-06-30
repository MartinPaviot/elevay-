/**
 * Per-mailbox signature helpers (A3) — pure, DB-free, so they are safe to import
 * from BOTH the client composer and the server identity store. The signature uses
 * the standard "-- " email marker; strip-then-append keeps it idempotent +
 * swap-safe so it is never duplicated when the From mailbox changes or on send.
 */

/** Remove a trailing "-- " signature block (idempotent; no-op without a marker). */
export function stripSignature(body: string): string {
  return (body ?? "").replace(/\n+-- \n[\s\S]*$/, "").replace(/\s+$/, "");
}

/**
 * Split a body into [message, signatureBlock] at the trailing "-- " marker. The
 * signatureBlock keeps its leading separator (so message + signatureBlock === body)
 * and is "" when there's no signature. Lets callers append into the message part
 * ABOVE the signature — so a later signature swap (which strips to end-of-body)
 * can't wipe the appended content (e.g. a booked meeting link).
 */
export function splitSignature(body: string): [string, string] {
  const b = body ?? "";
  const m = b.match(/\n+-- \n[\s\S]*$/);
  return m && m.index != null ? [b.slice(0, m.index), b.slice(m.index)] : [b, ""];
}

/** Strip any existing signature block, then append the given one once (swap-safe). */
export function applySignature(body: string, signature: string | undefined): string {
  const stripped = stripSignature(body ?? "");
  const sig = (signature ?? "").trim();
  if (!sig) return stripped;
  return `${stripped}\n\n-- \n${sig}`;
}
