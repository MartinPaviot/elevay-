/**
 * Canonical reader for the per-activity email-extraction signals.
 *
 * THE BUG THIS FIXES (found by the 2026-07-02 hostile audit): the extractor
 * persists to `metadata.llmExtraction` (email-extract-runner.ts) but every
 * consumer read `metadata.extractedSignals` — a key with NO writer anywhere —
 * so objections/next-steps/champion/budget signals were invisible to the reply
 * context brief (#601's directive never saw a real objection), the deal brief
 * ("Extracted Signals from Emails" was always "None extracted"), and the
 * pre-send coach. The shapes also diverged (written `nextSteps` objects vs read
 * `next_steps` strings).
 *
 * This helper reads BOTH keys — `llmExtraction` (the real one, EmailExtraction
 * shape) and legacy `extractedSignals` (snake_case strings; no known writer,
 * kept so any historical/manual rows still surface) — and normalizes to one
 * shape. Pure; consumers map to their local types.
 */

export interface NormalizedActivitySignals {
  objections: string[];
  nextSteps: Array<{
    action: string;
    owner: "sender" | "recipient" | "both" | "unknown";
    dueDate: string | null;
  }>;
  championSignals: string[];
  budgetMentions: string[];
  competitorMentions: string[];
}

const OWNERS = new Set(["sender", "recipient", "both", "unknown"]);

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
}

/** Normalize one activity's metadata into the signals every consumer expects. */
export function readActivitySignals(
  meta: Record<string, unknown> | null | undefined,
): NormalizedActivitySignals {
  const out: NormalizedActivitySignals = {
    objections: [],
    nextSteps: [],
    championSignals: [],
    budgetMentions: [],
    competitorMentions: [],
  };
  if (!meta) return out;

  // 1. The key the extractor actually writes (EmailExtraction shape).
  const ex = meta.llmExtraction as Record<string, unknown> | undefined;
  if (ex && typeof ex === "object" && !ex.skipped) {
    out.objections.push(...strings(ex.objections));
    out.championSignals.push(...strings(ex.championSignals));
    out.competitorMentions.push(...strings(ex.competitorsMentioned));
    if (typeof ex.budgetMentioned === "string" && ex.budgetMentioned.trim()) {
      out.budgetMentions.push(ex.budgetMentioned);
    }
    if (Array.isArray(ex.nextSteps)) {
      for (const ns of ex.nextSteps) {
        const o = ns as Record<string, unknown> | null;
        if (o && typeof o.action === "string" && o.action.trim()) {
          out.nextSteps.push({
            action: o.action,
            owner: OWNERS.has(o.owner as string) ? (o.owner as NormalizedActivitySignals["nextSteps"][number]["owner"]) : "unknown",
            dueDate: typeof o.dueDate === "string" ? o.dueDate : null,
          });
        }
      }
    }
  }

  // 2. Legacy key (snake_case strings) — no known writer, read for completeness.
  const legacy = meta.extractedSignals as Record<string, unknown> | undefined;
  if (legacy && typeof legacy === "object") {
    out.objections.push(...strings(legacy.objections));
    out.championSignals.push(...strings(legacy.champion_signals));
    out.competitorMentions.push(...strings(legacy.competitor_mentions));
    out.budgetMentions.push(...strings(legacy.budget_mentions));
    for (const ns of strings(legacy.next_steps)) {
      out.nextSteps.push({ action: ns, owner: "unknown", dueDate: null });
    }
  }

  return out;
}
