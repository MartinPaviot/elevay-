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

/** Strip any existing signature block, then append the given one once (swap-safe). */
export function applySignature(body: string, signature: string | undefined): string {
  const stripped = stripSignature(body ?? "");
  const sig = (signature ?? "").trim();
  if (!sig) return stripped;
  return `${stripped}\n\n-- \n${sig}`;
}
