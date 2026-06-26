import { describe, it, expect, afterEach } from "vitest";
import { isCadenceBranchingEnabled, buildEngagementEvent } from "../engagement-event";

describe("isCadenceBranchingEnabled", () => {
  const prev = process.env.CADENCE_BRANCHING_ENABLED;
  afterEach(() => {
    if (prev === undefined) delete process.env.CADENCE_BRANCHING_ENABLED;
    else process.env.CADENCE_BRANCHING_ENABLED = prev;
  });

  it("off by default / on only for '1'|'true'", () => {
    delete process.env.CADENCE_BRANCHING_ENABLED;
    expect(isCadenceBranchingEnabled()).toBe(false);
    process.env.CADENCE_BRANCHING_ENABLED = "1";
    expect(isCadenceBranchingEnabled()).toBe(true);
    process.env.CADENCE_BRANCHING_ENABLED = "true";
    expect(isCadenceBranchingEnabled()).toBe(true);
    process.env.CADENCE_BRANCHING_ENABLED = "0";
    expect(isCadenceBranchingEnabled()).toBe(false);
  });
});

describe("buildEngagementEvent", () => {
  it("builds the email/opened event for a sequenced send", () => {
    expect(buildEngagementEvent("opened", { enrollmentId: "e1", tenantId: "t1", contactId: "c1" }))
      .toEqual({ name: "email/opened", data: { enrollmentId: "e1", tenantId: "t1", contactId: "c1" } });
  });

  it("builds email/clicked", () => {
    expect(buildEngagementEvent("clicked", { enrollmentId: "e1", tenantId: "t1", contactId: "c1" })?.name).toBe("email/clicked");
  });

  it("returns null for a non-sequenced send (no enrollmentId) — the bridge would bail anyway", () => {
    expect(buildEngagementEvent("opened", { enrollmentId: null, tenantId: "t1", contactId: "c1" })).toBeNull();
  });

  it("coerces a null contactId to empty string", () => {
    expect(buildEngagementEvent("opened", { enrollmentId: "e1", tenantId: "t1", contactId: null })?.data.contactId).toBe("");
  });
});
