import { describe, expect, it } from "vitest";
import {
  checkContactEligibility,
  isCompanyEligible,
  G1_MIN_ICP_SCORE,
} from "@/lib/sequences/enrollment-eligibility";

describe("checkContactEligibility", () => {
  it("accepts an active contact with email and a non-excluded company", () => {
    expect(
      checkContactEligibility({
        email: "founder@target.com",
        deletedAt: null,
        companyExcludedReason: null,
      }),
    ).toEqual({ eligible: true });
  });

  it("rejects when the contact has no email (can't send)", () => {
    expect(
      checkContactEligibility({
        email: null,
        deletedAt: null,
        companyExcludedReason: null,
      }),
    ).toEqual({ eligible: false, reason: "no_email" });
  });

  it("rejects when the contact is soft-deleted", () => {
    expect(
      checkContactEligibility({
        email: "founder@target.com",
        deletedAt: new Date("2026-01-01"),
        companyExcludedReason: null,
      }),
    ).toEqual({ eligible: false, reason: "deleted" });
  });

  it("rejects when the contact's company is anti-ICP flagged", () => {
    expect(
      checkContactEligibility({
        email: "founder@target.com",
        deletedAt: null,
        companyExcludedReason: "anti_icp_industry",
      }),
    ).toEqual({ eligible: false, reason: "excluded_company" });
  });

  it("rejects with do_not_contact_request when that's the reason tag", () => {
    expect(
      checkContactEligibility({
        email: "founder@target.com",
        deletedAt: null,
        companyExcludedReason: "do_not_contact_request",
      }),
    ).toEqual({ eligible: false, reason: "excluded_company" });
  });

  it("prioritises deletion over no_email (deletion is the hardest stop)", () => {
    expect(
      checkContactEligibility({
        email: null,
        deletedAt: new Date("2026-01-01"),
        companyExcludedReason: null,
      }),
    ).toEqual({ eligible: false, reason: "deleted" });
  });

  it("prioritises deletion over excluded_company", () => {
    expect(
      checkContactEligibility({
        email: "founder@target.com",
        deletedAt: new Date("2026-01-01"),
        companyExcludedReason: "anti_icp_size",
      }),
    ).toEqual({ eligible: false, reason: "deleted" });
  });

  it("prioritises no_email over excluded_company (no point checking ICP if we can't email)", () => {
    expect(
      checkContactEligibility({
        email: null,
        deletedAt: null,
        companyExcludedReason: "anti_icp_industry",
      }),
    ).toEqual({ eligible: false, reason: "no_email" });
  });
});

describe("isCompanyEligible", () => {
  it("returns true for an active non-excluded company", () => {
    expect(
      isCompanyEligible({ excludedReason: null, deletedAt: null }),
    ).toBe(true);
  });

  it("returns false for an anti-ICP-flagged company", () => {
    expect(
      isCompanyEligible({
        excludedReason: "anti_icp_industry",
        deletedAt: null,
      }),
    ).toBe(false);
  });

  it("returns false for a soft-deleted company even without excludedReason", () => {
    expect(
      isCompanyEligible({
        excludedReason: null,
        deletedAt: new Date("2026-01-01"),
      }),
    ).toBe(false);
  });

  it("returns false for a company that is both excluded and deleted", () => {
    expect(
      isCompanyEligible({
        excludedReason: "competitor",
        deletedAt: new Date("2026-01-01"),
      }),
    ).toBe(false);
  });
});

describe("M13-G1 (T5) — fresh-signal + ICP threshold", () => {
  const base = { email: "a@b.c", deletedAt: null, companyExcludedReason: null };

  it("g1 omitted -> legacy behavior, eligible", () => {
    expect(checkContactEligibility(base)).toEqual({ eligible: true });
  });

  it("no fresh signal -> blocked whatever the fit (INV-2)", () => {
    const r = checkContactEligibility({ ...base, g1: { freshSignalCount: 0, icpScore: 100, icpScoringActive: true } });
    expect(r).toEqual({ eligible: false, reason: "no_fresh_signal" });
  });

  it("fresh signal + fit under threshold with ACTIVE scoring -> blocked", () => {
    const r = checkContactEligibility({ ...base, g1: { freshSignalCount: 1, icpScore: G1_MIN_ICP_SCORE - 1, icpScoringActive: true } });
    expect(r).toEqual({ eligible: false, reason: "below_icp_threshold" });
  });

  it("fresh signal + fit at threshold -> eligible", () => {
    const r = checkContactEligibility({ ...base, g1: { freshSignalCount: 1, icpScore: G1_MIN_ICP_SCORE, icpScoringActive: true } });
    expect(r).toEqual({ eligible: true });
  });

  it("unscored tenant -> the threshold never bites (sane default M11-R5), fresh-signal still required", () => {
    expect(
      checkContactEligibility({ ...base, g1: { freshSignalCount: 1, icpScore: null, icpScoringActive: false } }),
    ).toEqual({ eligible: true });
    expect(
      checkContactEligibility({ ...base, g1: { freshSignalCount: 0, icpScore: null, icpScoringActive: false } }),
    ).toEqual({ eligible: false, reason: "no_fresh_signal" });
  });

  it("suppression still beats G1 (order preserved)", () => {
    const r = checkContactEligibility({
      ...base,
      suppressedReason: "hard_bounce",
      g1: { freshSignalCount: 0, icpScore: null, icpScoringActive: false },
    });
    expect(r).toEqual({ eligible: false, reason: "suppressed" });
  });
});
