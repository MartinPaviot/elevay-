/**
 * Transcript → meeting intelligence, as a CALLABLE core (factored out of
 * /api/meetings/process-transcript so the kDrive recording sweep — an Inngest
 * cron with no HTTP request, no cookie, no authCtx — runs the exact same
 * pipeline the upload page does: structured notes, contact matching, activity
 * write (capture-approval aware), RAG indexing, deal intel, context graph,
 * post-interaction coaching).
 *
 * Behavior is a 1:1 move from the route (2026-07-02): the route keeps auth,
 * rate limiting and HTTP shapes; everything below is transport-agnostic.
 */

import { db } from "@/db";
import { activities, contacts, deals, tenants } from "@/db/schema";
import { eq, and, ilike, isNull } from "drizzle-orm";
import { tracedGenerateObject } from "@/lib/ai/traced-ai";
import { anthropic } from "@/lib/ai/ai-provider";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { embedEntity, activityToText } from "@/lib/ai/embeddings";
import { ingestEpisode } from "@/lib/ai/context-graph";
import { indexTranscript } from "@/lib/coaching/index-transcript";
import { logger } from "@/lib/observability/logger";
import { llmCall } from "@/lib/ai/llm-call";
import { recordCapturedActivity, getCaptureApprovalMode } from "@/lib/capture/approval";
import { inngest } from "@/inngest/client";
import { meetingNotesSchema, buildMeetingNotesPrompt } from "@/lib/meetings/notes-schema";

export interface ProcessTranscriptInput {
  tenantId: string;
  /** APP users.id — actorId on a created activity. */
  actorAppUserId: string;
  /** Auth-user id for the coaching event; falls back to actorAppUserId. */
  actorUserId?: string;
  transcript: string;
  meetingTitle?: string;
  meetingDate?: string;
  attendeeEmails?: string[];
  /** Existing meeting activity to UPDATE (else a new one is created). */
  activityId?: string | null;
  dealId?: string | null;
  /** transcript_chunks provenance, e.g. "manual_paste" | "kdrive_kmeet". */
  source?: string;
}

export type MeetingNotes = z.infer<typeof meetingNotesSchema>;

export interface ProcessTranscriptResult {
  notes: MeetingNotes;
  matchedContacts: Array<{ name: string; contactId: string | null }>;
  meetingId: string | null;
}

/** No LLM key configured — the caller decides how to surface it. */
export class TranscriptModelUnavailableError extends Error {
  constructor() {
    super("No LLM API key configured");
  }
}

export async function processMeetingTranscript(
  input: ProcessTranscriptInput,
): Promise<ProcessTranscriptResult> {
  const {
    tenantId,
    actorAppUserId,
    transcript,
    meetingTitle,
    meetingDate,
    attendeeEmails,
    activityId,
    dealId,
  } = input;
  const actorUserId = input.actorUserId ?? actorAppUserId;

  const model = process.env.ANTHROPIC_API_KEY
    ? anthropic("claude-sonnet-4-6")
    : process.env.OPENAI_API_KEY
      ? openai("gpt-4o-mini")
      : null;
  if (!model) throw new TranscriptModelUnavailableError();

  // Extract structured notes from transcript. Wrapped in llmCall so cost /
  // latency / retries / fallback flow into `llm_calls`. Anthropic primary,
  // OpenAI gpt-4o-mini fallback when Anthropic errors terminally.
  const isPrimaryAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const { object: rawNotes } = (await llmCall({
    fn: tracedGenerateObject,
    args: [{
      model,
      schema: meetingNotesSchema,
      prompt: buildMeetingNotesPrompt({
        transcript: transcript.slice(0, 15000),
        meetingTitle,
        meetingDate,
      }),
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
      _trace: { agentId: "process-transcript", tenantId },
    }] as never,
    fallbackModel: isPrimaryAnthropic ? openai("gpt-4o-mini") : undefined,
    retries: 1,
    timeoutMs: 60_000,
    trace: {
      tenantId,
      surfaceId: "process-transcript",
      promptId: "meeting-notes-extraction.v1",
      metadata: { agentId: "process-transcript", activityId, dealId },
    },
  })) as { object: MeetingNotes };
  const notes = rawNotes as any;

  // Try to match participants to existing contacts
  const matchedContacts: Array<{ name: string; contactId: string | null }> = [];
  for (const participant of notes.participants) {
    let contactId: string | null = null;
    if (attendeeEmails?.length) {
      for (const email of attendeeEmails) {
        const [match] = await db
          .select({ id: contacts.id })
          .from(contacts)
          .where(
            and(
              eq(contacts.tenantId, tenantId),
              eq(contacts.email, email),
              isNull(contacts.deletedAt)
            )
          )
          .limit(1);
        if (match) {
          contactId = match.id;
          break;
        }
      }
    }

    if (!contactId && participant.name) {
      const nameParts = participant.name.split(" ");
      if (nameParts.length >= 2) {
        const [match] = await db
          .select({ id: contacts.id })
          .from(contacts)
          .where(
            and(
              eq(contacts.tenantId, tenantId),
              ilike(contacts.firstName, nameParts[0]),
              ilike(contacts.lastName, nameParts[nameParts.length - 1]),
              isNull(contacts.deletedAt)
            )
          )
          .limit(1);
        if (match) contactId = match.id;
      }
    }

    matchedContacts.push({ name: participant.name, contactId });
  }

  // Save as activity if activityId provided (update existing meeting activity)
  let resolvedMeetingId: string | null = activityId ?? null;
  if (activityId) {
    // MERGE into the existing metadata — the route used to REPLACE it, which
    // silently dropped the meeting's calendar keys (roomName, calendarEventId,
    // startTime…) and would have re-opened the sync-duplication bug fixed in
    // #636 the moment notes landed on a booked meeting.
    const [existingRow] = await db
      .select({ metadata: activities.metadata })
      .from(activities)
      .where(
        and(
          eq(activities.id, activityId),
          eq(activities.tenantId, tenantId),
          isNull(activities.deletedAt)
        )
      )
      .limit(1);
    await db
      .update(activities)
      .set({
        summary: notes.summary,
        sentiment: notes.sentiment,
        metadata: {
          ...((existingRow?.metadata as Record<string, unknown>) ?? {}),
          structuredNotes: notes,
          matchedContacts,
          transcriptLength: transcript.length,
          processedAt: new Date().toISOString(),
        },
      })
      .where(
        and(
          eq(activities.id, activityId),
          eq(activities.tenantId, tenantId),
          isNull(activities.deletedAt)
        )
      );
  } else {
    // Create a new meeting activity linked to the first matched contact.
    const entityType = "contact";
    const entityId = matchedContacts.find((c) => c.contactId)?.contactId || "";

    // Pre-generate the activity id so (a) the transcript indexes under it
    // regardless of capture mode and (b) the activity — inserted now in
    // 'auto' or on approval in 'review' — reuses the same id.
    const meetingActivityId = crypto.randomUUID();
    const [t] = await db
      .select({ settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const mode = getCaptureApprovalMode(t?.settings as Record<string, unknown> | null);
    await recordCapturedActivity({
      tenantId,
      mode,
      kind: "meeting",
      sourceRef: meetingActivityId,
      activity: {
        id: meetingActivityId,
        tenantId,
        actorType: "user",
        actorId: actorAppUserId,
        entityType,
        entityId: entityId || "unknown",
        activityType: "meeting_completed",
        channel: "meeting",
        direction: "internal",
        occurredAt: meetingDate ? new Date(meetingDate) : new Date(),
        summary: notes.summary,
        rawContent: transcript.slice(0, 10000),
        sentiment: notes.sentiment,
        metadata: {
          title: meetingTitle,
          structuredNotes: notes,
          matchedContacts,
          transcriptLength: transcript.length,
          processedAt: new Date().toISOString(),
        },
      },
    });
    resolvedMeetingId = meetingActivityId;
  }

  // MONACO-PARITY-05: index the transcript into transcript_chunks for RAG
  // coaching. Fire-and-forget — failure to index never blocks the result.
  if (resolvedMeetingId) {
    indexTranscript({
      tenantId,
      meetingId: resolvedMeetingId,
      rawText: transcript,
      totalDurationSec: 0, // unknown from a flat string
      source: input.source ?? "manual_paste",
    }).catch((err) => {
      logger.warn("process-transcript: indexTranscript failed", {
        tenantId,
        meetingId: resolvedMeetingId,
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // S9: Auto-update deal with extracted structured data
  if (dealId && notes.buyingSignals) {
    try {
      const [deal] = await db.select().from(deals)
        .where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId), isNull(deals.deletedAt))).limit(1);
      if (deal) {
        const props = (deal.properties || {}) as Record<string, unknown>;
        const extracted: Record<string, unknown> = {};
        if (notes.buyingSignals.budget) extracted.budget = notes.buyingSignals.budget;
        if (notes.buyingSignals.teamSize) extracted.teamSize = notes.buyingSignals.teamSize;
        if (notes.buyingSignals.currentStack?.length) extracted.currentTools = notes.buyingSignals.currentStack;
        if (notes.buyingSignals.competitors?.length) extracted.competitors = notes.buyingSignals.competitors;
        if (notes.buyingSignals.timeline) extracted.timeline = notes.buyingSignals.timeline;
        if (notes.buyingSignals.painPoints?.length) extracted.painPoints = notes.buyingSignals.painPoints;

        if (Object.keys(extracted).length > 0) {
          await db.update(deals).set({
            properties: {
              ...props,
              extractedIntel: {
                ...((props.extractedIntel || {}) as Record<string, unknown>),
                ...extracted,
                lastExtracted: new Date().toISOString(),
              },
            },
            updatedAt: new Date(),
          }).where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId), isNull(deals.deletedAt)));
        }
      }
    } catch {
      // Non-critical
    }
  }

  // Embed the processed transcript for RAG search
  if (process.env.OPENAI_API_KEY) {
    try {
      const activityText = activityToText({
        activityType: "meeting_completed",
        summary: notes.summary,
        rawContent: transcript.slice(0, 3000),
        channel: "meeting",
        direction: "internal",
        occurredAt: meetingDate ? new Date(meetingDate) : new Date(),
      });
      const targetId = activityId || `transcript-${Date.now()}`;
      await embedEntity(tenantId, "activity", targetId, activityText);
    } catch {
      // Non-critical embedding failure
    }
  }

  // Ingest into context graph (async, non-blocking)
  if (transcript.length > 50) {
    const graphContent = `Meeting: ${meetingTitle || "Untitled"}\nDate: ${meetingDate || new Date().toISOString()}\nParticipants: ${notes.participants.map((p: any) => p.name).join(", ")}\n\nSummary: ${notes.summary}\n\nKey Points:\n${notes.keyPoints.join("\n")}\n\nDecisions:\n${notes.decisions.join("\n")}\n\nAction Items:\n${notes.actionItems.map((a: any) => `- ${a.owner}: ${a.task}`).join("\n")}`;
    ingestEpisode(tenantId, graphContent, "meeting", activityId || `meeting-${Date.now()}`)
      .catch((e) => console.warn("process-transcript: ingestEpisode failed (non-blocking)", e));
  }

  // POST-MEETING ONLY — feed the playbook extractor + post-interaction
  // coaching (consumers self-gate on an LLM key and load the activity by id).
  if (resolvedMeetingId) {
    await inngest
      .send({
        name: "coaching/post-interaction",
        data: {
          tenantId,
          activityId: resolvedMeetingId,
          userId: actorUserId,
        },
      })
      .catch((e) => console.warn("process-transcript: post-interaction emit failed (non-blocking)", e));
  }

  return { notes, matchedContacts, meetingId: resolvedMeetingId };
}
