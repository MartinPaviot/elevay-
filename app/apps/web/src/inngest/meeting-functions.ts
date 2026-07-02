import { inngest } from "./client";
import { db } from "@/db";
import { activities, authAccounts, authUsers, users, tenants, contacts as contactsTable } from "@/db/schema";
import { eq, and, sql, gte, lte, isNull, desc } from "drizzle-orm";
import { fetchMicrosoftMeetings } from "@/lib/integrations/calendar-microsoft";
import { fetchRecentMeetings, type SyncedMeeting } from "@/lib/integrations/calendar";
import { fetchCalDavMeetingsForTenant, tenantsWithCalDav } from "@/lib/integrations/caldav-sync";
import { isNeedsReauth, markNeedsReauth, isOAuthAuthError } from "@/lib/integrations/sync-health";
import { tracedGenerateText } from "@/lib/ai/traced-ai";
import { createBot } from "@/lib/integrations/recall";

/**
 * Import one synced meeting as an `activities` row, idempotent by
 * calendarEventId. Shared by the OAuth (Google/Microsoft) and CalDAV sweeps so
 * every calendar source gets identical treatment: insert, a real-time signal
 * for completed meetings, and a Recall.ai bot for imminent ones with a link.
 * Returns whether a new row was inserted (for the synced counter).
 */
async function importCronMeeting(opts: {
  tenantId: string;
  actorId: string;
  meeting: SyncedMeeting;
  calendarSource: "google" | "microsoft" | "caldav";
}): Promise<boolean> {
  const { tenantId, actorId, meeting, calendarSource } = opts;

  const [existing] = await db
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.tenantId, tenantId),
        // Match BOTH key spellings: the in-product booking route stores the
        // event id under `eventId`, this sync under `calendarEventId` — with
        // only the latter checked, every meeting booked in-product DUPLICATED
        // at the next 15-min sync (found live 2026-07-02 on the founder's
        // AI-loop test booking).
        sql`(metadata->>'calendarEventId' = ${meeting.calendarEventId} or metadata->>'eventId' = ${meeting.calendarEventId})`,
      ),
    )
    .limit(1);
  if (existing) return false;

  const isPast = meeting.startTime < new Date();

  const [insertedMeeting] = await db
    .insert(activities)
    .values({
      tenantId,
      actorType: "user",
      actorId,
      entityType: "contact",
      entityId: "unknown",
      activityType: isPast ? "meeting_completed" : "meeting_scheduled",
      channel: "meeting",
      direction: "outbound",
      occurredAt: meeting.startTime,
      summary: meeting.title,
      metadata: {
        calendarEventId: meeting.calendarEventId,
        calendarSource,
        startTime: meeting.startTime.toISOString(),
        endTime: meeting.endTime.toISOString(),
        attendees: meeting.attendees.map((a) => ({
          email: a.email,
          displayName: a.displayName,
          responseStatus: a.responseStatus,
        })),
        location: meeting.location,
        meetingLink: meeting.meetingLink,
        status: meeting.status,
      },
    })
    .returning();

  if (isPast && insertedMeeting) {
    await inngest
      .send({
        name: "signals/evaluate-realtime",
        data: { type: "meeting_completed" as const, tenantId, activityId: insertedMeeting.id },
      })
      .catch((e) => console.warn("meeting-sync: realtime-signal trigger failed (non-blocking)", e));
  }

  if (
    process.env.RECALL_API_KEY &&
    meeting.meetingLink &&
    !isPast &&
    insertedMeeting &&
    meeting.startTime.getTime() - Date.now() < 30 * 60 * 1000
  ) {
    try {
      const { createBotForActivity } = await import("@/lib/recording/bot-deployment");
      await createBotForActivity(insertedMeeting.id);
    } catch (recallErr) {
      console.warn(`[Recall] Failed to schedule bot for meeting ${meeting.calendarEventId}:`, recallErr);
    }
  }

  return true;
}

/**
 * Background calendar sync — runs every 15 minutes.
 * Syncs Google, Microsoft (OAuth) and CalDAV (custom IMAP/SMTP) calendars.
 */
export const cronCalendarSync = inngest.createFunction(
  {
    id: "cron-calendar-sync",
    name: "Background Calendar Sync (Google + Microsoft)",
    retries: 1,
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async ({ step }) => {
    // Find all users with OAuth accounts
    const accounts = await step.run("find-oauth-users", async () => {
      const rows = await db
        .select({
          userId: authAccounts.userId,
          provider: authAccounts.provider,
        })
        .from(authAccounts)
        .where(
          sql`${authAccounts.provider} IN ('google', 'microsoft-entra-id') AND ${authAccounts.access_token} IS NOT NULL`
        );
      return rows;
    });

    // Group by user — a user might have both Google and Microsoft
    const userProviders = new Map<string, string[]>();
    for (const row of accounts) {
      const list = userProviders.get(row.userId) || [];
      list.push(row.provider);
      userProviders.set(row.userId, list);
    }

    let totalSynced = 0;
    let errors = 0;

    for (const [userId, providers] of userProviders.entries()) {
      // Get user's tenant
      const [user] = await db
        .select()
        .from(authUsers)
        .where(eq(authUsers.id, userId))
        .limit(1);
      if (!user) continue;

      // Resolve tenant + its sync-health once per user (for the needs_reauth skip).
      const [appUser] = await db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, userId))
        .limit(1);
      const userTenantId = appUser?.tenantId ?? null;
      let tenantSettings: unknown = null;
      if (userTenantId) {
        const [t] = await db
          .select({ settings: tenants.settings })
          .from(tenants)
          .where(eq(tenants.id, userTenantId))
          .limit(1);
        tenantSettings = t?.settings ?? null;
      }

      for (const provider of providers) {
        // Skip dead connections — don't hammer a token that needs re-auth.
        if (userTenantId && isNeedsReauth(tenantSettings, userId, provider)) continue;
        try {
          let meetings: SyncedMeeting[] = [];

          if (provider === "google") {
            meetings = await fetchRecentMeetings(userId, 7, 14);
          } else if (provider === "microsoft-entra-id") {
            meetings = await fetchMicrosoftMeetings(userId, 7, 14);
          }

          // Import meetings that don't exist yet. The tenant is the same for
          // every meeting in this user's batch, so resolve it once.
          const [userRow] = await db
            .select({ tenantId: users.tenantId })
            .from(users)
            .where(eq(users.clerkId, userId))
            .limit(1);
          const tenantId = userRow?.tenantId;
          if (!tenantId) continue;

          for (const meeting of meetings) {
            const inserted = await importCronMeeting({
              tenantId,
              actorId: userId,
              meeting,
              calendarSource: provider === "google" ? "google" : "microsoft",
            });
            if (inserted) totalSynced++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Calendar sync failed for user ${userId} (${provider}):`, msg);
          // Dead OAuth grant → flag needs_reauth so this cron + the email cron skip it.
          if (userTenantId && isOAuthAuthError(msg)) {
            await markNeedsReauth(userTenantId, userId, provider, msg);
          }
          errors++;
        }
      }
    }

    // ── CalDAV sweep — custom IMAP/SMTP mailboxes have no OAuth calendar, so
    // they're keyed by tenant (connected_mailboxes), not by auth account. ──
    const caldavTenants = await step.run("find-caldav-tenants", () => tenantsWithCalDav());
    for (const tenantId of caldavTenants) {
      try {
        const meetings = await fetchCalDavMeetingsForTenant(tenantId, 7, 14);
        for (const meeting of meetings) {
          const inserted = await importCronMeeting({
            tenantId,
            actorId: "caldav-sync",
            meeting,
            calendarSource: "caldav",
          });
          if (inserted) totalSynced++;
        }
      } catch (err) {
        console.error(
          `CalDAV sync failed for tenant ${tenantId}:`,
          err instanceof Error ? err.message : String(err),
        );
        errors++;
      }
    }

    return {
      synced: totalSynced,
      users: userProviders.size,
      caldavTenants: caldavTenants.length,
      errors,
    };
  }
);

/**
 * Auto-generate meeting prep for upcoming meetings (next 24h).
 * Runs every hour.
 */
export const autoMeetingPrep = inngest.createFunction(
  {
    id: "auto-meeting-prep",
    name: "Auto Meeting Prep Generation",
    retries: 1,
    triggers: [{ cron: "0 * * * *" }],
  },
  async ({ step }) => {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find upcoming meetings in next 24h that have external attendees and no prep yet
    const upcoming = await step.run("find-upcoming-meetings", async () => {
      return db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.activityType, "meeting_scheduled"),
            eq(activities.channel, "meeting"),
            gte(activities.occurredAt, now),
            lte(activities.occurredAt, in24h),
            sql`metadata->>'prepDocument' IS NULL`
          )
        )
        .limit(20);
    });

    let prepped = 0;

    for (const meeting of upcoming) {
      const meta = (meeting.metadata || {}) as any;
      const attendees = meta.attendees || [];

      // Skip if no external attendees (all internal or empty)
      if (attendees.length === 0) continue;

      try {
        // Emit event for each meeting that needs prep
        await inngest.send({
          name: "meeting/generate-prep",
          data: {
            activityId: meeting.id,
            tenantId: meeting.tenantId,
          },
        });
        prepped++;
      } catch (err) {
        console.error(`Failed to trigger prep for meeting ${meeting.id}:`, err);
      }
    }

    return { checked: upcoming.length, prepTriggered: prepped };
  }
);

/**
 * Generate meeting prep for a single meeting.
 */
export const generateMeetingPrep = inngest.createFunction(
  {
    id: "generate-meeting-prep",
    name: "Generate Meeting Prep Document",
    retries: 2,
    triggers: [{ event: "meeting/generate-prep" }],
  },
  async ({ event, step }) => {
    const { activityId, tenantId } = event.data as { activityId: string; tenantId: string };

    const [activity] = await db
      .select()
      .from(activities)
      .where(and(eq(activities.id, activityId), eq(activities.tenantId, tenantId)))
      .limit(1);

    if (!activity) return { error: "Activity not found" };

    const meta = (activity.metadata || {}) as any;
    if (meta.prepDocument) return { skipped: true, reason: "prep already exists" };

    // Call the existing prep API logic — we import it inline to avoid circular deps
    const { anthropic } = await import("@ai-sdk/anthropic");
    const { openai } = await import("@ai-sdk/openai");
    const { contacts } = await import("@/db/schema");

    const model = process.env.ANTHROPIC_API_KEY
      ? anthropic("claude-sonnet-4-6")
      : process.env.OPENAI_API_KEY
        ? openai("gpt-4o-mini")
        : null;

    if (!model) return { error: "No LLM configured" };

    // Phase 3b: gather context via the Company Brain instead of
    // composing per-attendee contact + company + recent-activities
    // queries inline. The brain returns the full account view —
    // contacts (with champion + intent), open deals (with risk +
    // stall + citation properties), recent activities, past
    // meetings (+ transcript chunk counts), knowledge entries,
    // graph facts, and chat memories — all freshness-tagged.
    const { composeMeetingPrepContext } = await import(
      "@/lib/company-brain/meeting-prep-context"
    );

    const attendees = (meta.attendees || []) as Array<{
      email?: string;
      displayName?: string;
    }>;
    const attendeeEmails = attendees
      .map((a) => a.email)
      .filter((e): e is string => !!e);

    // Resolve company ids :
    //   1. activity.entityId when entityType === 'company'
    //   2. companyIds of any contact whose email is in attendees
    const companyIds = new Set<string>();
    if (activity.entityType === "company" && activity.entityId) {
      companyIds.add(activity.entityId);
    }

    if (attendeeEmails.length > 0) {
      const matchedContacts = await db
        .select({ companyId: contacts.companyId })
        .from(contacts)
        .where(
          and(
            eq(contacts.tenantId, tenantId),
            sql`${contacts.email} = ANY(${attendeeEmails})`,
          ),
        );
      for (const row of matchedContacts) {
        if (row.companyId) companyIds.add(row.companyId);
      }
    }

    const context = await composeMeetingPrepContext({
      meetingTitle: activity.summary,
      startTimeIso: meta.startTime ?? null,
      attendees,
      companyIds: Array.from(companyIds),
      tenantId,
    });

    // Specialize the prep to the MOMENT of the deal (computed, not configured):
    // a discovery brief differs from a demo, proposal, or close brief. Keep the
    // rich Company Brain context above and add the moment's Method doctrine.
    const { deals } = await import("@/db/schema");
    const { deriveMoment } = await import("@/lib/motion/moment");
    const { getStepDoctrine } = await import("@/lib/motion/doctrine");
    const { buildDoctrineBlock, buildMeetingPrepPrompt } = await import(
      "@/lib/meetings/meeting-prep-prompt"
    );

    // Best available deal for this meeting: a directly linked deal, else the
    // most recently touched open deal at any attendee's company.
    let dealStage: string | null = null;
    let dealOverride: string | null = null;
    if (activity.entityType === "deal" && activity.entityId) {
      const [d] = await db
        .select({ stage: deals.stage, properties: deals.properties })
        .from(deals)
        .where(and(eq(deals.id, activity.entityId), eq(deals.tenantId, tenantId)))
        .limit(1);
      if (d) {
        dealStage = d.stage;
        const p = (d.properties ?? {}) as Record<string, unknown>;
        if (typeof p.momentOverride === "string") dealOverride = p.momentOverride;
      }
    } else if (companyIds.size > 0) {
      const [d] = await db
        .select({ stage: deals.stage, properties: deals.properties })
        .from(deals)
        .where(
          and(
            eq(deals.tenantId, tenantId),
            sql`${deals.companyId} = ANY(${Array.from(companyIds)})`,
            isNull(deals.deletedAt),
            sql`${deals.stage} NOT IN ('won','lost')`,
          ),
        )
        .orderBy(desc(deals.updatedAt))
        .limit(1);
      if (d) {
        dealStage = d.stage;
        const p = (d.properties ?? {}) as Record<string, unknown>;
        if (typeof p.momentOverride === "string") dealOverride = p.momentOverride;
      }
    }

    // No deal stage → fall back to the calendar/booking meetingType signal.
    const meetingTypeMoment: Record<string, "discovery" | "demo"> = {
      intro: "discovery",
      qualification: "discovery",
      follow_up: "discovery",
      deep_dive: "demo",
    };
    const moment = dealStage
      ? deriveMoment({ override: dealOverride, hasDeal: true, dealStage }).moment
      : (meetingTypeMoment[(meta.meetingType as string) ?? ""] ?? "discovery");

    const { rubric } = getStepDoctrine(moment);
    const doctrineBlock = buildDoctrineBlock(moment, rubric);

    const { text: prepDoc } = await tracedGenerateText({
      model,
      prompt: buildMeetingPrepPrompt(moment, context, doctrineBlock),
      _trace: { agentId: "generate-meeting-prep", tenantId },
    });

    // Save prep to activity
    await db
      .update(activities)
      .set({
        metadata: { ...meta, prepDocument: prepDoc, prepMoment: moment, prepGeneratedAt: new Date().toISOString() },
      })
      .where(eq(activities.id, activityId));

    return { success: true, activityId };
  }
);

/**
 * kMeet recording sweep (the sovereign meeting-intelligence loop, zero-touch):
 * every 10 minutes, find booked meetings that ENDED with an Elevay-minted
 * kMeet room and no notes yet, fetch their recording from the tenant's kDrive
 * (correlated EXACTLY by room name — we mint it at booking, kMeet names the
 * file after it), transcribe (Whisper accepts the mp4 directly, <=25 MB) and
 * run the same pipeline as a manual upload. The founder's bar (2026-07-02):
 * "le meeting se termine -> les notes apparaissent", nobody uploads anything.
 *
 * Idempotent: candidates are rows WITHOUT structuredNotes and WITHOUT a
 * recordingSweepStatus verdict; a recording not deposited yet simply retries
 * next cycle (kMeet takes a few minutes to publish after Stop).
 */
export const cronMeetingRecordingSweep = inngest.createFunction(
  {
    id: "cron-meeting-recording-sweep",
    name: "kMeet Recording Sweep (kDrive -> transcript pipeline)",
    retries: 1,
    triggers: [{ cron: "*/10 * * * *" }],
  },
  async ({ step }) => {
    const { kdriveConfigured, findRecordingByRoom, downloadKdriveFile } = await import(
      "@/lib/integrations/kdrive"
    );
    const { transcriptionConfigured, transcribeAudio } = await import(
      "@/lib/integrations/transcribe"
    );
    if (!kdriveConfigured() || !transcriptionConfigured()) {
      return { skipped: "not_configured" };
    }

    const candidates = await step.run("find-ended-kmeet-meetings", async () => {
      const rows = await db
        .select({
          id: activities.id,
          tenantId: activities.tenantId,
          actorId: activities.actorId,
          entityType: activities.entityType,
          entityId: activities.entityId,
          summary: activities.summary,
          metadata: activities.metadata,
        })
        .from(activities)
        .where(
          and(
            eq(activities.activityType, "meeting_scheduled"),
            isNull(activities.deletedAt),
            sql`metadata->>'roomName' is not null`,
            sql`metadata->'structuredNotes' is null`,
            // 'empty_transcript' stays a candidate: a silent/failed take must
            // not permanently block the meeting — when the organizer records a
            // NEW take of the same room, it gets processed (the step below
            // skips while the latest file is still the one already tried).
            sql`(metadata->>'recordingSweepStatus' is null or metadata->>'recordingSweepStatus' = 'empty_transcript')`,
            // Ended (start + duration passed), but recent enough to still care.
            sql`(metadata->>'startTime')::timestamptz + make_interval(mins => coalesce((metadata->>'durationMinutes')::int, 30)) < now()`,
            sql`(metadata->>'startTime')::timestamptz > now() - interval '48 hours'`,
          ),
        )
        .limit(10);
      return rows;
    });

    let processed = 0;
    for (const activity of candidates) {
      const ok = await step.run(`process-${activity.id}`, async () => {
        const meta = (activity.metadata ?? {}) as Record<string, unknown>;
        const roomName = String(meta.roomName ?? "");
        if (!roomName) return false;

        const file = await findRecordingByRoom(roomName);
        // Not deposited yet (kMeet publishes a few minutes after Stop, and the
        // organizer may simply not have recorded) — retry next cycle until the
        // 48h window closes.
        if (!file) return false;
        // Already tried THIS take and it was silent — wait for a newer one
        // (pickRecordingForRoom returns the latest take of the room).
        if (
          meta.recordingSweepStatus === "empty_transcript" &&
          String(meta.recordingFileId ?? "") === String(file.id)
        ) {
          return false;
        }

        const markStatus = async (status: string, extra: Record<string, unknown> = {}) => {
          await db
            .update(activities)
            .set({ metadata: { ...meta, recordingSweepStatus: status, ...extra } })
            .where(eq(activities.id, activity.id));
        };

        if (file.size > 25 * 1024 * 1024) {
          // Whisper's hard ceiling — mark so we don't loop forever; the
          // storage-side compression path is the noted v2.
          await markStatus("too_large", { recordingFileId: file.id, recordingFileName: file.name });
          return false;
        }

        const buf = await downloadKdriveFile(file.id);
        // Uint8Array.from copies into a fresh ArrayBuffer-backed view — a raw
        // Buffer's ArrayBufferLike backing is not assignable to BlobPart.
        const transcript = await transcribeAudio(
          new File([Uint8Array.from(buf)], file.name, { type: "video/mp4" }),
        );
        if (transcript.trim().length < 50) {
          await markStatus("empty_transcript", { recordingFileId: file.id });
          return false;
        }

        // Attendee emails feed both participant matching AND the internal-vs-
        // sales register: an all-internal (cofounder) sync must resolve as
        // internal, which needs the REAL invite list, not just the linked
        // contact. Union the booked meeting's attendees with the contact email.
        const attendeeEmailSet = new Set<string>();
        if (Array.isArray(meta.attendees)) {
          for (const a of meta.attendees as Array<{ email?: string }>) {
            if (a?.email) attendeeEmailSet.add(a.email);
          }
        }
        if (activity.entityType === "contact" && activity.entityId) {
          const [c] = await db
            .select({ email: contactsTable.email })
            .from(contactsTable)
            .where(eq(contactsTable.id, activity.entityId))
            .limit(1);
          if (c?.email) attendeeEmailSet.add(c.email);
        }
        const attendeeEmails = attendeeEmailSet.size ? Array.from(attendeeEmailSet) : undefined;

        const { processMeetingTranscript } = await import(
          "@/lib/meetings/process-transcript-core"
        );
        await processMeetingTranscript({
          tenantId: activity.tenantId,
          actorAppUserId: activity.actorId ?? "system",
          transcript,
          meetingTitle:
            (meta.title as string | undefined) ??
            activity.summary?.replace(/^Meeting booked: /, "") ??
            undefined,
          meetingDate: (meta.startTime as string | undefined) ?? undefined,
          attendeeEmails,
          activityId: activity.id,
          source: "kdrive_kmeet",
        });

        // Sovereign-path parity: processMeetingTranscript captures + indexes the
        // meeting but — unlike the Recall/Jibri path — does not create tasks,
        // draft a follow-up, or write the MEDDPICC / account / contact
        // qualification that fills the fiches. Run the post-call enrichment on
        // the just-written activity so a kMeet meeting lands the same
        // intelligence a Recall one does. skipCoaching: processMeetingTranscript
        // already emitted coaching/post-interaction and the insight write has no
        // per-activity dedup, so a second emit would duplicate it. Non-fatal —
        // the transcript + notes are already saved; enrichment is additive.
        try {
          const { processPostCall } = await import("@/lib/meetings/post-call");
          await processPostCall({
            activityId: activity.id,
            tenantId: activity.tenantId,
            userId: null,
            skipCoaching: true,
          });
        } catch (e) {
          console.warn(
            "recording-sweep: post-call enrichment failed (non-fatal)",
            e instanceof Error ? e.message : String(e),
          );
        }

        // processMeetingTranscript merged structuredNotes into metadata; add
        // the sweep's own provenance on top (re-read not needed — merge again).
        await db
          .update(activities)
          .set({
            metadata: sql`metadata || ${JSON.stringify({
              recordingSweepStatus: "processed",
              recordingFileId: file.id,
              recordingFileName: file.name,
              recordingProcessedAt: new Date().toISOString(),
            })}::jsonb`,
          })
          .where(eq(activities.id, activity.id));
        return true;
      });
      if (ok) processed++;
    }

    return { candidates: candidates.length, processed };
  },
);
