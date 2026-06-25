import { describe, it, expect } from "vitest";
import { resolveCallRecording } from "@/lib/voice/recording-policy";

/**
 * The recording decision matrix. Pass deploymentEnabled/disclosureUrl
 * explicitly so the tests never depend on the ambient env.
 */

const FR = "+33612345678"; // two-party consent (CH/FR francophone wedge)
const US_NY = "+12125551234"; // New York area code 212 — one-party consent

describe("resolveCallRecording", () => {
  it("does not record when the deployment kill-switch is off", () => {
    const d = resolveCallRecording({
      toNumber: US_NY,
      workspaceEnabled: true,
      deploymentEnabled: false,
      disclosureUrl: "https://cdn/disclosure.mp3",
    });
    expect(d.record).toBe(false);
    expect(d.reason).toBe("deployment_disabled");
    expect(d.consent).toBe("n_a");
  });

  it("does not record when the workspace toggle is off", () => {
    const d = resolveCallRecording({
      toNumber: US_NY,
      workspaceEnabled: false,
      deploymentEnabled: true,
      disclosureUrl: "https://cdn/disclosure.mp3",
    });
    expect(d.record).toBe(false);
    expect(d.reason).toBe("workspace_disabled");
  });

  it("records a one-party-consent number with no disclosure, consent n_a", () => {
    const d = resolveCallRecording({
      toNumber: US_NY,
      workspaceEnabled: true,
      deploymentEnabled: true,
      disclosureUrl: null,
      disclosureText: null,
    });
    expect(d.record).toBe(true);
    expect(d.requiresDisclosure).toBe(false);
    expect(d.disclosureUrl).toBeUndefined();
    expect(d.consent).toBe("n_a");
    expect(d.reason).toBe("recorded");
  });

  it("refuses to record a consent region with NEITHER mp3 nor text (never silently)", () => {
    const d = resolveCallRecording({
      toNumber: FR,
      workspaceEnabled: true,
      deploymentEnabled: true,
      disclosureUrl: null,
      disclosureText: null,
    });
    expect(d.record).toBe(false);
    expect(d.reason).toBe("disclosure_missing");
    expect(d.requiresDisclosure).toBe(false);
    expect(d.consent).toBe("n_a");
  });

  it("records a consent region with an MP3 disclosure, consent given", () => {
    const d = resolveCallRecording({
      toNumber: FR,
      workspaceEnabled: true,
      deploymentEnabled: true,
      disclosureUrl: "https://cdn/disclosure-fr.mp3",
      disclosureText: null,
    });
    expect(d.record).toBe(true);
    expect(d.requiresDisclosure).toBe(true);
    expect(d.disclosureUrl).toBe("https://cdn/disclosure-fr.mp3");
    expect(d.consent).toBe("given");
    expect(d.reason).toBe("recorded");
  });

  it("records a consent region with only a TTS text disclosure (no MP3 needed)", () => {
    const d = resolveCallRecording({
      toNumber: FR,
      workspaceEnabled: true,
      deploymentEnabled: true,
      disclosureUrl: null,
      disclosureText: "Cet appel est enregistré.",
    });
    expect(d.record).toBe(true);
    expect(d.requiresDisclosure).toBe(true);
    expect(d.disclosureUrl).toBeUndefined();
    expect(d.disclosureText).toBe("Cet appel est enregistré.");
    expect(d.consent).toBe("given");
  });

  it("reads VOICE_RECORDING_ENABLED / VOICE_DISCLOSURE_AUDIO_URL from env when not overridden", () => {
    const prevEnabled = process.env.VOICE_RECORDING_ENABLED;
    const prevDisc = process.env.VOICE_DISCLOSURE_AUDIO_URL;
    try {
      process.env.VOICE_RECORDING_ENABLED = "true";
      process.env.VOICE_DISCLOSURE_AUDIO_URL = "https://cdn/env-disclosure.mp3";
      const d = resolveCallRecording({ toNumber: FR, workspaceEnabled: true });
      expect(d.record).toBe(true);
      expect(d.disclosureUrl).toBe("https://cdn/env-disclosure.mp3");
    } finally {
      if (prevEnabled === undefined) delete process.env.VOICE_RECORDING_ENABLED;
      else process.env.VOICE_RECORDING_ENABLED = prevEnabled;
      if (prevDisc === undefined) delete process.env.VOICE_DISCLOSURE_AUDIO_URL;
      else process.env.VOICE_DISCLOSURE_AUDIO_URL = prevDisc;
    }
  });
});
