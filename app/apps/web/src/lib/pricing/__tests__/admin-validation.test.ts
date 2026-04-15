import { describe, it, expect } from "vitest";
import {
  sanitiseQuotaOverrides,
  VALID_LIMIT_KEYS,
} from "@/lib/pricing/admin-validation";

describe("sanitiseQuotaOverrides", () => {
  it("accepts an empty object", () => {
    const r = sanitiseQuotaOverrides({});
    expect(r.errors).toEqual([]);
    expect(r.clean).toEqual({});
  });

  it("passes through valid non-negative integers including 0", () => {
    const r = sanitiseQuotaOverrides({
      contacts: 5000,
      emailsPerMonth: 0, // hard block — legitimate
      aiQueriesPerMonth: 100,
    });
    expect(r.errors).toEqual([]);
    expect(r.clean).toEqual({
      contacts: 5000,
      emailsPerMonth: 0,
      aiQueriesPerMonth: 100,
    });
  });

  it("stores null explicitly as inherit marker", () => {
    const r = sanitiseQuotaOverrides({ contacts: null, emailsPerMonth: 200 });
    expect(r.errors).toEqual([]);
    expect(r.clean).toEqual({ contacts: null, emailsPerMonth: 200 });
  });

  it("treats undefined the same as null (defensive)", () => {
    const r = sanitiseQuotaOverrides({ contacts: undefined });
    expect(r.errors).toEqual([]);
    // undefined becomes explicit null in the clean output so the jsonb stores
    // "inherit" rather than dropping the key silently.
    expect(r.clean).toEqual({ contacts: null });
  });

  it("rejects unknown keys — prevents typo'd overrides from silently sitting in jsonb", () => {
    const r = sanitiseQuotaOverrides({ contacts: 10, contaxts: 999 });
    expect(r.errors).toContain("unknown override key: contaxts");
    expect(r.clean).toEqual({ contacts: 10 }); // valid siblings still kept
  });

  it("rejects negative numbers", () => {
    const r = sanitiseQuotaOverrides({ contacts: -1 });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/contacts.*non-negative/);
    expect(r.clean.contacts).toBeUndefined();
  });

  it("rejects fractional numbers (quotas are integer counts)", () => {
    const r = sanitiseQuotaOverrides({ emailsPerMonth: 500.5 });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/integer/);
  });

  it("rejects non-numbers (strings, booleans, objects)", () => {
    const r = sanitiseQuotaOverrides({
      contacts: "lots" as unknown,
      emailsPerMonth: true as unknown,
      aiQueriesPerMonth: { nested: 1 } as unknown,
    });
    expect(r.errors.length).toBe(3);
    expect(r.clean).toEqual({});
  });

  it("rejects NaN and Infinity (not finite)", () => {
    const r = sanitiseQuotaOverrides({
      contacts: NaN,
      emailsPerMonth: Infinity,
    });
    expect(r.errors.length).toBe(2);
    expect(r.clean).toEqual({});
  });

  it("rejects non-object input at the top level", () => {
    expect(sanitiseQuotaOverrides(null).errors).toContain("overrides must be an object");
    expect(sanitiseQuotaOverrides(undefined).errors.length).toBeGreaterThan(0);
    expect(sanitiseQuotaOverrides([1, 2, 3]).errors.length).toBeGreaterThan(0);
    expect(sanitiseQuotaOverrides("string").errors.length).toBeGreaterThan(0);
  });

  it("VALID_LIMIT_KEYS mirrors TierLimits shape", () => {
    // Tripwire: if someone adds a 4th limit to TierLimits, this test fails
    // until they extend VALID_LIMIT_KEYS here too. Intentional coupling.
    expect(VALID_LIMIT_KEYS).toEqual([
      "contacts",
      "emailsPerMonth",
      "aiQueriesPerMonth",
    ]);
  });
});
