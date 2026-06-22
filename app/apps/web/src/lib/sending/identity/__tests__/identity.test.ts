import { describe, it, expect } from "vitest";
import {
  verifyAuth,
  verifyDomainAuth,
  registerIdentity,
  effectiveDailyCap,
  isWarming,
  getSendableCapacity,
  MIN_DKIM_BITS,
  type AuthStatus,
  type SendingMailbox,
  type DnsAuthRecords,
} from "../index";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

const pass: DnsAuthRecords = { spfPass: true, dmarcPass: true, dkimPass: true, dkimBits: 2048 };

const mb = (over: Partial<SendingMailbox>): SendingMailbox => ({
  id: over.id ?? "m1",
  domain: over.domain ?? "acme.com",
  provider: over.provider ?? "google",
  dailyCap: over.dailyCap ?? 50,
  warmupStartedAt: over.warmupStartedAt ?? null,
  sentToday: over.sentToday ?? 0,
  ...over,
});

describe("verifyAuth — AC2 SPF/DKIM(2048)/DMARC gate", () => {
  it("all three pass with a 2048-bit DKIM → sendable", () => {
    expect(verifyAuth("acme.com", pass)).toMatchObject({ sendable: true, spf: true, dkim: true, dmarc: true, failures: [] });
  });
  it("a sub-2048-bit DKIM is not sendable", () => {
    const r = verifyAuth("acme.com", { ...pass, dkimBits: 1024 });
    expect(r.dkim).toBe(false);
    expect(r.sendable).toBe(false);
    expect(r.failures.some((f) => f.startsWith("dkim-weak"))).toBe(true);
  });
  it("any failing record blocks sendability", () => {
    expect(verifyAuth("a", { ...pass, spfPass: false }).sendable).toBe(false);
    expect(verifyAuth("a", { ...pass, dmarcPass: false }).sendable).toBe(false);
    expect(verifyAuth("a", { ...pass, dkimPass: false }).failures).toContain("dkim");
  });
  it("MIN_DKIM_BITS is 2048", () => {
    expect(MIN_DKIM_BITS).toBe(2048);
  });
  it("verifyDomainAuth resolves via an injected lookup", async () => {
    const r = await verifyDomainAuth("acme.com", async () => pass);
    expect(r.sendable).toBe(true);
  });
});

describe("registerIdentity — AC1 2–3 mailboxes per domain", () => {
  it("2 or 3 mailboxes is within target", () => {
    expect(registerIdentity("acme.com", [mb({ id: "a" }), mb({ id: "b" })]).withinTarget).toBe(true);
    expect(registerIdentity("acme.com", [mb({ id: "a" }), mb({ id: "b" }), mb({ id: "c" })]).withinTarget).toBe(true);
  });
  it("1 mailbox is below target, 4 is above, both warned", () => {
    expect(registerIdentity("acme.com", [mb({ id: "a" })]).warnings[0]).toContain("below-target");
    const four = registerIdentity("acme.com", [mb({ id: "a" }), mb({ id: "b" }), mb({ id: "c" }), mb({ id: "d" })]);
    expect(four.withinTarget).toBe(false);
    expect(four.warnings[0]).toContain("above-target");
  });
  it("only counts mailboxes on the named domain", () => {
    const reg = registerIdentity("acme.com", [mb({ id: "a" }), mb({ id: "x", domain: "other.com" })]);
    expect(reg.mailboxes).toHaveLength(1);
  });
});

describe("effectiveDailyCap / isWarming — AC3/AC4 ramp", () => {
  it("a non-warming mailbox uses its steady cap", () => {
    const m = mb({ warmupStartedAt: null, dailyCap: 50 });
    expect(isWarming(m)).toBe(false);
    expect(effectiveDailyCap(m)).toBe(50);
  });
  it("a day-0 warmup starts low (2/day)", () => {
    const m = mb({ warmupStartedAt: daysAgo(0), dailyCap: 50 });
    expect(isWarming(m)).toBe(true);
    expect(effectiveDailyCap(m)).toBe(2);
  });
  it("the warmup ramp rises over the window", () => {
    expect(effectiveDailyCap(mb({ warmupStartedAt: daysAgo(4) }))).toBe(10); // day index 4 → 10
    expect(effectiveDailyCap(mb({ warmupStartedAt: daysAgo(13) }))).toBe(30);
  });
  it("never exceeds the steady cap during warmup", () => {
    expect(effectiveDailyCap(mb({ warmupStartedAt: daysAgo(13), dailyCap: 20 }))).toBe(20); // ramp 30 capped at 20
  });
  it("after the window the mailbox is warmed and uses its steady cap", () => {
    const m = mb({ warmupStartedAt: daysAgo(40), dailyCap: 50 });
    expect(isWarming(m)).toBe(false);
    expect(effectiveDailyCap(m)).toBe(50);
  });
});

describe("getSendableCapacity — AC1/AC4/AC5", () => {
  const authSendable = new Map<string, AuthStatus>([["acme.com", verifyAuth("acme.com", pass)]]);

  it("an unauthenticated domain reports 0 capacity (never sends)", () => {
    const rep = getSendableCapacity([mb({ domain: "noauth.com", dailyCap: 50 })], new Map());
    expect(rep.byMailbox[0].available).toBe(0);
    expect(rep.byMailbox[0].authSendable).toBe(false);
    expect(rep.totalAvailable).toBe(0);
  });

  it("available = effectiveCap - sentToday for an authenticated mailbox", () => {
    const rep = getSendableCapacity([mb({ domain: "acme.com", dailyCap: 50, sentToday: 12 })], authSendable);
    expect(rep.byMailbox[0].available).toBe(38);
  });

  it("AC4: warmup volume counts inside the ceiling", () => {
    // day-4 warmup cap = 10; already sent 7 (warmup volume) → 3 left.
    const rep = getSendableCapacity([mb({ domain: "acme.com", warmupStartedAt: daysAgo(4), dailyCap: 50, sentToday: 7 })], authSendable);
    expect(rep.byMailbox[0].effectiveCap).toBe(10);
    expect(rep.byMailbox[0].available).toBe(3);
  });

  it("over-cap (sentToday beyond cap) reports 0, never negative", () => {
    const rep = getSendableCapacity([mb({ domain: "acme.com", dailyCap: 50, sentToday: 60 })], authSendable);
    expect(rep.byMailbox[0].available).toBe(0);
  });

  it("AC5: exposes a mixed-provider pool and total", () => {
    const auth = new Map<string, AuthStatus>([
      ["acme.com", verifyAuth("acme.com", pass)],
      ["acme-eu.com", verifyAuth("acme-eu.com", pass)],
    ]);
    const rep = getSendableCapacity(
      [
        mb({ id: "g1", domain: "acme.com", provider: "google", dailyCap: 50, sentToday: 10 }), // 40
        mb({ id: "g2", domain: "acme.com", provider: "google", dailyCap: 50, sentToday: 45 }), // 5
        mb({ id: "m1", domain: "acme-eu.com", provider: "microsoft", dailyCap: 30, sentToday: 0 }), // 30
      ],
      auth,
    );
    expect(rep.byProvider).toEqual({ google: 45, microsoft: 30 });
    expect(rep.totalAvailable).toBe(75);
  });
});
