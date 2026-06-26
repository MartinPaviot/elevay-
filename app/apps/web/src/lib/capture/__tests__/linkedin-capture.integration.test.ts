// @vitest-environment node
//
// Live DB integration test for captureInboundLinkedIn (the dedup SQL +
// recordCapturedActivity write against the real schema). Gated: runs only when
// LINKEDIN_CAPTURE_DB_TEST=1 and DATABASE_URL points at a dev DB. Creates a
// throwaway tenant + deletes it (and its rows) in finally. The pure mapper logic
// is covered by linkedin-capture.test.ts; this proves the SQL is real.
//
//   LINKEDIN_CAPTURE_DB_TEST=1 DATABASE_URL=<localdev> pnpm test linkedin-capture.integration
import { describe, it, expect } from "vitest";
import { db } from "@/db";
import { tenants, activities } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { captureInboundLinkedIn } from "../linkedin-capture";

const RUN = process.env.LINKEDIN_CAPTURE_DB_TEST === "1";

describe.runIf(RUN)("captureInboundLinkedIn (live DB)", () => {
  it("captures an inbound LinkedIn message as an activity, idempotently", async () => {
    const [tenant] = await db
      .insert(tenants)
      .values({ name: "li-inbound-test" })
      .returning({ id: tenants.id });
    const pmid = "li-test-msg-" + tenant.id;
    const msg = {
      tenantId: tenant.id,
      linkedinAccountId: "acc-test",
      providerMessageId: pmid,
      chatId: "chat-test",
      text: "Inbound test reply — can we talk Tuesday?",
      senderProviderId: "ACoAA-unknown-prospect",
      senderName: "Test Sender",
      occurredAt: new Date(),
    };
    try {
      const r1 = await captureInboundLinkedIn(msg);
      expect(r1.captured).toBe(true);
      expect(r1.contactId).toBeNull(); // unknown sender → unassigned

      const [row] = await db
        .select()
        .from(activities)
        .where(and(eq(activities.tenantId, tenant.id), eq(activities.channel, "linkedin")))
        .limit(1);
      expect(row).toBeTruthy();
      expect(row.activityType).toBe("linkedin_message_received");
      expect(row.direction).toBe("inbound");
      expect(row.entityType).toBe("unassigned");
      expect(row.threadId).toBe("chat-test");
      expect((row.metadata as Record<string, unknown>)?.providerMessageId).toBe(pmid);

      // Idempotent re-capture (same Unipile message id) → no second row.
      const r2 = await captureInboundLinkedIn(msg);
      expect(r2.captured).toBe(false);
      expect(r2.reason).toBe("duplicate");
      const rows = await db
        .select({ id: activities.id })
        .from(activities)
        .where(and(eq(activities.tenantId, tenant.id), eq(activities.channel, "linkedin")));
      expect(rows.length).toBe(1);
    } finally {
      await db.delete(activities).where(eq(activities.tenantId, tenant.id));
      await db.delete(tenants).where(eq(tenants.id, tenant.id));
    }
  });
});
