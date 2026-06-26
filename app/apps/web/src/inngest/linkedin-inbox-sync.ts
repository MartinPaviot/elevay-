/**
 * LINKEDIN-INBOUND (T10) — the inbound-message poll cron. Every 15 min, for each
 * CONNECTED LinkedIn seat, pulls new inbound messages into the CRM as activities
 * (so a reply on the primary channel is no longer silently dropped). Behind
 * LINKEDIN_INBOUND_ENABLED (default OFF → no-op). Mirrors the cronSyncEmails shape:
 * concurrency 1, dead-letter log, per-seat step.run fault isolation. Dedup on the
 * Unipile message id makes the poll idempotent.
 */
import { inngest } from "./client";
import { db } from "@/db";
import { linkedinAccount } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/observability/logger";
import { readUnipileConfig } from "@/lib/providers/unipile/http";
import { syncLinkedInInboxForAccount } from "@/lib/capture/linkedin-sync";

function isLinkedInInboundEnabled(): boolean {
  const v = process.env.LINKEDIN_INBOUND_ENABLED;
  return v === "1" || v === "true";
}

export const linkedinInboxSync = inngest.createFunction(
  {
    id: "linkedin-inbox-sync",
    name: "Cron: LinkedIn inbound message sync",
    retries: 1,
    concurrency: [{ limit: 1 }],
    onFailure: async ({ error }: { error: unknown }) => {
      logger.error("linkedin-inbox-sync.dead_letter", {
        err: error instanceof Error ? error.message : String(error),
      });
    },
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async ({ step }: { step: { run<T>(id: string, fn: () => Promise<T> | T): Promise<T> } }) => {
    if (!isLinkedInInboundEnabled()) return { enabled: false, seats: 0, captured: 0 };
    const cfg = readUnipileConfig();
    if (!cfg) return { enabled: true, seats: 0, captured: 0, reason: "no_unipile_config" };

    const seats = await step.run("connected-seats", async () =>
      db
        .select({
          id: linkedinAccount.id,
          tenantId: linkedinAccount.tenantId,
          unipileAccountId: linkedinAccount.unipileAccountId,
        })
        .from(linkedinAccount)
        .where(eq(linkedinAccount.status, "connected")),
    );

    let captured = 0;
    for (const seat of seats) {
      if (!seat.unipileAccountId) continue;
      const s = await step.run(`sync-${seat.id}`, async () => {
        try {
          return await syncLinkedInInboxForAccount({
            tenantId: seat.tenantId,
            linkedinAccountId: seat.id,
            unipileAccountId: seat.unipileAccountId!,
            cfg,
          });
        } catch (err) {
          logger.warn("linkedin-inbox-sync.seat_failed", {
            seatId: seat.id,
            err: err instanceof Error ? err.message : String(err),
          });
          return { chatsScanned: 0, captured: 0, skipped: 0 };
        }
      });
      captured += s.captured;
    }

    logger.info("linkedin-inbox-sync.run_done", { seats: seats.length, captured });
    return { enabled: true, seats: seats.length, captured };
  },
);
