/**
 * CLE-13 — the ONE shared pre-send gate every outbound chokepoint runs before
 * transport. It composes two guardrails behind a single async adapter so the
 * orphaned `enforceSendingIdentity` core (lib/guardrails/sending-identity.ts) and
 * the opt-out/suppression check live in exactly one place:
 *
 *   1. opt-out / hard-bounce suppression  (item 3 — `isSuppressed`)
 *   2. sending-identity policy            (item 1 — `enforceSendingIdentity`)
 *
 * Wired at all five send chokepoints (C1 campaign cron, C2 single-send,
 * C3 SMTP cron, C4 interactive, C5 meeting follow-up) so the policy is identical
 * everywhere and cannot drift. The pure sending-identity core (mode/cap/cold) and
 * the suppression lookup are kept here; transport routing and the WS-6 scaling
 * prompt are deliberately NOT adopted (design §2 — the gate is allow/deny + reason
 * only; each chokepoint keeps its own transport resolution).
 *
 * Doctrine: FAIL-CLOSED. Any thrown lookup resolves toward `{ send: false }` — a
 * guardrail outage degrades to "send less", never "send more" (design §7, §8).
 */

import { db } from "@/db";
import { activities, emailOptouts } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  getTenantSettings,
  DEFAULTS,
  type TenantSettings,
} from "@/lib/config/tenant-settings";
import {
  enforceSendingIdentity,
  type SendingBlockReason,
} from "@/lib/guardrails/sending-identity";
import {
  isSuppressedDb,
  drizzleSuppressionLoader,
} from "@/lib/suppression/db-store";
import {
  loadEmailStatus,
  isEmailKnownUnsendable,
} from "@/lib/contacts/email/db-status";
import {
  loadAccountGateContext,
  type TargetingStatus,
} from "@/lib/targeting/status";
import { evaluateLawfulBasisForSend } from "@/lib/compliance/lawful-basis/db-gate";
import { guardTrippedForTenant } from "@/lib/deliverability/db-guard";
import { isRecipientAllowed } from "@/lib/emails/recipient-guardrail";
import { rateLimitTenantSendBurst, rateLimitTenantSendHourly } from "@/lib/infra/rate-limit";
import {
  consumeOutreachCapSlot,
  OUTREACH_DAILY_TENANT_CAP,
  tenantDayKey,
} from "@/lib/guardrails/outreach-cap";

/** Spec 35 — SAFE_MODE targeting gate rollout guard (default off; flipped on at
 *  T14 after the targeting backfill so no currently-allowed send breaks). */
function targetingGateEnabled(): boolean {
  return (process.env.TARGETING_GATE_ENABLED ?? "off").trim().toLowerCase() === "on";
}

/** Why the gate refused a send (or that it allows). */
export type SendingGateOutcome =
  | { send: true; reason: string }
  | {
      send: false;
      code:
        | SendingBlockReason
        | "rate_limited"
        | "opted_out"
        | "suppressed"
        | "invalid_email"
        | "lawful_basis_blocked"
        | "not_targeted"
        | "deliverability_paused"
        | "daily_cap_reached";
      reason: string;
    };

/**
 * INV-1 send classes. Only `outreach` consumes a daily cap slot: answering a
 * prospect who wrote to us is not prospecting. SECURITY: the class is derived
 * SERVER-SIDE by each chokepoint (worker rows: `inReplyTo`; interactive sends:
 * auto-classified in-gate) and a `reply` claim is ALWAYS re-verified here
 * against a real INBOUND email from the recipient — a request body can never
 * buy a cap exemption.
 */
export type SendClass = "outreach" | "reply";

/**
 * Has this tenant ever exchanged email with this address? Drives `isCold`.
 * Any prior outbound OR inbound email activity to/from the address = warm.
 * Unknown / none / lookup error -> cold (EC-6: treat unknown as cold, the
 * safest rail — blocked on the default mode).
 */
/**
 * Build the LIKE pattern that matches the RFC `Name <addr>` / `<addr>` header
 * forms for the (lowercased) address, escaping LIKE metacharacters (`_` `%`,
 * and the escape `\`) so the match is literal. Exported for unit coverage.
 */
export function emailBracketLikePattern(email: string): string {
  const e = email.toLowerCase().trim();
  return `%<${e.replace(/([\\%_])/g, "\\$1")}>%`;
}

/**
 * Has this address ever WRITTEN to the tenant? (INBOUND only — stricter than
 * `isColdRecipient`, whose outbound half would classify a second cold touch
 * as a "reply".) This is the server-side verification behind every `reply`
 * cap exemption. Matches the bare address and the RFC `Name <addr>` forms.
 */
export async function hasInboundEmailFrom(
  tenantId: string,
  email: string,
): Promise<boolean> {
  const e = email.toLowerCase().trim();
  const bracket = emailBracketLikePattern(e);
  const [row] = await db
    .select({ n: sql<number>`1` })
    .from(activities)
    .where(
      and(
        eq(activities.tenantId, tenantId),
        eq(activities.channel, "email"),
        sql`(
          lower(metadata->>'from') = ${e}
          OR lower(metadata->>'from') LIKE ${bracket}
        )`,
      ),
    )
    .limit(1);
  return !!row;
}

export async function isColdRecipient(
  tenantId: string,
  email: string,
): Promise<boolean> {
  const e = email.toLowerCase().trim();
  // Match the bare address AND the RFC `Name <addr>` / `<addr>` forms. Inbound
  // capture stores the FULL `From` header in metadata (e.g.
  // `"Paul Madelénat" <paul@x.com>`), so an exact `= e` compare missed every
  // reply recipient and wrongly marked them COLD — which then tripped the
  // cold-on-primary rail and blocked plain replies. Case-insensitive; LIKE
  // metacharacters in the address are escaped so the match is literal.
  const bracket = emailBracketLikePattern(e);
  const [row] = await db
    .select({ n: sql<number>`1` })
    .from(activities)
    .where(
      and(
        eq(activities.tenantId, tenantId),
        eq(activities.channel, "email"),
        sql`(
          lower(metadata->>'to') = ${e}
          OR lower(metadata->>'from') = ${e}
          OR lower(metadata->>'to') LIKE ${bracket}
          OR lower(metadata->>'from') LIKE ${bracket}
        )`,
      ),
    )
    .limit(1);
  return !row; // no prior activity -> cold
}

/**
 * Test-mode recipient check for INTERACTIVE / human-initiated sends (composer,
 * reply, RSVP). Allow an allowlisted OR a WARM recipient (prior correspondence —
 * e.g. the person you're replying to), block only a COLD stranger. When test mode
 * is OFF, `isRecipientAllowed` returns true so everything passes. This lets the
 * founder answer their own inbox while a campaign still can't blast cold
 * prospects (the autonomous worker keeps the strict allowlist, not this).
 */
export async function isInteractiveRecipientSendable(
  tenantId: string,
  toAddress: string,
): Promise<boolean> {
  if (isRecipientAllowed(toAddress)) return true;
  return !(await isColdRecipient(tenantId, toAddress));
}

/**
 * Opt-out + hard-bounce suppression. A single `email_optouts` lookup covers
 * BOTH unsubscribes and hard bounces (a hard bounce is persisted as an
 * `email_optouts` row with `reason: "bounce_hard"`, db/schema/outbound.ts:339),
 * so no bounce-specific query is needed (AC-3.3). Tenant-scoped.
 */
export async function isSuppressed(
  tenantId: string,
  email: string,
): Promise<boolean> {
  const e = email.toLowerCase().trim();
  const [row] = await db
    .select({ id: emailOptouts.id })
    .from(emailOptouts)
    .where(
      and(
        eq(emailOptouts.tenantId, tenantId),
        // Lower the COLUMN in-query (not an exact `eq` on the value) so a
        // non-lowercased stored opt-out — a legacy import, a manual ops insert, a
        // future writer that forgets `.toLowerCase()` — still matches. THE opt-out
        // check must be at least as robust as the sibling gates that already do
        // this (db-status.ts:32, db-gate.ts:45); a missed opt-out = mailing an
        // unsubscribed recipient, the worst compliance failure. Tenant-scoped, so
        // the eq(tenantId) still prefixes the index; the lower() compare runs over
        // that tenant's (small) opt-out set only.
        sql`lower(${emailOptouts.emailAddress}) = ${e}`,
      ),
    )
    .limit(1);
  return !!row;
}

export interface EvaluateSendArgs {
  tenantId: string;
  toAddress: string;
  /**
   * Pre-resolved coldness when the caller already knows it (a cron may compute
   * it in bulk). Omit to let the gate resolve it per call.
   */
  isCold?: boolean;
  /** Primary-mailbox sends already dispatched today; supplied by the caller
   *  from that tenant's own mailbox row (never queried globally — design §8). */
  sentTodayFromPrimary: number;
  /**
   * Pre-loaded settings for callers that already hold them (avoids a second
   * read). Optional — the gate reads them itself when omitted.
   */
  settings?: TenantSettings | null;
  // ── Spec 35 (all optional — legacy callers keep working) ──
  /** Recipient's company id; resolves account-scope suppression + targeting. */
  companyId?: string | null;
  /** Recipient's contact id; used to resolve companyId when not given. */
  contactId?: string | null;
  /** Pre-resolved targeting_status (a cron may batch-resolve it). */
  targetingStatus?: TargetingStatus;
  /** Pre-resolved account key (canonical identity_key) for account-scope suppression. */
  accountKey?: string | null;
  /** True for human-initiated sends (composer, meeting follow-up): exempt from
   *  the SAFE_MODE targeting gate (D6). NEVER exempt from suppression. */
  interactive?: boolean;
  /**
   * INV-1 send class, derived SERVER-SIDE by the chokepoint (workers:
   * `email.inReplyTo ? "reply" : "outreach"`). NEVER forward a client-supplied
   * value. Omitted: interactive sends are auto-classified in-gate; everything
   * else is `outreach`. A `reply` claim is re-verified against a real inbound
   * email before it exempts the send from the daily cap.
   */
  sendClass?: SendClass;
}

/**
 * Resolve the effective send class for cap accounting. Fail-toward-counting:
 * an unverifiable or erroring `reply` claim is treated as `outreach` (consumes
 * a slot) — the cap can only ever be tighter than intended, never looser.
 */
async function resolveOutreachClass(args: EvaluateSendArgs): Promise<SendClass> {
  const candidate: SendClass =
    args.sendClass ?? (args.interactive ? "reply" : "outreach");
  if (candidate !== "reply") return "outreach";
  try {
    return (await hasInboundEmailFrom(args.tenantId, args.toAddress))
      ? "reply"
      : "outreach";
  } catch {
    return "outreach";
  }
}

/**
 * THE pre-send gate. Opt-out first (cheap, absolute, beats every mode), then
 * the sending-identity policy with the tenant's merged settings.
 *
 * FAIL-CLOSED: any thrown lookup -> `{ send: false }`.
 *
 * NOTE on EC-1 / design §5.1: `getTenantSettings` ALWAYS returns the merged
 * `DEFAULTS` (it never returns null — lib/config/tenant-settings.ts:510-525), so
 * every real tenant gets `primary-with-caps` protection. A caller MAY still pass
 * `settings: null` explicitly; rather than fail OPEN (the original design's narrow
 * branch), the gate then evaluates against the protective `DEFAULTS`
 * (primary-with-caps, cold blocked, 20/day cap). A warm under-cap recipient still
 * sends under those defaults — the point (CLE-13 FOLLOWUPS #4) is that there is no
 * FAIL-OPEN path: an absent/unknown settings object can only make the gate send
 * LESS than the defaults would allow, never more.
 */
export async function evaluateSend(
  args: EvaluateSendArgs,
): Promise<SendingGateOutcome> {
  try {
    // P4 (volume hardening) — tenant-scoped rate limit, checked FIRST: cheapest
    // (in-memory/Upstash, no DB round-trip) and an ATTEMPT counter (hit() always
    // increments), so a buggy retry loop trips it even if every individual
    // attempt would also be blocked by a later check — it must count attempts,
    // not successful sends, to actually catch a runaway loop. A safety net, not
    // a product throttle (see lib/infra/rate-limit.ts for the numbers/reasoning).
    const burst = await rateLimitTenantSendBurst(args.tenantId);
    if (!burst.success) {
      return {
        send: false,
        code: "rate_limited",
        reason: `Tenant send rate limit hit (burst) — retry after ${new Date(burst.resetAt).toISOString()}`,
      };
    }
    const hourly = await rateLimitTenantSendHourly(args.tenantId);
    if (!hourly.success) {
      return {
        send: false,
        code: "rate_limited",
        reason: `Tenant send rate limit hit (hourly) — retry after ${new Date(hourly.resetAt).toISOString()}`,
      };
    }

    if (await isSuppressed(args.tenantId, args.toAddress)) {
      return {
        send: false,
        code: "opted_out",
        reason: "Recipient is on the opt-out list",
      };
    }

    // Spec 35 — resolve account context once (targeting_status + account key).
    // One indexed company read; fail-closed internally (unreviewed / null). Used
    // by the account-scope suppression below and the SAFE_MODE gate further down.
    const needsContext =
      args.targetingStatus === undefined || args.accountKey === undefined;
    const ctx =
      needsContext && (args.companyId || args.contactId)
        ? await loadAccountGateContext(args.tenantId, args.companyId, args.contactId)
        : { targetingStatus: args.targetingStatus ?? "unreviewed", accountKey: args.accountKey ?? null };
    const targetingStatus = args.targetingStatus ?? ctx.targetingStatus;
    const accountKey = args.accountKey ?? ctx.accountKey;

    // Spec 22 + 35 — broader suppression on top of the address-level opt-out:
    // domain-level + ACCOUNT-level (account key) + typed (competitor /
    // existing-customer / manual DNC / complaint) + global scope. Empty table =
    // no-op; any thrown query fails closed (catch).
    const supHit = await isSuppressedDb(
      { email: args.toAddress, accountKey, tenantId: args.tenantId },
      drizzleSuppressionLoader(),
    );
    if (supHit) {
      return {
        send: false,
        code: "suppressed",
        reason: `Recipient suppressed (${supHit.entry.type}, ${supHit.entry.level})`,
      };
    }

    // Spec 17 — email-verification gate. SAFE rollout: block only KNOWN-invalid
    // addresses (the contact's email_status === 'invalid'); NULL/unverified,
    // valid, risky, catch_all, unknown all pass. Blocking on NULL would halt
    // every send until the verification job runs (AC2 is the eventual state).
    // Empty/absent contact = NULL = no-op; any thrown query fails closed (catch).
    const emailStatus = await loadEmailStatus(args.tenantId, args.toAddress);
    if (isEmailKnownUnsendable(emailStatus)) {
      return {
        send: false,
        code: "invalid_email",
        reason: `Recipient email is verified ${emailStatus} (undeliverable)`,
      };
    }

    // Spec 33 — lawful-basis compliance gate. BLOCK-BY-DEFAULT BY DESIGN, so it
    // is OFF unless LAWFUL_BASIS_GATE is set: disabled = no-op (no query). Once
    // the audience is backfilled (lawful_basis / jurisdiction / source) and the
    // flag is flipped on, a contact without a valid recorded basis is blocked.
    const lawful = await evaluateLawfulBasisForSend(args.tenantId, args.toAddress);
    if (!lawful.allowed) {
      return {
        send: false,
        code: "lawful_basis_blocked",
        reason: `No valid lawful basis to send (${lawful.reason})`,
      };
    }

    // Spec 27 — deliverability guard. Block ALL of a tenant's sends (legacy +
    // V2) when its bounce/spam rate has breached threshold (auto-pause), until it
    // recovers after the cool-off. No-op when healthy / below the min sample.
    // Evaluated per call here (a monitor cron would amortize the health query).
    if (await guardTrippedForTenant(args.tenantId)) {
      return {
        send: false,
        code: "deliverability_paused",
        reason: "Sending paused — deliverability guard tripped (bounce/spam breach)",
      };
    }

    const settings =
      args.settings !== undefined
        ? args.settings
        : await getTenantSettings(args.tenantId);

    // Spec 35 — SAFE_MODE default-deny targeting gate. Runs AFTER suppression
    // (suppression overrides targeting) and only when the rollout guard is on.
    // Interactive human sends are exempt (D6); suppression already applied above.
    // safeModeEnabled defaults true (fail-closed); unresolved account =
    // 'unreviewed' = deny. Short-circuits before the cold-recipient lookup.
    if (targetingGateEnabled() && (settings?.safeModeEnabled ?? true) && !args.interactive) {
      if (targetingStatus !== "targeted") {
        return {
          send: false,
          code: "not_targeted",
          reason: `Account is ${targetingStatus}; SAFE_MODE allows only targeted accounts.`,
        };
      }
    }

    // CLE-13 FOLLOWUPS #4: a genuinely-absent settings object (caller passed
    // null) cannot tell us the mode — so fall back to the protective DEFAULTS
    // (primary-with-caps, cold blocked) rather than failing open. `?.` makes the
    // null case use every DEFAULT, so the gate has no FAIL-OPEN path (warm
    // under-cap still sends, but never more than the defaults permit).
    const mode = settings?.sendingMailboxMode ?? DEFAULTS.sendingMailboxMode;
    const cap =
      settings?.sendingDailyCapPrimary ?? DEFAULTS.sendingDailyCapPrimary;
    const allowCold =
      settings?.sendingAllowColdOnPrimary ?? DEFAULTS.sendingAllowColdOnPrimary;
    const isCold =
      args.isCold ?? (await isColdRecipient(args.tenantId, args.toAddress));

    const decision = enforceSendingIdentity({
      mode,
      isCold,
      sentTodayFromPrimary: args.sentTodayFromPrimary,
      sendingDailyCapPrimary: cap,
      sendingAllowColdOnPrimary: allowCold,
    });

    if (!decision.allowed) {
      return {
        send: false,
        code: decision.blockReason ?? "no-provider-connected",
        reason: decision.reason,
      };
    }

    // INV-1 — the tenant-wide 100/day OUTREACH cap, consumed LAST so a send
    // blocked by any check above never burns a slot. Applies to EVERY mode
    // (including external-connected, which has no per-mailbox cap). Only
    // verified replies are exempt (resolveOutreachClass). A thrown consume
    // fails closed via the outer catch.
    if ((await resolveOutreachClass(args)) === "outreach") {
      const day = tenantDayKey(settings?.timezone);
      const slot = await consumeOutreachCapSlot(args.tenantId, day);
      if (!slot.granted) {
        return {
          send: false,
          code: "daily_cap_reached",
          reason: `Tenant daily outreach cap reached (${slot.sentCount}/${OUTREACH_DAILY_TENANT_CAP}) — resets at midnight ${settings?.timezone ?? "UTC"}`,
        };
      }
    }

    return { send: true, reason: decision.reason };
  } catch (err) {
    return {
      send: false,
      code: "no-provider-connected",
      reason: `sending-gate failed closed: ${err instanceof Error ? err.message : "error"}`,
    };
  }
}
