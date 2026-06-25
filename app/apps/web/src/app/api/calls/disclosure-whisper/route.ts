/**
 * POST /api/calls/disclosure-whisper
 *
 * <Number url> whisper target for the bridged Call Mode call. Twilio fetches
 * this on the PROSPECT leg when they answer, before bridging, so the prospect
 * hears the recording disclosure (two-party consent — CH/FR). Returns a single
 * <Play> (recorded MP3) or <Say> (TTS) depending on what's configured; control
 * then returns to the parent <Dial> and the legs bridge.
 *
 * Signature is HMAC-validated. The disclosure content is read server-side from
 * env (`VOICE_DISCLOSURE_AUDIO_URL` preferred, else `VOICE_DISCLOSURE_TEXT`),
 * never from the request — a forged call can't make us announce arbitrary text.
 */

import { buildDisclosureWhisperTwiml } from "@/lib/voice/twilio";
import { validateTwilioSignature } from "@/lib/voice/twilio-signature";
import { logger } from "@/lib/observability/logger";

function xml(body: string) {
  return new Response(body, { headers: { "content-type": "text/xml" } });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const formText = await req.text();
  const params = Object.fromEntries(new URLSearchParams(formText));

  const publicBase =
    process.env.VOICE_PUBLIC_BASE_URL ??
    process.env.AUTH_URL ??
    `${url.protocol}//${url.host}`;
  const fullUrl = `${publicBase}${url.pathname}${url.search}`;

  const valid = validateTwilioSignature({
    authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    url: fullUrl,
    params,
    signature: req.headers.get("x-twilio-signature"),
  });
  if (!valid) {
    logger.warn?.("calls/disclosure-whisper: invalid signature");
    return new Response("Invalid signature", { status: 403 });
  }

  // Read the disclosure from env only — MP3 preferred, else TTS text.
  const audioUrl = process.env.VOICE_DISCLOSURE_AUDIO_URL || undefined;
  const text = process.env.VOICE_DISCLOSURE_TEXT || undefined;
  if (!audioUrl && !text) {
    // Nothing configured to announce → empty response; the <Dial> just bridges.
    // (The recording policy refuses to record in this case, so we shouldn't
    // get here while recording — defensive.)
    return xml("<Response/>");
  }

  return xml(await buildDisclosureWhisperTwiml({ audioUrl, text }));
}
