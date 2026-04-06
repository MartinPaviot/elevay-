/**
 * Recall.ai API client — meeting bot management.
 * Docs: https://docs.recall.ai
 */

const RECALL_BASE = "https://us-east-1.recall.ai/api/v1";

function getApiKey(): string {
  const key = process.env.RECALL_API_KEY;
  if (!key) throw new Error("RECALL_API_KEY not configured");
  return key;
}

function headers(): HeadersInit {
  return {
    Authorization: `Token ${getApiKey()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface RecallBot {
  id: string;
  meeting_url: string;
  status_changes: Array<{
    code: string;
    sub_code: string | null;
    message: string | null;
    created_at: string;
  }>;
  recordings: Array<{
    id: string;
    media_shortcuts?: {
      transcript?: {
        id: string;
        data: { download_url: string };
      };
      video_mixed?: {
        data: { download_url: string };
        format: string;
      };
    };
  }>;
}

export interface TranscriptSegment {
  participant: {
    id: number;
    name: string;
    is_host: boolean;
    platform: string;
  };
  words: Array<{
    text: string;
    start_timestamp: { relative: number; absolute: string };
    end_timestamp: { relative: number; absolute: string };
  }>;
}

export interface RecallWebhookEvent {
  event: string;
  data: {
    data: {
      code: string;
      sub_code: string | null;
      updated_at: string;
    };
    bot: {
      id: string;
      metadata: Record<string, unknown>;
    };
  };
}

/* ------------------------------------------------------------------ */
/*  API functions                                                      */
/* ------------------------------------------------------------------ */

/**
 * Create a bot that joins a meeting and records + transcribes.
 * Uses Recall.ai's built-in streaming transcription.
 */
export async function createBot(
  meetingUrl: string,
  options?: {
    botName?: string;
    webhookUrl?: string;
  }
): Promise<RecallBot> {
  const webhookUrl = options?.webhookUrl || `${process.env.AUTH_URL || process.env.NEXTAUTH_URL}/api/webhooks/recall`;

  const body: Record<string, unknown> = {
    meeting_url: meetingUrl,
    bot_name: options?.botName || "Elevay",
    recording_config: {
      transcript: {
        provider: {
          meeting_captions: {},
        },
      },
    },
  };

  // If we have a webhook URL, add status change webhook
  if (webhookUrl) {
    body.metadata = { webhook_url: webhookUrl };
  }

  const res = await fetch(`${RECALL_BASE}/bot/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Recall.ai createBot failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Get bot details including status and recordings.
 */
export async function getBotStatus(botId: string): Promise<RecallBot> {
  const res = await fetch(`${RECALL_BASE}/bot/${botId}/`, {
    headers: headers(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Recall.ai getBotStatus failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Get the transcript for a bot's recording.
 * Fetches the bot details, extracts the transcript download URL,
 * then downloads and returns the transcript segments.
 */
export async function getBotTranscript(botId: string): Promise<TranscriptSegment[]> {
  const bot = await getBotStatus(botId);

  const recording = bot.recordings?.[0];
  if (!recording?.media_shortcuts?.transcript?.data?.download_url) {
    throw new Error(`No transcript available for bot ${botId}`);
  }

  const downloadUrl = recording.media_shortcuts.transcript.data.download_url;
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Token ${getApiKey()}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to download transcript (${res.status})`);
  }

  return res.json();
}

/**
 * Convert Recall.ai transcript segments to plain text with speaker labels.
 */
export function transcriptToText(segments: TranscriptSegment[]): string {
  return segments
    .map((seg) => {
      const speaker = seg.participant.name || `Speaker ${seg.participant.id}`;
      const text = seg.words.map((w) => w.text).join(" ");
      return `${speaker}: ${text}`;
    })
    .join("\n\n");
}

/**
 * Delete a bot (stops recording if in progress).
 */
export async function deleteBot(botId: string): Promise<void> {
  const res = await fetch(`${RECALL_BASE}/bot/${botId}/`, {
    method: "DELETE",
    headers: headers(),
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Recall.ai deleteBot failed (${res.status}): ${text}`);
  }
}

/**
 * Map Recall.ai status codes to simple status labels.
 */
export function mapBotStatus(code: string): string {
  switch (code) {
    case "ready":
    case "joining_call":
      return "scheduled";
    case "in_waiting_room":
      return "waiting";
    case "in_call_not_recording":
    case "in_call_recording":
      return "recording";
    case "call_ended":
    case "done":
      return "done";
    case "fatal":
    case "error":
      return "error";
    default:
      return code;
  }
}
