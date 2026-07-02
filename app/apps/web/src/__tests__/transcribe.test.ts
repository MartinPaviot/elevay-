import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveWhisperConfig,
  transcriptionConfigured,
  transcribeAudio,
  TRANSCRIPTION_VOCAB_PROMPT,
} from "@/lib/integrations/transcribe";

// Capture the args every transcription call receives so we can assert on the
// prompt without hitting the network. vi.mock is hoisted above the imports.
const createMock = vi.fn(async (_args: unknown) => ({ text: "transcript" }));
vi.mock("openai", () => ({
  default: class {
    audio = { transcriptions: { create: createMock } };
  },
}));

describe("transcribe — STT seam", () => {
  it("defaults to OpenAI (no baseURL) with the default model", () => {
    const cfg = resolveWhisperConfig({ OPENAI_API_KEY: "sk-real" });
    expect(cfg.baseURL).toBeUndefined();
    expect(cfg.apiKey).toBe("sk-real");
    expect(cfg.model).toBe("gpt-4o-mini-transcribe");
  });

  it("points at a self-hosted sovereign endpoint when WHISPER_BASE_URL is set", () => {
    const cfg = resolveWhisperConfig({
      WHISPER_BASE_URL: "https://whisper.pilae.ch/v1",
      WHISPER_MODEL: "whisper-large-v3",
    });
    expect(cfg.baseURL).toBe("https://whisper.pilae.ch/v1");
    expect(cfg.model).toBe("whisper-large-v3");
    // Self-hosted server may ignore the key, but the SDK requires a non-empty one.
    expect(cfg.apiKey).toBe("sk-noauth");
  });

  it("prefers OPENAI_API_KEY, falls back to WHISPER_API_KEY", () => {
    expect(resolveWhisperConfig({ WHISPER_API_KEY: "wk" }).apiKey).toBe("wk");
    expect(resolveWhisperConfig({ OPENAI_API_KEY: "ok", WHISPER_API_KEY: "wk" }).apiKey).toBe("ok");
  });

  it("transcriptionConfigured reflects whether any endpoint/key exists", () => {
    expect(transcriptionConfigured({})).toBe(false);
    expect(transcriptionConfigured({ OPENAI_API_KEY: "ok" })).toBe(true);
    expect(transcriptionConfigured({ WHISPER_BASE_URL: "https://whisper.pilae.ch" })).toBe(true);
    expect(transcriptionConfigured({ WHISPER_API_KEY: "wk" })).toBe(true);
  });
});

describe("transcribeAudio — vocabulary prompt", () => {
  const file = new File([new Uint8Array([1, 2, 3])], "rec.mp4", { type: "video/mp4" });
  beforeEach(() => createMock.mockClear());

  it("seeds the brand-vocabulary prompt and asks for json", async () => {
    await transcribeAudio(file);
    expect(createMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0][0] as { prompt: string; response_format: string };
    expect(arg.prompt).toBe(TRANSCRIPTION_VOCAB_PROMPT);
    expect(arg.prompt).toContain("Elevay");
    expect(arg.prompt).toContain("kMeet");
    // gpt-4o-*-transcribe reject verbose_json — the seam only ever asks for json.
    expect(arg.response_format).toBe("json");
  });

  it("appends a caller-supplied prompt without dropping the brand vocabulary", async () => {
    await transcribeAudio(file, { prompt: "Attendees: Sarah Chen; company: Northwind." });
    const arg = createMock.mock.calls[0][0] as { prompt: string };
    expect(arg.prompt.startsWith(TRANSCRIPTION_VOCAB_PROMPT)).toBe(true);
    expect(arg.prompt).toContain("Sarah Chen");
    expect(arg.prompt).toContain("Northwind");
  });

  it("ignores a blank override and keeps the default prompt intact", async () => {
    await transcribeAudio(file, { prompt: "   " });
    const arg = createMock.mock.calls[0][0] as { prompt: string };
    expect(arg.prompt).toBe(TRANSCRIPTION_VOCAB_PROMPT);
  });
});
