/**
 * Call-recording policy — the single source of truth for "should THIS call
 * capture audio, and may it legally do so".
 *
 * Recording is gated on three independent conditions, ALL of which must hold:
 *   1. Deployment opt-in — `VOICE_RECORDING_ENABLED === "true"`. The
 *      compliance kill-switch (policies 07/10/11). Off by default.
 *   2. Workspace opt-in — `tenants.settings.callRecordingEnabled === true`.
 *      The toggle the rep flips in Call Mode. Off by default.
 *   3. Lawful capture — in a two-party-consent region (CH/FR/CA + all-party
 *      US states) we may only record if an audible disclosure is configured:
 *      either a recorded MP3 (`VOICE_DISCLOSURE_AUDIO_URL`) or a TTS text
 *      (`VOICE_DISCLOSURE_TEXT`, spoken by Twilio `<Say>`). Recording without
 *      one is unlawful — in Switzerland criminal (Penal Code art. 179bis) — so
 *      we refuse rather than capture silently.
 *
 * Both the call-start route and the TwiML webhooks resolve recording through
 * this one function so the browser indicator, the consent stamp and the actual
 * <Dial record> can never disagree.
 */

import { requiresTwoPartyConsent } from "./number-selector";

export type CallRecordingReason =
  /** Recording will happen. */
  | "recorded"
  /** `VOICE_RECORDING_ENABLED` is not "true". */
  | "deployment_disabled"
  /** Workspace toggle (`callRecordingEnabled`) is off. */
  | "workspace_disabled"
  /** Consent region but no `VOICE_DISCLOSURE_AUDIO_URL` — can't record lawfully. */
  | "disclosure_missing";

export interface CallRecordingDecision {
  /** Whether Twilio should capture audio for this call. */
  record: boolean;
  /**
   * True when an audible disclosure must precede capture (recording in a
   * two-party-consent region). The agent path attaches the <Number> whisper;
   * the server path plays it inline. The disclosure renders as the MP3 when
   * one is configured, else as TTS of the text.
   */
  requiresDisclosure: boolean;
  /**
   * Disclosure MP3 to <Play> before the prospect leg connects. Set only when
   * recording AND the prospect is in a two-party-consent region AND an MP3 is
   * configured (else the TTS text below is used).
   */
  disclosureUrl?: string;
  /** TTS disclosure text spoken via Twilio <Say> when no MP3 is configured.
   *  Set only when recording in a consent region. */
  disclosureText?: string;
  /** Value to stamp on `calls.recordingConsent`: "given" once a disclosure
   *  will play in a consent region, "n_a" otherwise. */
  consent: "given" | "n_a";
  /** Machine-readable outcome — drives logs and the UI affordance copy. */
  reason: CallRecordingReason;
}

export interface ResolveCallRecordingInput {
  /** Prospect E.164 — decides whether two-party consent applies. */
  toNumber: string;
  /** `tenants.settings.callRecordingEnabled`. */
  workspaceEnabled: boolean;
  /** Override for `VOICE_RECORDING_ENABLED === "true"` (defaults to the env). */
  deploymentEnabled?: boolean;
  /** Override for `VOICE_DISCLOSURE_AUDIO_URL` (defaults to the env). */
  disclosureUrl?: string | null;
  /** Override for `VOICE_DISCLOSURE_TEXT` (defaults to the env). */
  disclosureText?: string | null;
}

export function resolveCallRecording(
  input: ResolveCallRecordingInput,
): CallRecordingDecision {
  const deploymentEnabled =
    input.deploymentEnabled ?? process.env.VOICE_RECORDING_ENABLED === "true";
  if (!deploymentEnabled) {
    return { record: false, requiresDisclosure: false, consent: "n_a", reason: "deployment_disabled" };
  }
  if (!input.workspaceEnabled) {
    return { record: false, requiresDisclosure: false, consent: "n_a", reason: "workspace_disabled" };
  }

  const requiresConsent = requiresTwoPartyConsent(input.toNumber);
  const disclosureUrl =
    (input.disclosureUrl ?? process.env.VOICE_DISCLOSURE_AUDIO_URL) || null;
  const disclosureText =
    (input.disclosureText ?? process.env.VOICE_DISCLOSURE_TEXT) || null;

  if (requiresConsent && !disclosureUrl && !disclosureText) {
    // No lawful path to record here — refuse rather than capture silently.
    return { record: false, requiresDisclosure: false, consent: "n_a", reason: "disclosure_missing" };
  }

  return {
    record: true,
    requiresDisclosure: requiresConsent,
    disclosureUrl: requiresConsent ? disclosureUrl ?? undefined : undefined,
    disclosureText: requiresConsent ? disclosureText ?? undefined : undefined,
    consent: requiresConsent ? "given" : "n_a",
    reason: "recorded",
  };
}
