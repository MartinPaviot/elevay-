import { getAuthContext } from "@/lib/auth/auth-utils";
import { checkRateLimit } from "@/lib/infra/rate-limit";
import {
  processMeetingTranscript,
  TranscriptModelUnavailableError,
} from "@/lib/meetings/process-transcript-core";

/**
 * POST /api/meetings/process-transcript — thin HTTP wrapper. The whole
 * pipeline (structured notes, contact matching, capture-approval activity
 * write, RAG indexing, deal intel, context graph, coaching event) lives in
 * lib/meetings/process-transcript-core.ts, shared with the kDrive recording
 * sweep (Inngest cron) so an auto-fetched recording produces byte-identical
 * intelligence to a manual upload.
 */
export async function POST(req: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlResponse = await checkRateLimit("llm", authCtx.userId);
  if (rlResponse) return rlResponse;

  try {
    const body = await req.json();
    const { transcript, meetingTitle, meetingDate, attendeeEmails, activityId, dealId } = body;

    if (!transcript || typeof transcript !== "string" || transcript.trim().length < 50) {
      return Response.json({ error: "Transcript required (min 50 characters)" }, { status: 400 });
    }

    const result = await processMeetingTranscript({
      tenantId: authCtx.tenantId,
      actorAppUserId: authCtx.appUserId,
      actorUserId: authCtx.userId,
      transcript,
      meetingTitle,
      meetingDate,
      attendeeEmails,
      activityId,
      dealId,
      source: "manual_paste",
    });

    return Response.json({
      success: true,
      notes: result.notes,
      matchedContacts: result.matchedContacts,
    });
  } catch (error) {
    if (error instanceof TranscriptModelUnavailableError) {
      return Response.json({ error: "No LLM API key configured" }, { status: 500 });
    }
    console.error("Transcript processing failed:", error);
    return Response.json({ error: "Transcript processing failed" }, { status: 500 });
  }
}
