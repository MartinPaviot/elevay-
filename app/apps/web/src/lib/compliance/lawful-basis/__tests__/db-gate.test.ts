import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isLawfulBasisGateEnabled,
  loadComplianceContact,
  evaluateLawfulBasisForSend,
} from "../db-gate";

/**
 * Spec 33 — the DB-backed lawful-basis gate. The contract that matters for
 * production safety: with the flag OFF it ALWAYS allows (block-by-default must
 * not halt sends pre-backfill); with the flag ON it enforces the pure
 * assertLawfulBasis over the contact's recorded basis/source/jurisdiction.
 */

const ORIG = process.env.LAWFUL_BASIS_GATE;
afterEach(() => {
  if (ORIG === undefined) delete process.env.LAWFUL_BASIS_GATE;
  else process.env.LAWFUL_BASIS_GATE = ORIG;
});

// Minimal db stub mirroring the drizzle chain loadComplianceContact walks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbReturning(rows: any[]) {
  return {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }) }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("isLawfulBasisGateEnabled", () => {
  it("off by default and for any non-truthy value", () => {
    delete process.env.LAWFUL_BASIS_GATE;
    expect(isLawfulBasisGateEnabled()).toBe(false);
    process.env.LAWFUL_BASIS_GATE = "0";
    expect(isLawfulBasisGateEnabled()).toBe(false);
    process.env.LAWFUL_BASIS_GATE = "off";
    expect(isLawfulBasisGateEnabled()).toBe(false);
  });
  it("on for '1' / 'true'", () => {
    process.env.LAWFUL_BASIS_GATE = "1";
    expect(isLawfulBasisGateEnabled()).toBe(true);
    process.env.LAWFUL_BASIS_GATE = "true";
    expect(isLawfulBasisGateEnabled()).toBe(true);
  });
});

describe("loadComplianceContact", () => {
  it("maps a row's basis/source/jurisdiction", async () => {
    const cc = await loadComplianceContact(
      "t1",
      "Jane@Acme.com",
      dbReturning([{ id: "c1", lawfulBasis: { type: "consent", consentAt: 1 }, source: "manual", jurisdiction: "FR" }]),
    );
    expect(cc).toMatchObject({ id: "c1", source: "manual", jurisdiction: "FR" });
    expect(cc?.lawfulBasis?.type).toBe("consent");
  });
  it("returns null when no contact matches", async () => {
    expect(await loadComplianceContact("t1", "ghost@x.com", dbReturning([]))).toBeNull();
  });
});

describe("evaluateLawfulBasisForSend", () => {
  beforeEach(() => delete process.env.LAWFUL_BASIS_GATE);

  it("flag OFF -> always allowed (no halt pre-backfill), even with no contact", async () => {
    const r = await evaluateLawfulBasisForSend("t1", "anyone@x.com", dbReturning([]));
    expect(r.allowed).toBe(true);
  });

  it("flag ON + unknown recipient (no row) -> blocked no_lawful_basis", async () => {
    process.env.LAWFUL_BASIS_GATE = "1";
    const r = await evaluateLawfulBasisForSend("t1", "stranger@x.com", dbReturning([]));
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("no_lawful_basis");
  });

  it("flag ON + valid LI basis + clean source + FR -> allowed", async () => {
    process.env.LAWFUL_BASIS_GATE = "1";
    const r = await evaluateLawfulBasisForSend(
      "t1",
      "ok@x.com",
      dbReturning([{ id: "c1", lawfulBasis: { type: "legitimate_interest", assessmentId: "LIA-1" }, source: "manual", jurisdiction: "FR" }]),
    );
    expect(r.allowed).toBe(true);
  });

  it("flag ON + prohibited source -> blocked prohibited_source", async () => {
    process.env.LAWFUL_BASIS_GATE = "1";
    const r = await evaluateLawfulBasisForSend(
      "t1",
      "ok@x.com",
      dbReturning([{ id: "c1", lawfulBasis: { type: "legitimate_interest", assessmentId: "LIA-1" }, source: "apollo", jurisdiction: "FR" }]),
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("prohibited_source");
  });
});
