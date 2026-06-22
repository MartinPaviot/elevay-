/**
 * phone -> E.164 (spec 01, AC2). Wraps libphonenumber-js (the standard, the
 * swap-in the codebase already earmarked) to convert national / loosely-
 * formatted numbers into E.164 given a default region. Returns null when the
 * number can't be parsed/validated. Pure.
 */
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * @param raw      a phone string in any common format
 * @param region   ISO 3166-1 alpha-2 default region for national-format inputs
 *                 (e.g. "FR", "CH"); ignored when raw already has a + country code
 */
export function toE164(raw: string | null | undefined, region?: string | null): string | null {
  if (!raw) return null;
  const defaultCountry = region && /^[A-Za-z]{2}$/.test(region) ? (region.toUpperCase() as CountryCode) : undefined;
  try {
    const parsed = parsePhoneNumberFromString(raw, defaultCountry);
    if (parsed && parsed.isValid()) return parsed.number; // E.164
  } catch {
    // fall through
  }
  return null;
}
