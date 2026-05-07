import { describe, it, expect } from "vitest";
import {
  decideRouteMode,
  buildDraftRow,
  PARKED_NEXT_STEP_AT,
} from "@/lib/sequence-drafts/router";

describe("decideRouteMode", () => {
  it("defaults to 'manual' when settings is null", () => {
    expect(decideRouteMode(null)).toBe("manual");
    expect(decideRouteMode(undefined)).toBe("manual");
  });

  it("defaults to 'manual' when settings is empty", () => {
    expect(decideRouteMode({})).toBe("manual");
  });

  it("returns 'auto' when explicitly set", () => {
    expect(decideRouteMode({ approvalMode: "auto" })).toBe("auto");
  });

  it("returns 'manual' when explicitly set", () => {
    expect(decideRouteMode({ approvalMode: "manual" })).toBe("manual");
  });

  it("falls back to 'manual' on unrecognised value", () => {
    expect(decideRouteMode({ approvalMode: "yolo" })).toBe("manual");
    expect(decideRouteMode({ approvalMode: 42 })).toBe("manual");
    expect(decideRouteMode({ approvalMode: null })).toBe("manual");
  });

  it("ignores unrelated settings keys", () => {
    expect(
      decideRouteMode({
        timezone: "UTC",
        approvalMode: "auto",
        flag: true,
      }),
    ).toBe("auto");
  });
});

describe("buildDraftRow", () => {
  const baseArgs = {
    tenantId: "t-1",
    sequenceId: "seq-1",
    stepId: "step-1",
    enrollmentId: "enr-1",
    contactId: "c-1",
    subject: "Hi",
    bodyHtml: "<p>body</p>",
    bodyText: "body",
    stepNumber: 1,
  };

  it("produces the canonical insert shape with status=pending_approval and version=1", () => {
    const row = buildDraftRow(baseArgs);
    expect(row.status).toBe("pending_approval");
    expect(row.version).toBe(1);
    expect(row.tenantId).toBe("t-1");
    expect(row.subject).toBe("Hi");
    expect(row.bodyText).toBe("body");
    expect(row.bodyHtml).toBe("<p>body</p>");
    expect(row.personalizationSources).toEqual([]);
  });

  it("sets triggerReason='scheduled_step_1' when step is 1 and no signal hint", () => {
    expect(buildDraftRow(baseArgs).triggerReason).toBe("scheduled_step_1");
  });

  it("sets triggerReason='scheduled_step_N' for N > 1", () => {
    expect(buildDraftRow({ ...baseArgs, stepNumber: 3 }).triggerReason).toBe(
      "scheduled_step_3",
    );
  });

  it("uses signalHint as triggerReason when provided", () => {
    expect(
      buildDraftRow({ ...baseArgs, signalHint: "post_funding" }).triggerReason,
    ).toBe("post_funding");
  });

  it("trims signalHint and falls back when blank", () => {
    expect(
      buildDraftRow({ ...baseArgs, signalHint: "   " }).triggerReason,
    ).toBe("scheduled_step_1");
    expect(
      buildDraftRow({ ...baseArgs, signalHint: "  funding  " }).triggerReason,
    ).toBe("funding");
  });

  it("caps signalHint at 200 chars to fit DB column", () => {
    const long = "x".repeat(500);
    const row = buildDraftRow({ ...baseArgs, signalHint: long });
    expect(row.triggerReason.length).toBe(200);
  });

  it("threads personalizationSources through", () => {
    const sources = [
      { kind: "email", label: "Last touch", href: "/activity/abc" },
      { kind: "signal", label: "Pricing page visit", quote: "viewed 3 pages" },
    ];
    const row = buildDraftRow({
      ...baseArgs,
      personalizationSources: sources,
    });
    expect(row.personalizationSources).toEqual(sources);
  });
});

describe("PARKED_NEXT_STEP_AT", () => {
  it("is null so the cron predicate stops matching the enrollment", () => {
    expect(PARKED_NEXT_STEP_AT).toBeNull();
  });
});
