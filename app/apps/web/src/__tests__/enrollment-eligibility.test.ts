import { describe, expect, it } from "vitest";
import {
  checkContactEligibility,
  isCompanyEligible,
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
