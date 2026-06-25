/**
 * Spec 37 (B2.1) — warmup-aware sendable capacity for a tenant's MANAGED sending
 * pool. Elevay operates the sending infrastructure (Instantly mailboxes) ON BEHALF
 * of the client — the client never connects its own account, so auth is provider-
 * managed, not the tenant's DNS problem.
 *
 * This reads `connected_mailboxes`, maps each row to the pure `SendingMailbox`
 * shape, resolves auth (provider-managed by default), and DELEGATES the ramp/cap
 * math to `getSendableCapacity` (capacity.ts) — no warmup/cap math re-implemented.
 *
 * Blast radius: lib/autopilot/* only.
 */

import { db as defaultDb } from "@/db";
import { connectedMailboxes } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import {
  getSendableCapacity,
  type SendingMailbox,
  type CapacityReport,
} from "@/lib/sending/identity/capacity";
import { verifyDomainAuth, type AuthStatus, type DnsAuthRecords } from "@/lib/sending/identity/auth";
import { dnsAuthLookup } from "@/lib/sending/identity/dns-auth-lookup";

/**
 * Providers whose authentication (SPF/DKIM/DMARC or OAuth) is managed for us, so a
 * mailbox on them is sendable without a per-domain DNS proof: Instantly (Elevay's
 * managed pool), Gmail/Google + Outlook/Microsoft (OAuth-authenticated). A
 * self-managed `smtp_custom` domain is NOT trusted until DNS-verified (follow-up).
 */
export const MANAGED_AUTH_PROVIDERS = new Set(["instantly", "gmail", "google", "outlook", "microsoft"]);

/** Mailbox statuses that can still send (warming ramps, active is full). */
const SENDABLE_STATUSES = ["warming_up", "active"] as const;

/**
 * Default auth resolution for the managed infrastructure: a provider-managed domain
 * is sendable; everything else is treated as unverified (not sendable). The real DNS
 * proof for self-managed domains now lives in `dnsAwareAuthResolver` below, opt-in via
 * `MANAGED_DOMAIN_DNS_VERIFY` — this stays the conservative default.
 */
export function managedAuthByDomain(mailboxes: { domain: string; provider: string }[]): Map<string, AuthStatus> {
  const map = new Map<string, AuthStatus>();
  for (const mb of mailboxes) {
    if (map.has(mb.domain)) continue;
    const sendable = MANAGED_AUTH_PROVIDERS.has(mb.provider.toLowerCase());
    map.set(mb.domain, {
      domain: mb.domain,
      spf: sendable,
      dkim: sendable,
      dmarc: sendable,
      sendable,
      failures: sendable ? [] : ["unverified-self-managed-domain"],
    });
  }
  return map;
}

type DomainAuthInput = { domain: string; provider: string }[];
type AuthResolver = (mailboxes: DomainAuthInput) => Map<string, AuthStatus> | Promise<Map<string, AuthStatus>>;

/**
 * DNS-aware resolver: provider-managed domains stay sendable (their auth is ours);
 * a self-managed `smtp_custom` domain earns sendable ONLY if it passes a real
 * SPF/DKIM/DMARC DNS check (spec-21 `verifyDomainAuth`). This is the follow-up the
 * default `managedAuthByDomain` left open — gated behind `MANAGED_DOMAIN_DNS_VERIFY`
 * so the default behaviour (custom = not sendable) is unchanged until opted in.
 */
export async function dnsAwareAuthResolver(
  mailboxes: DomainAuthInput,
  lookup: (domain: string) => Promise<DnsAuthRecords> = dnsAuthLookup,
): Promise<Map<string, AuthStatus>> {
  const map = new Map<string, AuthStatus>();
  for (const mb of mailboxes) {
    if (map.has(mb.domain)) continue;
    if (MANAGED_AUTH_PROVIDERS.has(mb.provider.toLowerCase())) {
      map.set(mb.domain, { domain: mb.domain, spf: true, dkim: true, dmarc: true, sendable: true, failures: [] });
      continue;
    }
    // Self-managed domain → real DNS proof. Failures here keep it NOT sendable.
    try {
      map.set(mb.domain, await verifyDomainAuth(mb.domain, (d) => lookup(d)));
    } catch {
      map.set(mb.domain, { domain: mb.domain, spf: false, dkim: false, dmarc: false, sendable: false, failures: ["dns-lookup-failed"] });
    }
  }
  return map;
}

function isDnsVerifyEnabled(): boolean {
  const v = process.env.MANAGED_DOMAIN_DNS_VERIFY;
  return v === "1" || v === "true";
}

export interface CapacitySourceDeps {
  database?: typeof defaultDb;
  /** Override auth resolution (e.g. a real DNS-verify pass). Defaults to provider-managed,
   *  or the DNS-aware resolver when MANAGED_DOMAIN_DNS_VERIFY is on. May be async. */
  resolveAuth?: AuthResolver;
}

/** B2.1 — the tenant's warmup-aware sendable capacity today, over its managed pool. */
export async function loadTenantCapacity(tenantId: string, deps: CapacitySourceDeps = {}): Promise<CapacityReport> {
  const database = deps.database ?? defaultDb;
  const resolveAuth: AuthResolver = deps.resolveAuth ?? (isDnsVerifyEnabled() ? dnsAwareAuthResolver : managedAuthByDomain);

  const rows = await database
    .select({
      id: connectedMailboxes.id,
      domain: connectedMailboxes.domain,
      provider: connectedMailboxes.provider,
      dailyLimit: connectedMailboxes.dailyLimit,
      warmupStartedAt: connectedMailboxes.warmupStartedAt,
      sentToday: connectedMailboxes.sentToday,
    })
    .from(connectedMailboxes)
    .where(and(eq(connectedMailboxes.tenantId, tenantId), inArray(connectedMailboxes.status, [...SENDABLE_STATUSES])));

  const mailboxes: SendingMailbox[] = rows.map((r) => ({
    id: r.id,
    domain: r.domain,
    provider: r.provider,
    dailyCap: r.dailyLimit ?? 50,
    warmupStartedAt: r.warmupStartedAt ?? null,
    sentToday: r.sentToday ?? 0,
  }));

  return getSendableCapacity(mailboxes, await resolveAuth(mailboxes));
}
