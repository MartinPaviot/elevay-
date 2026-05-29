/**
 * Playbook capture (B4, _specs/pilae-machine/spec-v2.md R11.2).
 *
 * Consumes the event `playbook/capture-from-activity` and persists the
 * batch of candidate entries that pass the `validatePlaybookBatch`
 * gate. Producers (the LLM extractor over a call/meeting transcript,
 * or the reply-handler) are responsible for producing candidates;
 * this fn is the validation + insertion edge.
 *
 * Why the producer extracts and not this fn: extraction needs the
 * tenant's prompt configuration and the source content (transcript,
 * note, email body). Centralising the LLM call here would make this
 * fn fan-out to N producers with N prompt shapes. Keeping it as the
 * sink keeps the contract small: `{ entries[] } in → { accepted } out`.
 *
 * Event payload:
 *   {
 *     tenantId: string,
 *     sourceActivityId: string | null,
 *     entries: Array<{
 *       type: string,
 *       content: string,
 *       outcomeLabel?: string | null,
 *       perfScore?: number | null,
 *     }>,
 *   }
 *
 * Concurrency intentional: capture may fan in from multiple sources
 * concurrently, so no single-flight limit. The validator + insert is
 * idempotent at the row level only through `(tenant_id, content)`
 * uniqueness — a future migration may add that, for now we accept
 * duplicates and rely on the founder to merge them in the UI.
 */

import { inngest } from "./client";
import { db } from "@/db";
import { playbookEntries } from "@/db/schema";
import { validatePlaybookBatch } from "@/lib/playbook/capture";
import { logger } from "@/lib/observability/logger";

type CaptureEvent = {
  data: {
    tenantId: string;
    sourceActivityId: string | null;
    entries: Array<{
      type: string;
      content: string;
      outcomeLabel?: string | null;
      perfScore?: number | null;
    }>;
  };
};

export const playbookCapturePostCall = inngest.createFunction(
  {
    id: "playbook-capture-post-call",
    name: "Playbook: capture entries from a completed activity",
    retries: 1,
    triggers: [{ event: "playbook/capture-from-activity" }],
  },
  async ({ event, step }: { event: CaptureEvent; step: any }) => {
    const { tenantId, sourceActivityId, entries } = event.data;

    if (!Array.isArray(entries) || entries.length === 0) {
      return { inserted: 0, rejected: 0, reason: "empty_batch" };
    }

    const { accepted, rejected } = validatePlaybookBatch(entries);

    if (rejected.length > 0) {
      logger.info("playbook-capture.rejected", {
        tenantId,
        sourceActivityId,
        rejected: rejected.length,
        firstError: rejected[0]?.error,
      });
    }

    if (accepted.length === 0) {
      return { inserted: 0, rejected: rejected.length };
    }

    await step.run("insert-accepted", async () => {
      await db.insert(playbookEntries).values(
        accepted.map((e) => ({
          tenantId,
          type: e.type,
          content: e.content,
          sourceActivityId,
          outcomeLabel: e.outcomeLabel,
          perfScore: e.perfScore,
        })),
      );
    });

    return {
      inserted: accepted.length,
      rejected: rejected.length,
      tenantId,
    };
  },
);
