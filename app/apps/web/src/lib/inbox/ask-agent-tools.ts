/**
 * Ask-inbox agent tools (B5) — search_inbox / read_thread / summarize_thread, each
 * an AI-SDK tool (makeTool) CLOSED OVER the already-scoped in-memory corpus. No
 * tool touches the DB, so tenancy is structurally guaranteed: the agent can only
 * ever see threads the route already scoped with getInboxScope.
 *
 * Each execute also records the threads it returned into a shared `seen` ledger,
 * so the verifier can re-validate the agent's citations against what the tools
 * ACTUALLY surfaced (not what the model claims).
 */

import { z } from "zod";
import { makeTool } from "@/lib/chat/tools/context";
import { selectRelevantThreads, type InboxThread } from "@/lib/inbox/ask-inbox";

export interface AgentCorpus {
  threads: InboxThread[];
}

export interface SeenLedger {
  keys: Set<string>;
  msgCount: Map<string, number>;
  subjects: Map<string, string>;
}

export function newSeenLedger(): SeenLedger {
  return { keys: new Set(), msgCount: new Map(), subjects: new Map() };
}

function record(seen: SeenLedger, t: InboxThread): void {
  seen.keys.add(t.key);
  seen.msgCount.set(t.key, t.messages.length);
  if (t.subject) seen.subjects.set(t.key, t.subject);
}

function snippet(t: InboxThread): string {
  const body = t.messages.map((m) => m.body || "").join(" ").trim();
  return body.length > 180 ? `${body.slice(0, 180)}…` : body;
}

export function buildAskAgentTools(corpus: AgentCorpus, seen: SeenLedger) {
  return {
    search_inbox: makeTool({
      description:
        "Search the user's inbox for threads relevant to a query. Returns indexed thread refs (idx, key, subject, snippet). Empty result means nothing matched — then you should abstain rather than guess.",
      inputSchema: z.object({
        query: z.string().describe("Keywords to search for across subjects and bodies"),
        limit: z.number().optional().describe("Max threads to return (default 6, cap 12)"),
      }),
      execute: async ({ query, limit }: { query: string; limit?: number }) => {
        const results = selectRelevantThreads(corpus.threads, query, Math.min(limit ?? 6, 12));
        for (const t of results) record(seen, t);
        return results.map((t, idx) => ({ idx, key: t.key, subject: t.subject, snippet: snippet(t) }));
      },
    }),

    read_thread: makeTool({
      description: "Read the full messages of one thread by its key. Returns indexed messages, or an error if the key is unknown.",
      inputSchema: z.object({ key: z.string().describe("The thread key from search_inbox") }),
      execute: async ({ key }: { key: string }) => {
        const t = corpus.threads.find((x) => x.key === key);
        if (!t) return { error: `No thread with key ${key}` };
        record(seen, t);
        return { key: t.key, subject: t.subject, messages: t.messages.map((m, idx) => ({ idx, body: m.body || "" })) };
      },
    }),

    summarize_thread: makeTool({
      description: "Get a thread's messages to summarize it. Returns the indexed messages (summarize them yourself), or an error if the key is unknown.",
      inputSchema: z.object({ key: z.string().describe("The thread key to summarize") }),
      execute: async ({ key }: { key: string }) => {
        const t = corpus.threads.find((x) => x.key === key);
        if (!t) return { error: `No thread with key ${key}` };
        record(seen, t);
        return { key: t.key, subject: t.subject, messages: t.messages.map((m, idx) => ({ idx, body: m.body || "" })) };
      },
    }),
  };
}
