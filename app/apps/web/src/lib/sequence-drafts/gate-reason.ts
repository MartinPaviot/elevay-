/**
 * T11c — a human, one-line "why" from a gate's reasons jsonb. Each gate
 * stores a DIFFERENT shape (G1: reason code; G2: ungrounded tokens; G4:
 * grader issues / threshold; G5: transport failures), so extraction is
 * per-gate. Pure (no db, no I/O) so the review context route can import it
 * and a test can exercise it without the db module graph. Returns null when
 * there is nothing quotable.
 */
export function gateReasonText(gate: number, reasons: unknown): string | null {
  const r = (reasons ?? {}) as Record<string, unknown>;
  const list = (v: unknown, n = 3): string | null =>
    Array.isArray(v) && v.length > 0 ? v.slice(0, n).map(String).join(", ") : null;
  if (gate === 1) return typeof r.reason === "string" ? r.reason : null;
  if (gate === 2) {
    const ung = list(r.ungrounded);
    return ung ? `Unverifiable: ${ung}` : null;
  }
  if (gate === 4) {
    const issues = list(r.issues);
    return issues ?? (typeof r.threshold === "number" ? `Below quality threshold ${r.threshold}` : null);
  }
  if (gate === 5) {
    const fail = list(r.failures);
    return fail ? `Content: ${fail}` : null;
  }
  return null;
}
