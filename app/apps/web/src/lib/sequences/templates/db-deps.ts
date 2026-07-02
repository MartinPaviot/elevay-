/**
 * Drizzle-wired InstantiateDeps for the proven-template factory — extracted
 * from app/api/sequences/templates/route.ts so every instantiation site (the
 * gallery POST, the /home proposal launch) shares ONE find-or-create wiring:
 * idempotent on campaignConfig->>'templateId', sequence + steps in the
 * canonical tables.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { sequences, sequenceSteps } from "@/db/schema";
import type { InstantiateDeps, SequenceInsert, StepInsert } from "@/lib/sequences/templates/instantiate";

export function tenantInstantiateDeps(): InstantiateDeps {
  return {
    findExisting: async (tenantId, templateId) => {
      const [row] = await db
        .select({ id: sequences.id })
        .from(sequences)
        .where(and(eq(sequences.tenantId, tenantId), sql`${sequences.campaignConfig}->>'templateId' = ${templateId}`))
        .limit(1);
      return row ? { id: row.id } : null;
    },
    insertSequence: async (row: SequenceInsert) => {
      const [seq] = await db
        .insert(sequences)
        .values({
          tenantId: row.tenantId,
          name: row.name,
          description: row.description,
          status: row.status,
          campaignConfig: row.campaignConfig,
          createdBy: row.createdBy,
        })
        .returning({ id: sequences.id });
      return { id: seq.id };
    },
    insertSteps: async (rows: StepInsert[]) => {
      if (rows.length === 0) return;
      await db.insert(sequenceSteps).values(
        rows.map((s) => ({
          sequenceId: s.sequenceId,
          stepNumber: s.stepNumber,
          stepType: s.stepType,
          subjectTemplate: s.subjectTemplate,
          bodyTemplate: s.bodyTemplate,
          delayDays: s.delayDays,
          channelConfig: s.channelConfig,
        })),
      );
    },
  };
}
