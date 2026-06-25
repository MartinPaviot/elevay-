import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/voice/twilio-signature", () => ({
  validateTwilioSignature: vi.fn(() => true),
}));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn() } }));

import { validateTwilioSignature } from "@/lib/voice/twilio-signature";

const route = await import("@/app/api/calls/disclosure-whisper/route");

const DISC = "https://cdn.example.com/disclosure-fr.mp3";

function post() {
  return new Request("http://x/api/calls/disclosure-whisper", {
    method: "POST",
    headers: { "x-twilio-signature": "sig" },
    body: "CallSid=CA1",
  });
}

describe("POST /api/calls/disclosure-whisper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateTwilioSignature).mockReturnValue(true);
    delete process.env.VOICE_DISCLOSURE_AUDIO_URL;
    delete process.env.VOICE_DISCLOSURE_TEXT;
  });
  afterEach(() => {
    delete process.env.VOICE_DISCLOSURE_AUDIO_URL;
    delete process.env.VOICE_DISCLOSURE_TEXT;
  });

  it("plays the configured MP3 when VOICE_DISCLOSURE_AUDIO_URL is set", async () => {
    process.env.VOICE_DISCLOSURE_AUDIO_URL = DISC;
    const res = await route.POST(post());
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain("<Play>");
    expect(body).toContain("disclosure-fr.mp3");
  });

  it("speaks the TTS text via <Say> when only VOICE_DISCLOSURE_TEXT is set", async () => {
    process.env.VOICE_DISCLOSURE_TEXT = "Cet appel est enregistré.";
    const res = await route.POST(post());
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain("<Say");
    expect(body).toContain("Cet appel est enregistr"); // accent-tolerant
    expect(body).not.toContain("<Play>");
  });

  it("returns an empty response when nothing is configured", async () => {
    const res = await route.POST(post());
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).not.toContain("<Play>");
    expect(body).not.toContain("<Say");
  });

  it("403s on an invalid Twilio signature", async () => {
    process.env.VOICE_DISCLOSURE_AUDIO_URL = DISC;
    vi.mocked(validateTwilioSignature).mockReturnValue(false);
    const res = await route.POST(post());
    expect(res.status).toBe(403);
  });
});
