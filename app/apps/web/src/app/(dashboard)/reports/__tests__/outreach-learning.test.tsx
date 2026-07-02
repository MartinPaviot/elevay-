// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/**
 * T11 (outreach-autopilot) — the outcomes-first Reports strip renders its
 * three sections from one aggregate fetch: the outcomes tiles (with sends
 * grayed + last), the per-gate block-rate rows (the two G2 producers kept
 * distinct by path), and the persona x signal decisions table.
 */

import { OutreachLearning } from "@/app/(dashboard)/reports/_outreach-learning";

const PAYLOAD = {
  window: { days: 30, since: new Date().toISOString() },
  outcomes: {
    meetingsHeld: 3,
    meetingsBooked: 5,
    positiveReplies: 7,
    dealsAdvanced: 2,
    sends: 42,
  },
  gates: [
    { gate: 2, rubricVersion: "g2.det.v1", path: "copy_engine", n: 10, blocked: 4, blockRate: 0.4 },
    { gate: 2, rubricVersion: "g2.det.v1", path: "sequence_step_v2", n: 8, blocked: 2, blockRate: 0.25 },
  ],
  decisions: [
    { persona: "senior / sales", signal: "funding", n: 12, lift: 0.4, positivityAvg: 0.9 },
  ],
  decisionsSummary: { total: 24, baseline: 0.5 },
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => PAYLOAD } as Response);
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => cleanup());

describe("OutreachLearning", () => {
  it("fetches the one aggregate route", async () => {
    render(<OutreachLearning />);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/reports/outreach-learning"),
    );
  });

  it("renders outcomes-first: outcome tiles + a grayed sends volume tile", async () => {
    render(<OutreachLearning />);
    expect(await screen.findByText("Meetings held")).toBeTruthy();
    expect(screen.getByText("Meetings booked")).toBeTruthy();
    expect(screen.getByText("Positive replies")).toBeTruthy();
    expect(screen.getByText("Sends")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy(); // sends volume
    expect(screen.getByText("Volume")).toBeTruthy(); // the de-emphasis caption
  });

  it("renders the per-gate block rate keeping the two G2 producers distinct", async () => {
    render(<OutreachLearning />);
    expect(await screen.findByText("copy_engine")).toBeTruthy();
    expect(screen.getByText("sequence_step_v2")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy(); // 4/10
    expect(screen.getByText("25%")).toBeTruthy(); // 2/8
  });

  it("renders the persona x signal decisions row with lift", async () => {
    render(<OutreachLearning />);
    expect(await screen.findByText("senior / sales")).toBeTruthy();
    expect(screen.getByText("funding")).toBeTruthy();
    expect(screen.getByText("+0.40")).toBeTruthy();
  });

  it("renders nothing extra when the aggregate fetch fails (fail-soft)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    const { container } = render(<OutreachLearning />);
    await waitFor(() => expect(container.querySelector("[data-testid='outreach-learning']")).toBeNull());
  });
});
