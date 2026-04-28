/**
 * HMAC-based signed tokens for meeting recording opt-out links.
 *
 * The token prevents spoofing: an attendee can only opt out of a
 * meeting they were actually invited to. The token encodes the
 * activity ID + attendee email, signed with ELEVAY_APP_SECRET.
 *
 * Format: base64url(HMAC-SHA256(activityId + "|" + email))
 */

import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const secret = process.env.ELEVAY_APP_SECRET;
  if (!secret) {
    throw new Error("ELEVAY_APP_SECRET env var missing — required for opt-out token signing");
  }
  return secret;
}

function computeHmac(activityId: string, email: string): Buffer {
  const message = `${activityId}|${email.toLowerCase().trim()}`;
  return createHmac("sha256", getSecret()).update(message, "utf8").digest();
}

/** Generate a signed opt-out token for a specific meeting + attendee. */
export function generateOptOutToken(activityId: string, attendeeEmail: string): string {
  return computeHmac(activityId, attendeeEmail).toString("base64url");
}

/** Verify an opt-out token. Returns true if the token is valid. */
export function verifyOptOutToken(
  token: string,
  activityId: string,
  attendeeEmail: string
): boolean {
  try {
    const expected = computeHmac(activityId, attendeeEmail);
    const provided = Buffer.from(token, "base64url");

    if (expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}
