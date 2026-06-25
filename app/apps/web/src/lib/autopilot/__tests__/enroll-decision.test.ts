import { describe, it, expect } from "vitest";
import { decideAutopilotEnrollment } from "../enroll-decision";

describe("decideAutopilotEnrollment", () => {
  it("auto-high-confidence → auto-enroll", () => {
    expect(decideAutopilotEnrollment("auto-high-confidence")).toBe("auto");
  });

  it("batch-daily and review-each → draft (human in the loop)", () => {
    expect(decideAutopilotEnrollment("batch-daily")).toBe("draft");
    expect(decideAutopilotEnrollment("review-each")).toBe("draft");
  });

  it("explicit autopilotAutoEnroll=false is a kill-switch: draft regardless of mode", () => {
    expect(decideAutopilotEnrollment("auto-high-confidence", { autopilotAutoEnroll: false })).toBe("draft");
    expect(decideAutopilotEnrollment("batch-daily", { autopilotAutoEnroll: false })).toBe("draft");
  });

  it("explicit autopilotAutoEnroll=true follows the mode — never UPGRADES review/batch to auto", () => {
    expect(decideAutopilotEnrollment("auto-high-confidence", { autopilotAutoEnroll: true })).toBe("auto");
    expect(decideAutopilotEnrollment("review-each", { autopilotAutoEnroll: true })).toBe("draft");
    expect(decideAutopilotEnrollment("batch-daily", { autopilotAutoEnroll: true })).toBe("draft");
  });
});
