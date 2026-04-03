import { db } from "@/db";
import { connectedMailboxes } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * Reset daily sent counters on all connected mailboxes.
 * Run as cron at midnight UTC daily.
 */
export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === "production") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db
      .update(connectedMailboxes)
      .set({ sentToday: 0, updatedAt: new Date() })
      .where(sql`${connectedMailboxes.sentToday} > 0`);

    return Response.json({
      ok: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Mailbox reset cron failed:", error);
    return Response.json({ error: "Failed to reset mailbox counters" }, { status: 500 });
  }
}
