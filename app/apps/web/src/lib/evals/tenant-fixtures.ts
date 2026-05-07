/**
 * Multi-tenant eval fixture overlay (P0-4 follow-up).
 *
 * Static suite fixtures live in code (e.g.
 * `transcript-coaching-grounded.eval.ts`) and reflect a generic
 * sales-call shape. Tenants in regulated verticals (healthtech,
 * fintech) often have eval-worthy edge cases the generic fixtures
 * can't capture without leaking sensitive transcripts into the
 * codebase. This module lets a tenant supply their own fixtures
 * via `tenants.settings.eval_fixtures.<surfaceId>` — keeping the
 * sensitive content scoped to that tenant's row.
 *
 * Pure : the helper takes settings + a predicate ; tests pin every
 * branch without touching tenants table.
 *
 * Storage shape :
 * ```
 * tenants.settings.eval_fixtures = {
 *   "transcript-coaching-grounded": [
 *     {
 *       id: "hipaa-budget-question",
 *       description: "HIPAA-flavored budget objection",
 *       payload: { question: "...", chunks: [...], expectsRefusal: false }
 *     },
 *     ...
 *   ],
 *   "deal-briefing": [...]
 * }
 * ```
 *
 * Each `payload` is opaque here ; the suite owns the shape and
 * validates via the predicate it passes in.
 */

export interface TenantFixture<TPayload = unknown> {
  id: string;
  description?: string;
  payload: TPayload;
}

export interface FixtureValidationResult<TPayload> {
  valid: TenantFixture<TPayload>[];
  /** Per-fixture rejection reason. Surfaces in logs so the tenant
   *  can fix their settings without guessing. */
  invalid: Array<{ id: string; reason: string }>;
}

/**
 * Read raw fixtures for a surface from tenant settings. Returns
 * `[]` when the key is absent, the surface bucket is missing, or
 * the value isn't an array. Defensive — never throws.
 */
export function readTenantFixtures(
  settings: Record<string, unknown> | null | undefined,
  surfaceId: string,
): TenantFixture[] {
  if (!settings || typeof settings !== "object") return [];
  const root = (settings as Record<string, unknown>).eval_fixtures;
  if (!root || typeof root !== "object" || Array.isArray(root)) return [];
  const bucket = (root as Record<string, unknown>)[surfaceId];
  if (!Array.isArray(bucket)) return [];

  const out: TenantFixture[] = [];
  const seenIds = new Set<string>();
  for (const item of bucket) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const obj = item as Record<string, unknown>;
    const id = obj.id;
    if (typeof id !== "string" || id.length === 0) continue;
    // Dedupe by id — first wins. Tenants who copy-paste fixtures
    // sometimes leave duplicate ids, and we don't want the eval
    // dashboard to show two "hipaa-budget" rows.
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    if (!("payload" in obj)) continue;
    out.push({
      id,
      description:
        typeof obj.description === "string" ? obj.description : undefined,
      payload: obj.payload,
    });
  }
  return out;
}

/**
 * Validate fixtures via a caller-provided predicate. Each predicate
 * returns either true (valid) or a string reason (invalid). Returns
 * separated valid + invalid lists so the caller can log the
 * rejections without dropping the eval entirely.
 */
export function validateTenantFixtures<TPayload>(
  fixtures: ReadonlyArray<TenantFixture>,
  validator: (payload: unknown) => true | string,
): FixtureValidationResult<TPayload> {
  const valid: TenantFixture<TPayload>[] = [];
  const invalid: Array<{ id: string; reason: string }> = [];
  for (const f of fixtures) {
    const verdict = validator(f.payload);
    if (verdict === true) {
      valid.push({
        id: f.id,
        description: f.description,
        payload: f.payload as TPayload,
      });
    } else {
      invalid.push({ id: f.id, reason: verdict });
    }
  }
  return { valid, invalid };
}

/**
 * Compose tenant fixtures into a static fixture list. Tenant
 * fixtures get a `tenant:` id prefix so the eval-runs dashboard
 * can group them visually and so they can't collide with static
 * fixture ids.
 *
 * Order : static first (stable baseline), tenant after. This means
 * a regression in the static cases surfaces at the top of the
 * dashboard ; tenant-specific failures sit below.
 */
export function composeFixtures<TStatic, TPayload>(args: {
  staticFixtures: ReadonlyArray<TStatic & { id: string }>;
  tenantFixtures: ReadonlyArray<TenantFixture<TPayload>>;
  buildTenantFixture: (
    fixture: TenantFixture<TPayload>,
  ) => TStatic & { id: string };
}): Array<TStatic & { id: string }> {
  const out: Array<TStatic & { id: string }> = [...args.staticFixtures];
  for (const f of args.tenantFixtures) {
    const built = args.buildTenantFixture(f);
    out.push({
      ...built,
      id: `tenant:${f.id}`,
    });
  }
  return out;
}
