import { describe, it, expect } from "vitest";
import {
  buildTwiml,
  buildAgentTwiml,
  buildDisclosureWhisperTwiml,
  buildVoicemailDropTwiml,
  buildFallbackTwiml,
} from "@/lib/voice/twilio";

/**
 * Exercises the TwiML composition helpers against the real Twilio SDK
 * VoiceResponse — that's the surface Twilio actually validates against
 * at runtime so we don't want a hand-rolled assertion that drifts.
 */

describe("buildTwiml — outbound call composition", () => {
  it("includes <Transcription> (Deepgram) and <Dial> + <Number>", async () => {
    const xml = await buildTwiml({
      toNumber: "+33612345678",
      fromNumber: "+33122334455",
      transcriptionCallbackUrl: "https://example.com/api/calls/transcription?callId=abc",
      languageCode: "fr-FR",
      recordingStatusUrl: "https://example.com/api/calls/recording-status",
    });
    expect(xml).toContain("<Transcription");
    expect(xml).toContain("api/calls/transcription");
    expect(xml).toContain("deepgram");
    expect(xml).toContain("<Dial");
    expect(xml).toContain("+33122334455");
    expect(xml).toContain("<Number");
    expect(xml).toContain("+33612345678");
    // Recording is opt-in — off unless the route resolves record:true, so
    // nothing is captured/announced by default.
    expect(xml).not.toContain("recordingStatusCallback=");
    expect(xml).not.toContain("record-from-answer-dual");
  });

  it("records only when record:true is passed (never silently)", async () => {
    const xml = await buildTwiml({
      toNumber: "+33612345678",
      fromNumber: "+33122334455",
      transcriptionCallbackUrl: "https://example.com/api/calls/transcription?callId=abc",
      recordingStatusUrl: "https://example.com/api/calls/recording-status",
      record: true,
    });
    expect(xml).toContain("record-from-answer-dual");
    expect(xml).toContain("recordingStatusCallback=");
  });

  it("includes <Play disclosure> when supplied", async () => {
    const xml = await buildTwiml({
      toNumber: "+33612345678",
      fromNumber: "+33122334455",
      transcriptionCallbackUrl: "https://example.com/api/calls/transcription?callId=abc",
      disclosureUrl: "https://cdn.example.com/disclosure-fr.mp3",
      recordingStatusUrl: "https://example.com/api/calls/recording-status",
    });
    expect(xml).toContain("<Play");
    expect(xml).toContain("disclosure-fr.mp3");
  });

  it("omits <Play> when no disclosureUrl", async () => {
    const xml = await buildTwiml({
      toNumber: "+12125551234",
      fromNumber: "+12128889999",
      transcriptionCallbackUrl: "https://example.com/api/calls/transcription?callId=abc",
      recordingStatusUrl: "https://example.com/api/calls/recording-status",
    });
    expect(xml).not.toContain("<Play>");
  });
});

describe("buildAgentTwiml — bridged Call Mode leg", () => {
  const base = {
    toNumber: "+33612345678",
    fromNumber: "+33122334455",
    transcriptionCallbackUrl: "https://example.com/api/calls/transcription?callId=abc",
    dialStatusCallbackUrl: "https://example.com/api/calls/dial-status?callId=abc",
    recordingStatusUrl: "https://example.com/api/calls/recording-status",
  };

  it("never plays the disclosure on the agent leg (a top-level <Play> would announce to the rep)", async () => {
    const xml = await buildAgentTwiml({
      ...base,
      record: true,
      disclosureWhisperUrl: "https://example.com/api/calls/disclosure-whisper?u=x",
    });
    // No top-level <Play> — the disclosure must reach the PROSPECT, not the rep.
    expect(xml).not.toContain("<Play>");
    // It is whispered to the prospect via the <Number url> instead.
    expect(xml).toContain("disclosure-whisper");
    expect(xml).toContain("<Number");
  });

  it("records (record-from-answer-dual) only when record:true", async () => {
    const off = await buildAgentTwiml(base);
    expect(off).not.toContain("record-from-answer-dual");
    const on = await buildAgentTwiml({ ...base, record: true });
    expect(on).toContain("record-from-answer-dual");
  });

  it("omits the whisper url when no disclosure is supplied", async () => {
    const xml = await buildAgentTwiml({ ...base, record: true });
    expect(xml).not.toContain("disclosure-whisper");
  });
});

describe("buildDisclosureWhisperTwiml", () => {
  it("plays the disclosure and returns to <Dial> (no hangup)", async () => {
    const xml = await buildDisclosureWhisperTwiml({
      audioUrl: "https://cdn.example.com/disclosure-fr.mp3",
    });
    expect(xml).toContain("<Play>");
    expect(xml).toContain("disclosure-fr.mp3");
    expect(xml).not.toContain("<Hangup");
    expect(xml).not.toContain("<Dial");
  });
});

describe("buildVoicemailDropTwiml", () => {
  it("plays the supplied URL and hangs up", async () => {
    const xml = await buildVoicemailDropTwiml({
      audioUrl: "https://cdn.example.com/voicemail-fr.mp3",
    });
    expect(xml).toContain("<Play>");
    expect(xml).toContain("https://cdn.example.com/voicemail-fr.mp3");
    expect(xml).toContain("<Hangup");
    expect(xml).not.toContain("<Dial");
  });
});

describe("buildFallbackTwiml", () => {
  it("says an apology in French and hangs up — no dial/stream", async () => {
    const xml = await buildFallbackTwiml();
    expect(xml).toContain("<Say");
    expect(xml).toContain("<Hangup");
    expect(xml).not.toContain("<Dial");
    expect(xml).not.toContain("<Stream");
  });

  it("uses a custom message when supplied", async () => {
    const xml = await buildFallbackTwiml({ message: "Message de test ABC123" });
    expect(xml).toContain("Message de test ABC123");
  });
});
