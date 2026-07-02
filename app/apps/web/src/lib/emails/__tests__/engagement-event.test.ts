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
  it("an 'opened' engagement builds NOTHING (T8 opens ban — the bridge no longer listens)", () => {
    expect(buildEngagementEvent("opened", { enrollmentId: "e1", tenantId: "t1", contactId: "c1" })).toBeNull();
  });

  it("builds email/clicked", () => {
    expect(buildEngagementEvent("clicked", { enrollmentId: "e1", tenantId: "t1", contactId: "c1" }))
      .toEqual({ name: "email/clicked", data: { enrollmentId: "e1", tenantId: "t1", contactId: "c1" } });
  });

  it("returns null for a non-sequenced send (no enrollmentId) — the bridge would bail anyway", () => {
    expect(buildEngagementEvent("clicked", { enrollmentId: null, tenantId: "t1", contactId: "c1" })).toBeNull();
  });

  it("coerces a null contactId to empty string", () => {
    expect(buildEngagementEvent("clicked", { enrollmentId: "e1", tenantId: "t1", contactId: null })?.data.contactId).toBe("");
  });
});
