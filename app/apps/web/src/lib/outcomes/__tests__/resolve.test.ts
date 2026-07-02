import { describe, expect, it, vi, beforeEach } from "vitest";

// db.select() spy: checkEmailOutcomes must not touch the db at all for
// "opened" events, and must query watchers for real events.
const { selectSpy } = vi.hoisted(() => ({ selectSpy: vi.fn() }));
vi.mock("@/db", () => ({ db: { select: selectSpy } }));
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn(async () => undefined) } }));

import { checkEmailOutcomes, POSITIVITY } from "../resolve";

beforeEach(() => {
  selectSpy.mockReset();
  selectSpy.mockReturnValue({
    from: () => ({ where: () => ({ limit: async () => [] }) }),
  });
});

describe("POSITIVITY (learning outcome weights)", () => {
  it("never uses opens as a learning signal (Apple MPP auto-opens)", () => {
    expect(POSITIVITY).not.toHaveProperty("email_opened");
  });

  it("ranks the hierarchy: meeting_held > meeting_booked > replied_positive", () => {
    expect(POSITIVITY.meeting_held).toBeGreaterThan(POSITIVITY.meeting_booked);
    expect(POSITIVITY.meeting_booked).toBeGreaterThan(POSITIVITY.replied_positive);
  });

  it("keeps positive replies at or above the reply-flywheel promotion bar (0.8)", () => {
    expect(POSITIVITY.replied_positive).toBeGreaterThanOrEqual(0.8);
  });
});

describe("checkEmailOutcomes", () => {
  it("an open never resolves a watcher — no db access, the watcher survives for the real reply", async () => {
    await checkEmailOutcomes("t1", "c1", "opened");
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it("a click still looks up watching outcomes", async () => {
    await checkEmailOutcomes("t1", "c1", "clicked");
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });

  it("a bounce still looks up watching outcomes", async () => {
    await checkEmailOutcomes("t1", "c1", "bounced");
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });
});
