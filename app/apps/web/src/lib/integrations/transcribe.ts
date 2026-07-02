/**
 * Speech-to-text seam.
 *
 * Defaults to OpenAI Whisper (the current behaviour). Point WHISPER_BASE_URL at
 * a self-hosted, OpenAI-compatible endpoint (faster-whisper / whisper.cpp /
 * Speaches) to keep the prospect's voice on sovereign EU/CH infrastructure —
 * see _specs/sovereign-recording. Same code, config swap. Shared by the manual
 * upload path and the Jibri recording webhook so there is one STT seam.
 */

import OpenAI from "openai";

type WhisperEnv = {
  WHISPER_BASE_URL?: string;
  WHISPER_API_KEY?: string;
  WHISPER_MODEL?: string;
  OPENAI_API_KEY?: string;
  // Declared on NodeJS.ProcessEnv — lets `= process.env` satisfy this
  // otherwise all-optional ("weak") type while tests pass plain objects.
  NODE_ENV?: string;
};

export interface WhisperConfig {
  baseURL: string | undefined;
  apiKey: string;
  model: string;
}

/** Resolve the STT endpoint from env. baseURL unset = OpenAI's default host. */
export function resolveWhisperConfig(env: WhisperEnv = process.env): WhisperConfig {
  return {
    baseURL: env.WHISPER_BASE_URL?.trim() || undefined,
    // A self-hosted server often ignores the key but the SDK requires one.
    apiKey: env.OPENAI_API_KEY || env.WHISPER_API_KEY || "sk-noauth",
    model: env.WHISPER_MODEL?.trim() || "gpt-4o-mini-transcribe",
  };
}

/** True when transcription can run (a self-hosted endpoint or an OpenAI key). */
export function transcriptionConfigured(env: WhisperEnv = process.env): boolean {
  return !!(env.WHISPER_BASE_URL || env.OPENAI_API_KEY || env.WHISPER_API_KEY);
}

/**
 * Free-text context passed to gpt-4o-*-transcribe (and whisper-1) to bias the
 * spelling of our own proper nouns. The 2026-07-02 kMeet loop test transcribed
 * "Elevay" as "Elvay", "kMeet" as "Commit" and "Recall" as "BotryCall" — none
 * are in the model's prior. gpt-4o-*-transcribe read this as free-text context
 * (like any GPT-4o prompt); whisper-1 reads it as a keyword list (224-tok cap,
 * this is ~40). Callers add per-meeting attendee/company names via `opts.prompt`.
 */
export const TRANSCRIPTION_VOCAB_PROMPT =
  "Sales or team meeting for Elevay (the leadsens platform). " +
  "Correct spellings for likely proper nouns: Elevay, leadsens, Pilae, " +
  "kMeet, kDrive, Infomaniak, Recall, Inngest, Instantly, Unipile, Neon.";

/**
 * Transcribe an audio File to plain text. Always seeds {@link
 * TRANSCRIPTION_VOCAB_PROMPT}; `opts.prompt` is appended (not replaced) so a
 * caller can add per-meeting names without losing the brand vocabulary.
 */
export async function transcribeAudio(
  file: File,
  opts: { prompt?: string } = {},
): Promise<string> {
  const { baseURL, apiKey, model } = resolveWhisperConfig();
  const client = new OpenAI({ apiKey, baseURL });
  const res = await client.audio.transcriptions.create({
    model,
    file,
    prompt: [TRANSCRIPTION_VOCAB_PROMPT, opts.prompt?.trim()].filter(Boolean).join(" "),
    // 'json' everywhere: the gpt-4o-*-transcribe models reject 'verbose_json'
    // (400 on EVERY audio upload since they became the default — found live
    // 2026-07-02 by the kMeet sweep), whisper-1 accepts 'json' too, and we
    // only ever read `.text`.
    response_format: "json",
  });
  return res.text;
}

/** Fetch a (sovereign, our-infra) audio URL and transcribe it. */
export async function transcribeFromUrl(
  audioUrl: string,
  opts: { prompt?: string } = {},
): Promise<string> {
  const resp = await fetch(audioUrl);
  if (!resp.ok) throw new Error(`Failed to fetch recording (${resp.status})`);
  const blob = await resp.blob();
  const name = new URL(audioUrl).pathname.split("/").pop() || "recording.webm";
  const file = new File([blob], name, { type: blob.type || "audio/webm" });
  return transcribeAudio(file, opts);
}
