import { inngest } from "./client";
import { db } from "@/db";
import { activities } from "@/db/schema";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { createBot } from "@/lib/recall";

/**
 * Safety-net cron — schedules Recall.ai bots for meetings starting soon
 * that don't have a bot yet. Catches meetings missed by cronCalendarSync
 * (e.g. Recall.ai was down during sync, or meeting was created between syncs).
 *
 * Runs every 5 minutes, looks at meetings in the next 10 minutes.
 */
export const scheduleRecallBots = inngest.createFunction(
  {
    id: "schedule-recall-bots",
    name: "Schedule Recall.ai Bots for Upcoming Meetings",
    retries: 1,
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async ({ step }) => {
    if (!process.env.RECALL_API_KEY) {
      return { skipped: true, reason: "RECALL_API_KEY not configured" };
    }

    const now = new Date();
    const in10min = new Date(now.getTime() + 10 * 60 * 1000);

    // Find upcoming meetings with a meetingLink but no recallBotId
    const meetings = await step.run("find-unbotted-meetings", async () => {
      return db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.activityType, "meeting_scheduled"),
            eq(activities.channel, "meeting"),
            gte(activities.occurredAt, now),
            lte(activities.occurredAt, in10min),
            sql`metadata->>'meetingLink' IS NOT NULL`,
            sql`metadata->>'meetingLink' != ''`,
            sql`metadata->>'recallBotId' IS NULL`
          )
        )
        .limit(10);
    });

    let scheduled = 0;
    let errors = 0;

    for (const meeting of meetings) {
      const meta = (meeting.metadata || {}) as Record<string, unknown>;
      const meetingLink = meta.meetingLink as string;

      if (!meetingLink) continue;

      try {
        const bot = await createBot(meetingLink);

        await db.update(activities).set({
          metadata: {
            ...meta,
            recallBotId: bot.id,
            recordingStatus: "scheduled",
          },
        }).where(eq(activities.id, meeting.id));

        scheduled++;
        console.log(`[Recall] Scheduled bot ${bot.id} for meeting ${meeting.id}`);
      } catch (err) {
        console.warn(`[Recall] Failed to schedule bot for meeting ${meeting.id}:`, err);
        errors++;
      }
    }

    return { checked: meetings.length, scheduled, errors };
  }
);
