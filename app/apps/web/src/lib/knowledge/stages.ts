/**
 * Knowledge stages — organise tenant Knowledge by the product moment that
 * CONSUMES it, not by topic alone. One stage per real consumer surface
 * (verified against the code, 2026-06-12):
 *
 *   sourcing    → TAM build/estimate prompts, call-sprint resolution,
 *                 persona sourcing ("who do we go after").
 *   cold_call   → call-script generation (generateCallScript), Call Mode
 *                 fiche/coaching, voicemail.
 *   outreach    → email drafting / sequence generation / email
 *                 intelligence.
 *   objections  → the live objection bank (tenant-playbook) + coaching
 *                 cards; also fed to cold_call pulls by its consumers.
 *   meetings    → meeting prep, proposals, post-call follow-through.
 *   global      → company identity/context wanted EVERYWHERE: included in
 *                 every stage pull and the chat's semantic retrieval.
 *
 * An entry stores its stages in knowledge_entries.stages (text[]). An
 * EMPTY array means "not curated yet" and falls back to
 * deriveDefaultStages(category, title) — so legacy entries and API
 * writers that ignore stages keep flowing to sensible consumers.
 *
 * Pure module (no db imports) — shared by server consumers and the
 * Settings → Knowledge client UI.
 */

export const KNOWLEDGE_STAGES = [
  {
    key: "sourcing",
    label: "Targeting & lists",
    description: "Who we go after — feeds TAM building and call-sprint targeting.",
  },
  {
    key: "cold_call",
    label: "Cold calls",
    description: "Feeds call-script generation and the Call Mode cockpit.",
  },
  {
    key: "outreach",
    label: "Emails & sequences",
    description: "Feeds email drafting and sequence generation.",
  },
  {
    key: "objections",
    label: "Objection handling",
    description: "Feeds the live objection bank and coaching cards.",
  },
  {
    key: "meetings",
    label: "Meetings & proposals",
    description: "Feeds meeting prep and proposal drafting.",
  },
  {
    key: "global",
    label: "Everywhere",
    description: "Company identity & context — included at every stage and in chat.",
  },
] as const;

export type KnowledgeStage = (typeof KNOWLEDGE_STAGES)[number]["key"];

export const STAGE_KEYS: readonly KnowledgeStage[] = KNOWLEDGE_STAGES.map((s) => s.key);

const STAGE_SET = new Set<string>(STAGE_KEYS);

export function isKnowledgeStage(v: unknown): v is KnowledgeStage {
  return typeof v === "string" && STAGE_SET.has(v);
}

/** Validate arbitrary input (API body, db column) into a clean stage list. */
export function sanitizeStages(v: unknown): KnowledgeStage[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter(isKnowledgeStage))];
}

/**
 * Where an entry flows when nobody curated its stages — derived from the
 * topic category (+ the cold-call title convention). Deliberately coarse:
 * curation in Settings → Knowledge is the real signal.
 */
export function deriveDefaultStages(category: string, title: string): KnowledgeStage[] {
  const t = (title ?? "").trim().toLowerCase();
  if (/^cold[\s-]?call/.test(t)) {
    return /\bliste|list\b/.test(t) ? ["cold_call", "sourcing"] : ["cold_call"];
  }
  switch (category) {
    case "icp":
      return ["sourcing"];
    case "objections":
      return ["objections", "cold_call"];
    case "competitors":
      return ["objections", "outreach"];
    case "product":
    case "process":
    case "context":
    case "custom":
    default:
      return ["global"];
  }
}

/** The stages an entry effectively flows to: stored when curated, else derived. */
export function effectiveStages(
  stored: unknown,
  category: string,
  title: string,
): KnowledgeStage[] {
  const clean = sanitizeStages(stored);
  return clean.length > 0 ? clean : deriveDefaultStages(category, title);
}

/** Does an entry belong to a stage pull? `global` entries belong everywhere. */
export function entryMatchesStage(
  stages: readonly string[],
  stage: KnowledgeStage,
  opts: { includeGlobal?: boolean } = {},
): boolean {
  const includeGlobal = opts.includeGlobal ?? true;
  if (stages.includes(stage)) return true;
  return includeGlobal && stage !== "global" && stages.includes("global");
}
