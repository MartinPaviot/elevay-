/**
 * Ask-inbox agent verifier (B5) — pure, the heart of the offline abstention floor.
 *
 * Re-validates the agent's claimed citations against the evidence the tools
 * ACTUALLY returned (not what the model says it read): drop fabricated thread
 * keys, clamp message indices in-range (mirroring summarize-thread.ts:92 /
 * ask-inbox.ts:176), and collapse to answered=false when zero valid citations
 * survive. Abstention beats fabrication — a grounded "I don't have that" is the
 * correct answer when the inbox lacks the fact. No DB, no network, no LLM.
 */

export interface AgentCiteRef {
  key: string;
  /** Optional index into the thread's message list. */
  messageIdx?: number;
  subject?: string;
}

export interface AgentAnswer {
  answer: string;
  answered: boolean;
  citations: AgentCiteRef[];
}

export interface AgentEvidence {
  /** Thread keys the tools actually returned this run. */
  keysSeen: Set<string>;
  /** Message count per key, for the in-range clamp. */
  threadMsgCount: Map<string, number>;
  /** Optional subjects to enrich a surviving citation. */
  subjects?: Map<string, string>;
}

export const NOT_FOUND_ANSWER = "I couldn't find that in your inbox.";

/**
 * Turn a raw agent answer into a verified one. Fail-closed: any malformed input
 * or thrown error → an honest abstention.
 */
export function verifyAnswer(
  raw: { answer?: unknown; answered?: unknown; citations?: unknown },
  evidence: AgentEvidence,
): AgentAnswer {
  try {
    const rawCites = Array.isArray(raw?.citations) ? raw.citations : [];
    const valid: AgentCiteRef[] = [];
    const seenKeys = new Set<string>();
    for (const c of rawCites) {
      if (!c || typeof (c as AgentCiteRef).key !== "string") continue;
      const key = (c as AgentCiteRef).key;
      // 1. Drop a thread the agent never actually retrieved (fabricated key).
      if (!evidence.keysSeen.has(key)) continue;
      const idx = (c as AgentCiteRef).messageIdx;
      // 2. Drop an out-of-range message index (the clamp).
      if (idx != null) {
        const n = evidence.threadMsgCount.get(key) ?? 0;
        if (!(Number.isInteger(idx) && idx >= 0 && idx < n)) continue;
      }
      // De-dupe citations by key+idx.
      const dedupeKey = `${key}#${idx ?? ""}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);
      const subject = evidence.subjects?.get(key);
      valid.push({ key, ...(idx != null ? { messageIdx: idx } : {}), ...(subject ? { subject } : {}) });
    }

    const answerText = typeof raw?.answer === "string" ? raw.answer.trim() : "";
    // 3. An answer with zero surviving citations collapses to abstention.
    const answered = raw?.answered === true && answerText.length > 0 && valid.length > 0;
    if (!answered) {
      return { answer: NOT_FOUND_ANSWER, answered: false, citations: [] };
    }
    return { answer: answerText, answered: true, citations: valid };
  } catch {
    return { answer: NOT_FOUND_ANSWER, answered: false, citations: [] };
  }
}

/** Build the evidence ledger from the threads a run actually retrieved. */
export function buildEvidence(
  retrieved: Array<{ key: string; subject?: string; messageCount: number }>,
): AgentEvidence {
  const keysSeen = new Set<string>();
  const threadMsgCount = new Map<string, number>();
  const subjects = new Map<string, string>();
  for (const r of retrieved) {
    keysSeen.add(r.key);
    threadMsgCount.set(r.key, Math.max(0, r.messageCount | 0));
    if (r.subject) subjects.set(r.key, r.subject);
  }
  return { keysSeen, threadMsgCount, subjects };
}
