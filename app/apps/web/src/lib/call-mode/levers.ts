/**
 * The methodology levers as code (cold-call-exchange-top01, Part 9).
 *
 * `validateScript` runs the script-checkable levers at compile time so a
 * non-compliant script is flagged to the rep, never shipped silently. The
 * Phase-2 transcript scorer will reuse these same predicates — one definition,
 * so "what we coach" and "what we score" cannot drift.
 *
 * Pure. No I/O, no LLM. Detectors are FR-first (the prospect-facing content),
 * tuned to the banned/required patterns the methodology names explicitly.
 */

import type { AssembledScript, GapReport, LeverId, ScriptTemplate } from "./types";

// The single worst opener (-40% on meetings, Gong): never let it pass.
const BANNED_OPENER =
  /(mauvais moment|comment allez-vous|comment vous allez|je vous d[ée]range|how are you|bad time|caught you at a bad)/i;

// Deferring the slot instead of guiding it (JOLT: guidance > defer).
const DEFER =
  /(quand seriez-vous|quand seriez vous|quelles sont vos dispo|vos disponibilit|envoyez-moi vos dispo|vous me direz vos dispo|[àa] quel moment vous arrange|when works for you|let me know your availability)/i;

// A concrete time anchor — needed for a binary slot ("mardi 14h ou jeudi ?").
const TIME_WORD =
  /(lundi|mardi|mercredi|jeudi|vendredi|matin|apr[èe]s-?midi|d[ée]but de semaine|fin de semaine|semaine prochaine|\b\d{1,2}\s?h\b|\bnext week\b)/i;

// De-risk / reversibility markers (JOLT: take risk off the table).
const DERISK =
  /(m[êe]me si|sans engagement|rien [àa] pr[ée]parer|vous saurez|c'est vous qui voyez|repartez avec|premi[èe]re lecture|[ée]cart de co[ûu]t|10\s?min|dix minutes|r[ée]versible|no strings)/i;

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function bloc(script: AssembledScript, kind: AssembledScript["blocs"][number]["kind"]) {
  return script.blocs.find((b) => b.kind === kind);
}
function blocsOf(script: AssembledScript, kind: AssembledScript["blocs"][number]["kind"]) {
  return script.blocs.filter((b) => b.kind === kind);
}

/**
 * Validate an assembled script against the compile-checkable levers. Returns
 * only genuine violations (a cold call with no live signal is NOT a failure —
 * an absent grounded reason is legitimate). The checked levers are the ones a
 * non-compliant template/assembly can actually break:
 *   opener_permission · single_tier1_problem · ask_derisked ·
 *   guidance_over_defer · objection_ready
 */
export function validateScript(script: AssembledScript, template: ScriptTemplate): GapReport {
  const failedLevers: { id: LeverId; why: string }[] = [];

  // opener_permission — opener must be a context-first gate, never the banned
  // pattern, and never a pitch that lists the problems (those come later).
  const opener = bloc(script, "opener");
  if (!opener) {
    failedLevers.push({ id: "opener_permission", why: "no opener bloc" });
  } else if (BANNED_OPENER.test(opener.text)) {
    failedLevers.push({
      id: "opener_permission",
      why: "opener uses a banned pattern (mauvais moment / comment allez-vous)",
    });
  } else {
    const o = norm(opener.text);
    const listsProblems = (template.problems ?? []).some((p) => p.trim() && o.includes(norm(p)));
    if (listsProblems) {
      failedLevers.push({
        id: "opener_permission",
        why: "opener lists problems — it must be a permission gate only",
      });
    }
  }

  // single_tier1_problem — exactly ONE problem painted, not three, not zero.
  const problems = blocsOf(script, "problemTier1");
  if (problems.length !== 1) {
    failedLevers.push({
      id: "single_tier1_problem",
      why: `expected exactly one Tier-1 problem, got ${problems.length}`,
    });
  }

  // ask_derisked + guidance_over_defer — the ask offers a binary slot, carries
  // a de-risk clause, and guides rather than defers.
  const ask = bloc(script, "ask");
  if (!ask) {
    failedLevers.push({ id: "ask_derisked", why: "no ask bloc" });
  } else {
    const hasBinary = TIME_WORD.test(ask.text) && /\bou\b|\bor\b/i.test(ask.text);
    const hasDerisk = DERISK.test(ask.text) || Boolean(template.askReversibility?.trim());
    if (!hasBinary) {
      failedLevers.push({ id: "ask_derisked", why: "ask lacks a binary time slot (e.g. 'mardi 14h ou jeudi ?')" });
    } else if (!hasDerisk) {
      failedLevers.push({ id: "ask_derisked", why: "ask lacks a de-risk / reversibility clause" });
    }
    if (DEFER.test(ask.text)) {
      failedLevers.push({
        id: "guidance_over_defer",
        why: "ask defers ('quand seriez-vous disponible ?') instead of guiding a slot",
      });
    }
  }

  // objection_ready — a sector objection answer must exist (the static,
  // vendor-hardcoded bank is being removed; a tenant with none is flagged).
  const objections = bloc(script, "objections");
  if (!objections || !objections.text.trim()) {
    failedLevers.push({ id: "objection_ready", why: "no objection responses prepared for the sector" });
  }

  return { failedLevers };
}
