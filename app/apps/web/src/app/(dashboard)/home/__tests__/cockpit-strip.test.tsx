// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, waitFor, cleanup, act } from "@testing-library/react";

/**
 * outreach-autopilot T11b — the cockpit strip. Pins the non-nominal states
 * (ux 4): the quota-reached cap gauge (full GREEN bar + "resumes tomorrow" +
 * the deferred count), the deliverability-degraded light (error "Paused"), the
 * empty "Ready for you" (all caught up), and that j/k moves the selection.
 * Mirrors home-actions.test.tsx's fetch + mount conventions.
 */

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

import { CockpitStrip } from "@/components/cockpit-strip";
import { getRegisteredShortcuts, _resetShortcutRegistry } from "@/lib/hotkey-registry";

function jsonRes(data: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => data } as Response;
}

// Per-test fixtures — mutated before mountLoaded().
let capFixture: unknown = { sent: 30, cap: 100, timezone: "Europe/Zurich", deferredCount: 0 };
let delivFixture: unknown = { tripped: false, pauseReason: null };
let summaryFixture: unknown = { weekSummary: { meetingsBooked: 0 } };
let readyFixture: unknown = { drafts: 0, replies: 0, actions: 0 };

let fetchMock: ReturnType<typeof vi.fn>;

function router(url: string): Response {
  const u = String(url);
  if (u === "/api/outreach/cap") return jsonRes(capFixture);
  if (u === "/api/deliverability/status") return jsonRes(delivFixture);
  if (u === "/api/dashboard/summary") return jsonRes(summaryFixture);
  if (u === "/api/home/ready-for-you") return jsonRes(readyFixture);
  return jsonRes({});
}

async function flush() {
  for (let i = 0; i < 12; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

async function mountLoaded() {
  fetchMock = vi.fn((url: string) => Promise.resolve(router(url)));
  vi.stubGlobal("fetch", fetchMock);
  const utils = render(<CockpitStrip />);
  await waitFor(() => {
    expect(fetchMock.mock.calls.some((c) => String(c[0]) === "/api/home/ready-for-you")).toBe(true);
  });
  await flush();
  return utils;
}

beforeEach(() => {
  _resetShortcutRegistry();
  routerPush.mockClear();
  // happy-dom has no layout engine — the j/k handler calls scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
  capFixture = { sent: 30, cap: 100, timezone: "Europe/Zurich", deferredCount: 0 };
  delivFixture = { tripped: false, pauseReason: null };
  summaryFixture = { weekSummary: { meetingsBooked: 0 } };
  readyFixture = { drafts: 0, replies: 0, actions: 0 };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StatBar — cap gauge", () => {
  // The cap fill is the only `.transition-all` element (rows use transition-colors).
  const capFill = (container: HTMLElement) => container.querySelector(".transition-all") as HTMLElement;

  it("below cap: accent fill, resets-at-midnight sub", async () => {
    const { container } = await mountLoaded();
    const fill = capFill(container);
    expect(fill).not.toBeNull();
    expect(fill.style.width).toBe("30%");
    expect(fill.style.background).toContain("var(--color-accent)");
    expect(container.textContent).toContain("resets at midnight Europe/Zurich");
  });

  it("quota reached: FULL GREEN bar + resumes tomorrow + deferred count", async () => {
    capFixture = { sent: 100, cap: 100, timezone: "Europe/Zurich", deferredCount: 4 };
    const { container } = await mountLoaded();
    const fill = capFill(container);
    expect(fill).not.toBeNull();
    expect(fill.style.width).toBe("100%");
    expect(fill.style.background).toContain("var(--color-success)");
    expect(container.textContent).toContain("100 / 100");
    expect(container.textContent).toContain("resumes tomorrow");
    expect(container.textContent).toContain("4 deferred to tomorrow");
  });
});

describe("StatBar — deliverability + meetings", () => {
  it("healthy: success 'Healthy'", async () => {
    const { container } = await mountLoaded();
    expect(container.textContent).toContain("Healthy");
  });

  it("degraded: error 'Paused'", async () => {
    delivFixture = { tripped: true, pauseReason: "bounce_rate" };
    const { container } = await mountLoaded();
    expect(container.textContent).toContain("Paused");
    // The error token colors the value (not the success one).
    const paused = Array.from(container.querySelectorAll("span")).find((s) => s.textContent === "Paused") as HTMLElement | undefined;
    expect(paused?.style.color).toContain("var(--color-error)");
  });

  it("shows meetings this week", async () => {
    summaryFixture = { weekSummary: { meetingsBooked: 3 } };
    const { container } = await mountLoaded();
    expect(container.textContent).toContain("3");
    expect(container.textContent).toContain("this week");
  });
});

describe("Ready for you", () => {
  it("empty: all caught up", async () => {
    const { container } = await mountLoaded();
    expect(container.textContent).toContain("all caught up");
  });

  it("lists non-zero sources with counts + why + click-through", async () => {
    readyFixture = { drafts: 5, replies: 2, actions: 1 };
    const { container } = await mountLoaded();
    const rows = container.querySelectorAll("[data-cockpit-idx]");
    expect(rows).toHaveLength(3);
    expect(container.textContent).toContain("5 drafts to review");
    expect(container.textContent).toContain("2 replies to classify");
    expect(container.textContent).toContain("1 action to approve");
  });

  it("j moves selection down, k moves it back up", async () => {
    readyFixture = { drafts: 5, replies: 2, actions: 1 };
    const { container } = await mountLoaded();
    const accent = (i: number) =>
      (container.querySelectorAll("[data-cockpit-idx]")[i].getAttribute("style") || "").includes("var(--color-accent)");

    // Row 0 selected on load.
    expect(accent(0)).toBe(true);
    expect(accent(1)).toBe(false);

    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "j" })); });
    expect(accent(1)).toBe(true);
    expect(accent(0)).toBe(false);

    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "k" })); });
    expect(accent(0)).toBe(true);
  });

  it("Enter opens the selected item's href; ignores keys while typing", async () => {
    readyFixture = { drafts: 5, replies: 2, actions: 1 };
    await mountLoaded();

    // Typing in an input must NOT move the selection or navigate.
    const input = document.createElement("input");
    document.body.appendChild(input);
    await act(async () => { input.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true })); });

    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })); });
    expect(routerPush).toHaveBeenCalledWith("/sequences/review");
    input.remove();
  });
});

describe("cheatsheet", () => {
  it("registers j/k/Enter under a Home group", async () => {
    await mountLoaded();
    const combos = getRegisteredShortcuts().filter((s) => s.group === "Home").map((s) => s.combo);
    expect(new Set(combos)).toEqual(new Set(["j", "k", "Enter"]));
  });
});
