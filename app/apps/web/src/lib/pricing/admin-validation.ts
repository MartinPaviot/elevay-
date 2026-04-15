/**
 * Validation for admin-editable quota overrides (WS-2.1).
 *
 * Lives in the web app so it can be unit-tested and so the admin Next.js
 * app can import it via the `@web/*` path alias (defined in
 * apps/admin/tsconfig.json).
 *
 * Contract (matches getLimitsForTenant's merge semantics in tiers.ts):
 *   - Unknown keys             → rejected (prevents silently broken jsonb).
 *   - null / undefined value   → accepted, stored as explicit null (inherit).
 *   - Non-negative integer     → accepted, stored as-is (0 = hard block).
 *   - Anything else            → rejected (fractional, negative, non-number).
 */

export type LimitKey = "contacts" | "emailsPerMonth" | "aiQueriesPerMonth";

export type QuotaOverrides = Partial<Record<LimitKey, number | null>>;

export const VALID_LIMIT_KEYS: readonly LimitKey[] = [
  "contacts",
  "emailsPerMonth",
  "aiQueriesPerMonth",
] as const;

export interface SanitiseResult {
  clean: QuotaOverrides;
  errors: string[];
}

export function sanitiseQuotaOverrides(input: unknown): SanitiseResult {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { clean: {}, errors: ["overrides must be an object"] };
  }
  const record = input as Record<string, unknown>;

  const clean: QuotaOverrides = {};
  const valid = new Set<string>(VALID_LIMIT_KEYS);

  for (const key of Object.keys(record)) {
    if (!valid.has(key)) {
      errors.push(`unknown override key: ${key}`);
      continue;
    }
    const typedKey = key as LimitKey;
    const v = record[key];
    if (v === null || v === undefined) {
      clean[typedKey] = null;
      continue;
    }
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
      errors.push(`${key} must be a non-negative integer or null`);
      continue;
    }
    clean[typedKey] = v;
  }

  return { clean, errors };
}
