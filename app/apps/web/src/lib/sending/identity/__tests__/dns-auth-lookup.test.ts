import { describe, it, expect } from "vitest";
import { lookupSpf, lookupDkim, lookupDmarc, estimateDkimBits, dnsAuthLookup, type TxtResolver } from "../dns-auth-lookup";
import { verifyDomainAuth } from "../auth";

/** A TXT resolver backed by a host→records map; unknown hosts reject (ENOTFOUND-like). */
function stub(records: Record<string, string[]>): TxtResolver {
  return async (host: string) => {
    if (!(host in records)) throw new Error(`ENOTFOUND ${host}`);
    return records[host].map((r) => [r]); // node returns string[][]
  };
}

// A base64 `p=` long enough to read as a 2048-bit key (≥270 decoded bytes).
const P2048 = "A".repeat(392);

describe("estimateDkimBits", () => {
  it("reads a long key as 2048-bit", () => expect(estimateDkimBits(P2048)).toBe(2048));
  it("reads a 1024-bit key", () => expect(estimateDkimBits("A".repeat(216))).toBe(1024));
  it("empty / revoked p= → 0", () => {
    expect(estimateDkimBits("")).toBe(0);
    expect(estimateDkimBits("   ")).toBe(0);
  });
  it("a very long key reads as 4096", () => expect(estimateDkimBits("A".repeat(700))).toBe(4096));
});

describe("lookupSpf", () => {
  it("enforcing ~all/-all → pass", async () => {
    expect(await lookupSpf("ex.com", stub({ "ex.com": ["v=spf1 include:x ~all"] }))).toBe(true);
    expect(await lookupSpf("ex.com", stub({ "ex.com": ["v=spf1 -all"] }))).toBe(true);
  });
  it("non-enforcing +all/?all → fail", async () => {
    expect(await lookupSpf("ex.com", stub({ "ex.com": ["v=spf1 +all"] }))).toBe(false);
    expect(await lookupSpf("ex.com", stub({ "ex.com": ["v=spf1 ?all"] }))).toBe(false);
  });
  it("missing record or DNS error → fail (not throw)", async () => {
    expect(await lookupSpf("ex.com", stub({ "ex.com": ["unrelated=1"] }))).toBe(false);
    expect(await lookupSpf("none.com", stub({}))).toBe(false);
  });
});

describe("lookupDkim", () => {
  it("finds a selector and estimates bits", async () => {
    const r = await lookupDkim("ex.com", stub({ "default._domainkey.ex.com": [`v=DKIM1; k=rsa; p=${P2048}`] }));
    expect(r).toEqual({ dkimPass: true, dkimBits: 2048 });
  });
  it("probes multiple selectors (google after default misses)", async () => {
    const r = await lookupDkim("ex.com", stub({ "google._domainkey.ex.com": [`v=DKIM1; p=${P2048}`] }));
    expect(r.dkimPass).toBe(true);
  });
  it("revoked (empty p=) → not pass", async () => {
    const r = await lookupDkim("ex.com", stub({ "default._domainkey.ex.com": ["v=DKIM1; p="] }));
    expect(r).toEqual({ dkimPass: false, dkimBits: 0 });
  });
  it("finds the Zoho `dkim` selector (regression: Elevay's cold domains publish under it)", async () => {
    const r = await lookupDkim("getelevay.com", stub({ "dkim._domainkey.getelevay.com": [`v=DKIM1; k=rsa; p=${P2048}`] }));
    expect(r).toEqual({ dkimPass: true, dkimBits: 2048 });
  });
  it("no DKIM anywhere → not pass", async () => {
    expect(await lookupDkim("ex.com", stub({}))).toEqual({ dkimPass: false, dkimBits: 0 });
  });
});

describe("lookupDmarc", () => {
  it("enforcing policy (quarantine/reject) → pass", async () => {
    expect(await lookupDmarc("ex.com", stub({ "_dmarc.ex.com": ["v=DMARC1; p=reject"] }))).toBe(true);
    expect(await lookupDmarc("ex.com", stub({ "_dmarc.ex.com": ["v=DMARC1; p=quarantine"] }))).toBe(true);
  });
  it("p=none (monitoring only) → fail", async () => {
    expect(await lookupDmarc("ex.com", stub({ "_dmarc.ex.com": ["v=DMARC1; p=none"] }))).toBe(false);
  });
  it("missing → fail", async () => {
    expect(await lookupDmarc("ex.com", stub({}))).toBe(false);
  });
});

describe("dnsAuthLookup + verifyDomainAuth (end to end, stubbed DNS)", () => {
  const fullyAuthed = {
    "send.ex.com": ["v=spf1 include:_spf.google.com -all"],
    "default._domainkey.send.ex.com": [`v=DKIM1; k=rsa; p=${P2048}`],
    "_dmarc.send.ex.com": ["v=DMARC1; p=quarantine"],
  };

  it("a fully-authenticated domain is sendable", async () => {
    const status = await verifyDomainAuth("send.ex.com", (d) => dnsAuthLookup(d, { resolveTxt: stub(fullyAuthed) }));
    expect(status).toMatchObject({ spf: true, dkim: true, dmarc: true, sendable: true, failures: [] });
  });

  it("a weak (1024-bit) DKIM key blocks sending", async () => {
    const weak = { ...fullyAuthed, "default._domainkey.send.ex.com": [`v=DKIM1; p=${"A".repeat(216)}`] };
    const status = await verifyDomainAuth("send.ex.com", (d) => dnsAuthLookup(d, { resolveTxt: stub(weak) }));
    expect(status.sendable).toBe(false);
    expect(status.failures).toContain("dkim-weak:1024bit");
  });

  it("missing DMARC blocks sending and is reported", async () => {
    const noDmarc = { "send.ex.com": fullyAuthed["send.ex.com"], "default._domainkey.send.ex.com": fullyAuthed["default._domainkey.send.ex.com"] };
    const status = await verifyDomainAuth("send.ex.com", (d) => dnsAuthLookup(d, { resolveTxt: stub(noDmarc) }));
    expect(status.sendable).toBe(false);
    expect(status.failures).toContain("dmarc");
  });

  it("normalises www. and trailing slash before lookup", async () => {
    const status = await verifyDomainAuth("WWW.send.ex.com/", (d) => dnsAuthLookup(d, { resolveTxt: stub(fullyAuthed) }));
    expect(status.sendable).toBe(true);
  });
});
