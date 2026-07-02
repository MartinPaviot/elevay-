import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * T12 (outreach-autopilot) — meeting outcome producers. Meetings never
 * resolved a watcher before T12: the best outcomes in the POSITIVITY
 * hierarchy (meeting_held 1.0 > meeting_booked 0.95) were structurally
 * absent from the learning data. The REAL resolveOutcome runs (no spy —
 * an internal same-module call would bypass one); assertions read the
 * captured actionOutcomes update. Harness mirrors
 * outcome-decision-backfill.test.ts (selects routed on projection keys,
 * bare selects sequenced by call order).
 */

let watchingRows: Array<Record<string, unknown>> = [];
let bareSelectCalls = 0;
const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];

vi.mock("@/db", () => ({
  db: {
    select: (proj?: Record<string, unknown>) => ({
      from: () => ({
        where: () => {
          let rows: unknown[];
          if (!proj) {
            // Bare selects, in call order: 1 = the checker's watching query;
            // 2+ = resolveOutcome's per-id outcome fetch (same fixture row).
            bareSelectCalls += 1;
            rows = bareSelectCalls === 1 ? watchingRows : watchingRows.slice(0, 1);
          } else {
            // The backfill's decision lookup (projects outboundEmailId) and
            // any other projected read: empty -> backfill no-ops.
            rows = [];
          }
          const p = Promise.resolve(rows) as unknown as Promise<unknown[]> & {
            limit: () => Promise<unknown[]>;
          };
          p.limit = () => Promise.resolve(rows);
          return p;
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          updates.push({ table, values });
          return Promise.resolve(undefined);
        },
      }),
    }),
  },
}));
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn(async () => undefined) } }));

import { checkMeetingOutcomes, POSITIVITY } from "@/lib/outcomes/resolve";
import { actionOutcomes } from "@/db/schema";

const watcher = (over: Record<string, unknown> = {}) => ({
  id: "w1",
  tenantId: "t1",
  entityId: "c1",
  actionId: "a1",
  actionType: "outreach-send",
  status: "watching",
  triggerType: null,
  watchingSince: new Date(Date.now() - 60 * 60 * 1000),
  entitySnapshot: null, // no decisionId -> the backfill no-ops cleanly
  ...over,
});

const outcomeUpdates = () => updates.filter((u) => u.table === actionOutcomes);

beforeEach(() => {
  watchingRows = [];
  bareSelectCalls = 0;
  updates.length = 0;
});

describe("checkMeetingOutcomes", () => {
  it("resolves an email-family watcher (incl. T8 outreach-send) as meeting_booked (0.95)", async () => {
    watchingRows = [watcher()];
    await checkMeetingOutcomes("t1", "c1", "meeting_booked");
    expect(outcomeUpdates()).toHaveLength(1);
    expect(outcomeUpdates()[0].values).toMatchObject({
      status: "resolved",
      outcomeType: "meeting_booked",
      positivity: 0.95,
    });
  });

  it("meeting_held resolves at the TOP of the hierarchy (1.0)", async () => {
    watchingRows = [watcher({ actionType: "send_followup" })];
    await checkMeetingOutcomes("t1", "c1", "meeting_held");
    expect(outcomeUpdates()[0].values).toMatchObject({
      status: "resolved",
      outcomeType: "meeting_held",
      positivity: 1.0,
    });
  });

  it("never touches a non-email-family watcher (e.g. a deal watcher)", async () => {
    watchingRows = [watcher({ actionType: "advance_deal" })];
    await checkMeetingOutcomes("t1", "c1", "meeting_held");
    expect(outcomeUpdates()).toHaveLength(0);
  });

  it("no watching outcome -> silent no-op", async () => {
    await checkMeetingOutcomes("t1", "c1", "meeting_booked");
    expect(outcomeUpdates()).toHaveLength(0);
  });
});

describe("POSITIVITY hierarchy (#609 — meetings on top)", () => {
  it("meeting_held (1.0) > meeting_booked (0.95) > replied_positive (0.9)", () => {
    expect(POSITIVITY.meeting_held).toBe(1.0);
    expect(POSITIVITY.meeting_booked).toBe(0.95);
    expect(POSITIVITY.meeting_held).toBeGreaterThan(POSITIVITY.meeting_booked);
    expect(POSITIVITY.meeting_booked).toBeGreaterThan(POSITIVITY.replied_positive);
  });
});

describe("T12 wiring guards", () => {
  const ROOT = join(__dirname, "..");
  const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

  it("the three real-time producers call checkMeetingOutcomes", () => {
    expect(read("app/api/meetings/book/route.ts")).toContain(
      'checkMeetingOutcomes(authCtx.tenantId, resolvedContactId, "meeting_booked")',
    );
    expect(read("app/api/meetings/[id]/attendance/route.ts")).toContain('"meeting_held"');
    expect(read("app/api/webhooks/recall/route.ts")).toContain("checkMeetingOutcomes");
  });

  it("the cron sweep runs BEFORE the reply check — a consumed watcher can never upgrade", () => {
    const src = read("inngest/outcome-detector.ts");
    const meetingIdx = src.indexOf("fetch-meeting-watchers");
    const emailIdx = src.indexOf("find-email-watchers");
    expect(meetingIdx).toBeGreaterThan(0);
    expect(emailIdx).toBeGreaterThan(0);
    expect(meetingIdx).toBeLessThan(emailIdx);
    // held outranks booked: checked first within the sweep.
    expect(src.indexOf('findMeeting("meeting_completed")')).toBeLessThan(
      src.indexOf('findMeeting("meeting_scheduled")'),
    );
  });
});
