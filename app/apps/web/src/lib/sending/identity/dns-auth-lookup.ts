/**
 * Concrete DNS lookup for the spec-21 `verifyDomainAuth` seam: resolves a sending
 * domain's SPF / DKIM / DMARC TXT records and returns the pure `DnsAuthRecords`
 * that `verifyAuth` grades. Read-only, idempotent (DNS), no external service.
 *
 * This is the piece that lets a managed CUSTOM sending domain (provider
 * `smtp_custom`) earn real sendable capacity instead of being treated as
 * unverified — the follow-up the autopilot capacity source (B2.1) left a seam for.
 * Provider-managed pools (Instantly/Gmail/Outlook) skip this; their auth is ours.
 *
 * `resolveTxt` is injected so the mapping is unit-testable without live DNS.
 */

import { promises as dnsPromises } from "dns";
import type { DnsAuthRecords } from "./auth";

export type TxtResolver = (host: string) => Promise<string[][]>;

/** DKIM selectors to probe when none is stored (mirrors api/deliverability/verify). */
export const COMMON_DKIM_SELECTORS = ["default", "google", "selector1", "selector2", "k1", "resend", "s1", "mail"];

/** Flatten node's `string[][]` TXT chunks into whole records. */
const flatten = (records: string[][]): string[] => records.map((r) => r.join(""));

/** SPF passes when a `v=spf1` record exists with an enforcing all-qualifier (`~all`/`-all`). */
export async function lookupSpf(domain: string, resolveTxt: TxtResolver): Promise<boolean> {
  try {
    const spf = flatten(await resolveTxt(domain)).find((r) => r.startsWith("v=spf1"));
    if (!spf) return false;
    // `+all`/`?all` (or a bare `v=spf1` with no all) are not enforcing → not sendable.
    if (spf.includes("+all") || spf.includes("?all")) return false;
    return spf.includes("~all") || spf.includes("-all");
  } catch {
    return false;
  }
}

/**
 * Estimate the DKIM RSA key size (bits) from the base64 `p=` public key. A 2048-bit
 * SubjectPublicKeyInfo decodes to ~270+ bytes; 1024-bit to ~160. Coarse but on the
 * SAFE side of the spec-21 ≥2048 gate (a borderline key reads as weak → not sendable).
 */
export function estimateDkimBits(p64: string): number {
  const clean = p64.replace(/\s+/g, "");
  if (!clean) return 0;
  let bytes: number;
  try {
    bytes = Buffer.from(clean, "base64").length;
  } catch {
    return 0;
  }
  if (bytes >= 520) return 4096;
  if (bytes >= 270) return 2048;
  if (bytes >= 130) return 1024;
  return 0;
}

/** DKIM: probe selectors; return pass + estimated bits from the first `v=DKIM1`/`p=` hit. */
export async function lookupDkim(
  domain: string,
  resolveTxt: TxtResolver,
  selectors: string[] = COMMON_DKIM_SELECTORS,
): Promise<{ dkimPass: boolean; dkimBits: number }> {
  for (const selector of selectors) {
    try {
      const rec = flatten(await resolveTxt(`${selector}._domainkey.${domain}`)).find(
        (r) => r.includes("v=DKIM1") || r.includes("p="),
      );
      if (!rec) continue;
      const p = rec.match(/p=([A-Za-z0-9+/=]+)/)?.[1] ?? "";
      if (!p) continue; // empty p= = revoked key
      return { dkimPass: true, dkimBits: estimateDkimBits(p) };
    } catch {
      // try next selector
    }
  }
  return { dkimPass: false, dkimBits: 0 };
}

/** DMARC passes only with an enforcing policy (`quarantine`/`reject`); `none` is monitoring-only. */
export async function lookupDmarc(domain: string, resolveTxt: TxtResolver): Promise<boolean> {
  try {
    const dmarc = flatten(await resolveTxt(`_dmarc.${domain}`)).find((r) => r.startsWith("v=DMARC1"));
    if (!dmarc) return false;
    const policy = dmarc.match(/p=(\w+)/)?.[1] ?? "none";
    return policy === "quarantine" || policy === "reject";
  } catch {
    return false;
  }
}

/**
 * The concrete lookup to hand to `verifyDomainAuth(domain, dnsAuthLookup)`. Cleans the
 * domain, runs the three checks in parallel, returns the spec-21 record shape.
 */
export async function dnsAuthLookup(
  domain: string,
  deps: { resolveTxt?: TxtResolver; selectors?: string[] } = {},
): Promise<DnsAuthRecords> {
  const resolveTxt = deps.resolveTxt ?? ((host: string) => dnsPromises.resolveTxt(host));
  const clean = domain.toLowerCase().replace(/^www\./, "").replace(/\/+$/, "").trim();
  const [spfPass, dkim, dmarcPass] = await Promise.all([
    lookupSpf(clean, resolveTxt),
    lookupDkim(clean, resolveTxt, deps.selectors),
    lookupDmarc(clean, resolveTxt),
  ]);
  return { spfPass, dmarcPass, dkimPass: dkim.dkimPass, dkimBits: dkim.dkimBits };
}
