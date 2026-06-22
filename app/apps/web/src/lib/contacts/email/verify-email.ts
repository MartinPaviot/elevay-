/**
 * Spec 17 — email verification waterfall (contact scope). Deliverability starts
 * here: a contact gets a verified business email and a deliverability status
 * BEFORE any send. The FIND half reuses an injected candidate finder (the
 * existing contact-enrichment waterfall / spec-08 `enrichField` at contact
 * scope — not re-implemented here, AC5); this module is the VERIFY half:
 * syntax → domain → mailbox → catch-all → spam-trap, mapped to one of
 * valid / risky / invalid / catch_all / unknown, cached + metered (AC4).
 *
 * Distinct from the coarse `EmailStatus` (verified|likely|unverified) in
 * lib/providers/contact-enrichment: that is a provider self-report and feeds in
 * as a signal; the status here is the authoritative deliverability gate.
 *
 * Blast radius: contacts/email/* only. Pure/deterministic given its injected
 * deps; no provider SDK imported.
 */

/** The 5 deliverability statuses (AC1). */
export type EmailVerificationStatus = "valid" | "risky" | "invalid" | "catch_all" | "unknown";

/** Short refresh cycle — email deliverability decays; re-verify weekly (AC4). */
export const EMAIL_VERIFY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CandidateEmail {
  email: string;
  provider: string;
  /** Finder confidence 0..1 — drives the verify order. */
  confidence: number;
}

/** Multi-step verification signal from a provider (any subset may be present). */
export interface VerifySignal {
  /** MX / domain resolves. */
  domainOk?: boolean;
  /** SMTP mailbox accepts mail. */
  mailboxOk?: boolean;
  /** Accept-all domain — mailbox cannot be individually confirmed. */
  catchAll?: boolean;
  /** Known spam trap / honeypot — never send. */
  spamTrap?: boolean;
  /** Disposable/throwaway domain. */
  disposable?: boolean;
  /** Role address (info@, contact@, sales@). */
  roleBased?: boolean;
  /** Provider confidence 0..1. */
  confidence?: number;
}

export interface VerifyProvider {
  name: string;
  /** Credits per verification — metered (AC4). */
  cost: number;
  verify(email: string): Promise<VerifySignal | null>;
}

export interface EmailVerification {
  email: string;
  status: EmailVerificationStatus;
  /** AC4 provenance. */
  provider: string | null;
  checkedAt: Date;
  ttlExpiresAt: Date;
  signal?: VerifySignal;
}

export interface VerifyCache {
  /** Key: (provider, contactId, email). */
  get(key: string): Promise<EmailVerification | null>;
  set(key: string, value: EmailVerification): Promise<void>;
}

export interface MeterOp {
  workspace: string;
  kind: string;
  provider: string;
  amount: number;
  ref: string;
}

export interface VerifyEmailDeps {
  tenantId: string;
  provider: VerifyProvider;
  /** spec-02 meter — wraps the provider call for cost accounting (AC4). */
  meter: <R>(op: MeterOp, fn: () => Promise<R>) => Promise<R>;
  cache?: VerifyCache;
  /** AC4 — short-circuit before spending when the budget is exhausted. */
  budgetOk?: () => Promise<boolean>;
  ttlMs?: number;
  now?: () => number;
}

/** Pragmatic RFC-5322-ish single-address syntax check. Deterministic, free. */
export function isSyntaxValid(email: string): boolean {
  const e = email.trim();
  if (e.length === 0 || e.length > 254) return false;
  // one @, non-empty local + domain, domain has a dot, no spaces/consecutive dots.
  return /^[^\s@"']+(?:\.[^\s@"']+)*@[^\s@.]+(?:\.[^\s@.]+)+$/.test(e) && !e.includes("..");
}

/** Map a provider signal to a deliverability status. Order matters: hard-fails first. */
export function statusFromSignal(signal: VerifySignal): EmailVerificationStatus {
  if (signal.spamTrap) return "invalid"; // never send to a trap
  if (signal.domainOk === false) return "invalid";
  if (signal.mailboxOk === false) return "invalid";
  if (signal.disposable) return "risky";
  if (signal.catchAll) return "catch_all"; // accept-all: mailbox unconfirmable
  if (signal.mailboxOk === true) {
    // Deliverable, but role addresses / low confidence are risky, not clean-valid.
    if (signal.roleBased) return "risky";
    if (typeof signal.confidence === "number" && signal.confidence < 0.7) return "risky";
    return "valid";
  }
  return "unknown"; // provider gave nothing conclusive
}

const key = (provider: string, contactId: string, email: string) =>
  `${provider}:${contactId}:${email.trim().toLowerCase()}`;

/**
 * Verify one email for a contact. Syntax fails free; otherwise cache-first, then
 * a single metered provider call mapped to a status, cached with a short TTL.
 */
export async function verifyEmail(contactId: string, email: string, deps: VerifyEmailDeps): Promise<EmailVerification> {
  const now = deps.now ?? (() => Date.now());
  const ttl = deps.ttlMs ?? EMAIL_VERIFY_TTL_MS;
  const stamp = (status: EmailVerificationStatus, provider: string | null, signal?: VerifySignal): EmailVerification => ({
    email, status, provider, checkedAt: new Date(now()), ttlExpiresAt: new Date(now() + ttl), signal,
  });

  // AC1 — syntax is deterministic and free; a malformed address never spends.
  if (!isSyntaxValid(email)) return stamp("invalid", null);

  const cacheKey = key(deps.provider.name, contactId, email);
  if (deps.cache) {
    const hit = await deps.cache.get(cacheKey);
    if (hit && hit.ttlExpiresAt.getTime() > now()) return hit; // fresh cache, no spend
  }

  // AC4 — do not spend past the budget; "unknown" so the caller retries later.
  if (deps.budgetOk && !(await deps.budgetOk())) return stamp("unknown", null);

  let signal: VerifySignal | null;
  try {
    signal = await deps.meter(
      { workspace: deps.tenantId, kind: "verify.email", provider: deps.provider.name, amount: deps.provider.cost, ref: cacheKey },
      () => deps.provider.verify(email),
    );
  } catch {
    return stamp("unknown", deps.provider.name); // transient provider error — not a verdict
  }

  const result = signal ? stamp(statusFromSignal(signal), deps.provider.name, signal) : stamp("unknown", deps.provider.name);
  if (deps.cache) await deps.cache.set(cacheKey, result);
  return result;
}

/** Status preference when several candidates are verified: best deliverable first. */
const STATUS_RANK: Record<EmailVerificationStatus, number> = { valid: 4, catch_all: 3, risky: 2, unknown: 1, invalid: 0 };

export interface FindAndVerifyDeps extends VerifyEmailDeps {
  /** AC5 — reuse an existing finder (contact-enrichment waterfall / spec-08). */
  findCandidateEmails: (contactId: string) => Promise<CandidateEmail[]>;
}

/**
 * Find candidate emails (injected finder) and verify them in confidence order,
 * stopping at the first `valid`. Returns the best verification by status rank,
 * or an `unknown`/null-email result when nothing is found.
 */
export async function findAndVerifyEmail(contactId: string, deps: FindAndVerifyDeps): Promise<EmailVerification> {
  const now = deps.now ?? (() => Date.now());
  const candidates = [...(await deps.findCandidateEmails(contactId))].sort((a, b) => b.confidence - a.confidence);
  if (candidates.length === 0) {
    return { email: "", status: "unknown", provider: null, checkedAt: new Date(now()), ttlExpiresAt: new Date(now()), signal: undefined };
  }

  let best: EmailVerification | null = null;
  for (const c of candidates) {
    const v = await verifyEmail(contactId, c.email, deps);
    if (v.status === "valid") return v; // short-circuit on a clean hit
    if (!best || STATUS_RANK[v.status] > STATUS_RANK[best.status]) best = v;
  }
  return best!;
}
