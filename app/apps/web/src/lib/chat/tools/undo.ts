import { z } from "zod";
import {
  getLastReversibleCall,
  reverseToolCall,
} from "@/lib/chat/tool-call-log";
import { makeTool, type ToolContext } from "./context";

export function buildUndoTools(ctx: ToolContext) {
  const { tenantId, userId } = ctx;

  return {
    undoLastAction: makeTool({
      description:
        "Undo the most recent reversible action taken by the chat (contact/account/deal/note/task create or update, or a delete with a stored snapshot). Scoped to the current user. Returns { ok: true, reversedAction } on success or { error } if nothing to undo or the snapshot isn't reversible. Use when the user says 'undo that', 'revert', 'take it back'.",
      inputSchema: z.object({
        eventId: z
          .string()
          .optional()
          .describe(
            "Specific tool_call_events id to revert. If omitted, the most recent reversible call is used."
          ),
      }),
      execute: async (input) => {
        let eventId = input.eventId;
        if (!eventId) {
          const last = await getLastReversibleCall(tenantId, userId);
          if (!last) return { error: "No reversible action found" };
          eventId = last.id;
        }
        const result = await reverseToolCall(tenantId, userId, eventId);
        if (!result.ok) return { error: result.error };
        return {
          reverted: {
            eventId,
            reversedAction: result.reversedAction,
          },
        };
      },
    }),
  };
}
