import { db } from "@/db";
import { outboundEmails, activities } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { verifyTrackingId } from "@/lib/emails/tracking-token";
import { inngest } from "@/inngest/client";
import { isCadenceBranchingEnabled, buildEngagementEvent } from "@/lib/emails/engagement-event";
import { recordEngagementSignal } from "@/lib/signals/engagement-signal";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

/**
 * Open tracking pixel endpoint.
 *
 * M8 — prefer a signed `t=<token>` param; fall back to the unsigned
 * `id=<emailId>` for in-flight legacy sends. An unverifiable token is
 * ignored (no DB write) but we still return the pixel so the receiving
 * email client doesn't render a broken image. See `signTrackingId` in
 * `@/lib/tracking-token`.
 *
 * GET /api/track/open?t={signedToken}
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url, "http://localhost");
  const signedId = verifyTrackingId(searchParams.get("t"));
  // Legacy unsigned fallback — accept only for backward compat;
  // will be removed once all in-flight unsigned emails have expired.
  const unsignedId = signedId ? null : searchParams.get("id");
  const emailId = signedId ?? unsignedId;

  if (emailId) {
    // Fire-and-forget: don't block pixel response
    recordOpen(emailId).catch((e) => console.warn("track/open: recordOpen failed", e));
  }

  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": PIXEL.length.toString(),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

async function recordOpen(emailId: string) {
  try {
    // Only record first open
    const [email] = await db
      .select({ id: outboundEmails.id, openedAt: outboundEmails.openedAt, contactId: outboundEmails.contactId, tenantId: outboundEmails.tenantId, enrollmentId: outboundEmails.enrollmentId })
      .from(outboundEmails)
      .where(and(eq(outboundEmails.id, emailId), isNull(outboundEmails.openedAt)))
      .limit(1);

    if (!email) return;

    await db
      .update(outboundEmails)
      .set({ openedAt: new Date(), updatedAt: new Date() })
      .where(eq(outboundEmails.id, emailId));

    // Log activity
    if (email.contactId) {
      await db.insert(activities).values({
        tenantId: email.tenantId,
        actorType: "contact",
        actorId: email.contactId,
        entityType: "contact",
        entityId: email.contactId,
        activityType: "email_opened",
        channel: "email",
        direction: "inbound",
        summary: "Opened email",
        metadata: { outboundEmailId: emailId },
      });

      // Lift the contact's account on the priority score: an open is a (weak)
      // first-party buying signal. First-open only (the WHERE openedAt IS NULL
      // above gates this), idempotent, best-effort.
      await recordEngagementSignal(email.tenantId, email.contactId, "email_opened", {
        strength: "low",
      }).catch(() => {});
    }

    // Cadence branching (gap #2): feed the dormant decision engine so a sequenced
    // email's first open can branch the cadence (contextual follow-up / wait). Flag-
    // gated + only for sequenced sends; best-effort so it never breaks the pixel.
    if (isCadenceBranchingEnabled()) {
      const ev = buildEngagementEvent("opened", email);
      if (ev) await inngest.send(ev).catch(() => {});
    }
  } catch {
    // Non-critical — don't fail the pixel
  }
}
