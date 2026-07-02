/**
 * Deterministic assembly of the chat dock's opening turn — the agent
 * speaks first. Zero inference: pure string templating over state the
 * route fetched (up-next todos, pending-draft count, last chat thread).
 * See _specs/chat-opener/.
 *
 * Copy rules (charte): English, no emoji, no em-dash, factual counts.
 * The opener proposes; it never auto-sends anything.
 */

/** Projection of NeedsYouItem — only what the opener needs. */
export interface OpenerTodo {
  kind: "reply" | "deal_risk" | "meeting" | "task";
  /** reply: fromAddress; deal_risk: deal name; meeting: title. */
  title: string;
  /** reply: subject (when distinct from the address). */
  subtitle: string | null;
  /** deal_risk: "Silent 12d" (built by buildNeedsYou). */
  why: string;
  /** meeting: time label; deal_risk: money label. */
  stakes: string | null;
  toAddress: string | null;
  entityId: string | null;
}

export interface OpenerThread {
  id: string;
  title: string | null;
  updatedAt: string | null;
}

export interface OpenerChip {
  /** Stable id for analytics (chip CTR by kind/slot). */
  id: string;
  kind: "reply" | "drafts" | "deal_risk" | "meeting" | "resume" | "recipe";
  label: string;
  /** Message dispatched through the dock's existing send(). */
  send?: string;
  /** Direct navigation when a deterministic page beats the agent loop. */
  href?: string;
  /** Loads this thread's messages into the dock (continuity). */
  resumeThreadId?: string;
}

export interface OpenerInputs {
  todos: OpenerTodo[];
  draftsPending: number;
  lastThread: OpenerThread | null;
  /**
   * v2 recipe-catalog chips (gated + slot-filled by the route via
   * selectRecipeChips). Undefined → static fallback trio (v1 behavior);
   * empty array → the tenant's data can't demo any recipe, show none.
   */
  recipes?: OpenerChip[];
}

export interface OpenerPayload {
  text: string;
  chips: OpenerChip[];
  hasWork: boolean;
  counts: { replies: number; drafts: number; deals: number; meetings: number };
}

export const OPENER_ALL_CLEAR =
  "All clear right now. Nothing is waiting on your decision.";

/** Hard cap: the dock is 400px wide; more than 4 chips is a menu again. */
export const OPENER_MAX_CHIPS = 4;
/** When real work yields fewer than this, recipe chips fill the gap. */
const MIN_CHIPS = 3;
/**
 * Work chips stop at 3 so a busy tenant still gets one capability-
 * discovery slot — the founder's ask: the opener must showcase what the
 * product can do, not only what's waiting.
 */
const MAX_WORK_CHIPS = 3;

const truncate = (s: string, n: number): string =>
  s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;

/** Long addresses read badly in a 12.5px chip; fall back to the local part. */
const shortAddress = (a: string): string =>
  a.length <= 24 ? a : a.split("@")[0] || a;

/** buildNeedsYou encodes silence as "Silent 12d" — recover the number. */
export function parseSilentDays(why: string): number | null {
  const m = /silent\s+(\d+)\s*d/i.exec(why);
  return m ? Number(m[1]) : null;
}

/**
 * Inbox rows carry the raw RFC From header ('"Paul M" <p@x.ch>').
 * Copy wants the display name; the send text wants the bare address
 * (live-verified 2026-07-02: the raw header read terribly in the dock).
 */
export function parseFromHeader(raw: string): { name: string | null; address: string } {
  const angle = /<([^<>\s]+@[^<>\s]+)>/.exec(raw);
  if (!angle) return { name: null, address: raw.trim() };
  const name =
    raw
      .slice(0, angle.index)
      .trim()
      .replace(/^"(.*)"$/, "$1")
      .trim() || null;
  return { name, address: angle[1] };
}

/** Always-available fallbacks; each routes to a tool every tenant can run. */
const RECIPE_CHIPS: OpenerChip[] = [
  {
    id: "recipe:call-list",
    kind: "recipe",
    label: "Build today's call list",
    send: "Build my call list for today. Who should I call first?",
  },
  {
    id: "recipe:inbound-recap",
    kind: "recipe",
    label: "Recap this week's inbound email",
    send: "Summarize the emails I received in the last 7 days. What needs attention?",
  },
  {
    id: "recipe:deals-at-risk",
    kind: "recipe",
    label: "Which deals are at risk?",
    send: "Which deals are at risk?",
  },
];

export function buildOpener(inputs: OpenerInputs): OpenerPayload {
  const replies = inputs.todos.filter((t) => t.kind === "reply");
  const deals = inputs.todos.filter((t) => t.kind === "deal_risk");
  const meetings = inputs.todos.filter((t) => t.kind === "meeting");
  const drafts = Math.max(0, inputs.draftsPending);

  const counts = {
    replies: replies.length,
    drafts,
    deals: deals.length,
    meetings: meetings.length,
  };
  const hasWork =
    counts.replies > 0 || counts.drafts > 0 || counts.deals > 0 || counts.meetings > 0;

  // ── Text: priority order replies > drafts > top deal > meeting, max 3 ──
  const topFrom =
    replies.length > 0 ? parseFromHeader(replies[0].toAddress || replies[0].title) : null;
  const topFromDisplay = topFrom ? topFrom.name ?? topFrom.address : "";
  const sentences: string[] = [];
  if (replies.length === 1) {
    sentences.push(`A reply from ${topFromDisplay} is waiting on you.`);
  } else if (replies.length > 1) {
    sentences.push(
      `${replies.length} replies are waiting on you, the latest from ${topFromDisplay}.`,
    );
  }
  if (drafts === 1) {
    sentences.push("I prepared 1 outreach draft for your review.");
  } else if (drafts > 1) {
    sentences.push(`I prepared ${drafts} outreach drafts for your review.`);
  }
  if (deals.length > 0) {
    const d = deals[0];
    const days = parseSilentDays(d.why);
    sentences.push(
      days === null
        ? `${d.title} needs attention.`
        : `${d.title} has been silent for ${days} days.`,
    );
  }
  if (meetings.length > 0) {
    const m = meetings[0];
    sentences.push(
      m.stakes
        ? `${m.title} is on your calendar at ${m.stakes}.`
        : `${m.title} is on your calendar today.`,
    );
  }
  const text = sentences.slice(0, 3).join(" ") || OPENER_ALL_CLEAR;

  // ── Chips: work (≤3) > recipes (≥1 when eligible) > resume; cap 4 ──
  const workChips: OpenerChip[] = [];
  if (replies.length > 0 && topFrom) {
    const top = replies[0];
    const subject = top.subtitle ? truncate(top.subtitle, 40) : null;
    const chipName = topFrom.name ?? shortAddress(topFrom.address);
    workChips.push({
      id: "reply:top",
      kind: "reply",
      label: subject ? `Reply to ${chipName}: "${subject}"` : `Reply to ${chipName}`,
      send: top.subtitle
        ? `Draft a reply to ${topFrom.address} about "${top.subtitle}"`
        : `Draft a reply to ${topFrom.address}`,
    });
  }
  if (drafts > 0) {
    workChips.push({
      id: "drafts",
      kind: "drafts",
      label: drafts === 1 ? "Review 1 pending draft" : `Review ${drafts} pending drafts`,
      href: "/sequences/review",
    });
  }
  if (deals.length > 0) {
    const d = deals[0];
    const days = parseSilentDays(d.why);
    workChips.push({
      id: `deal:${d.entityId ?? "top"}`,
      kind: "deal_risk",
      label: `Coach me on ${truncate(d.title, 28)}`,
      send:
        days === null
          ? `Coach me on the "${d.title}" deal. What is my next move?`
          : `Coach me on the "${d.title}" deal. It has been silent for ${days} days. What is my next move?`,
    });
  }
  if (meetings.length > 0) {
    const m = meetings[0];
    workChips.push({
      id: `meeting:${m.entityId ?? "top"}`,
      kind: "meeting",
      label: `Prep me for ${truncate(m.title, 26)}`,
      send: m.stakes
        ? `Prepare me for the meeting "${m.title}" at ${m.stakes} today.`
        : `Prepare me for the meeting "${m.title}".`,
    });
  }
  // Assembly: up to 3 work chips, then recipes fill to 3 — plus the 4th
  // slot when all three are work, so at least one recipe always shows
  // (when any is eligible). Resume takes the last free slot.
  const finalChips = workChips.slice(0, MAX_WORK_CHIPS);
  const recipes = inputs.recipes ?? RECIPE_CHIPS;
  const recipeTarget = finalChips.length >= MAX_WORK_CHIPS ? OPENER_MAX_CHIPS : MIN_CHIPS;
  for (const recipe of recipes) {
    if (finalChips.length >= recipeTarget) break;
    finalChips.push(recipe);
  }
  if (inputs.lastThread && finalChips.length < OPENER_MAX_CHIPS) {
    finalChips.push({
      id: `resume:${inputs.lastThread.id}`,
      kind: "resume",
      label: `Continue: ${truncate(inputs.lastThread.title || "last conversation", 32)}`,
      resumeThreadId: inputs.lastThread.id,
    });
  }

  return { text, chips: finalChips.slice(0, OPENER_MAX_CHIPS), hasWork, counts };
}
