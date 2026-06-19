/**
 * Deterministic per-mailbox color (A3) — a stable dot color for each connected
 * mailbox in the rail. Pure, total, token-only: the same id always maps to the
 * same palette token, and adding/removing a mailbox never recolors the others
 * (a content hash, not a positional index). No imports, no state, no I/O.
 */

/** Eight distinct badge palette tokens (defined in globals.css, dark-mode aware). */
export const MAILBOX_PALETTE: readonly string[] = [
  "var(--color-badge-0)",
  "var(--color-badge-1)",
  "var(--color-badge-2)",
  "var(--color-badge-3)",
  "var(--color-badge-4)",
  "var(--color-badge-5)",
  "var(--color-badge-6)",
  "var(--color-badge-7)",
];

/** FNV-1a 32-bit hash — stable across runs, well-distributed for short ids. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** A stable palette token for a mailbox id; nullish/empty → the fixed fallback slot. */
export function colorForMailbox(id: string | null | undefined): string {
  const s = (id ?? "").trim();
  if (!s) return MAILBOX_PALETTE[0];
  return MAILBOX_PALETTE[fnv1a(s) % MAILBOX_PALETTE.length];
}
