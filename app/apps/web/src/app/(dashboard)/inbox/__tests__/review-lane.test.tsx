// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { ReviewLane } from "@/app/(dashboard)/inbox/_review-lane";
import { REPLY_CLASSIFICATIONS } from "@/lib/reply/classifications";

/**
 * T10 — the "To classify" review lane (1-click correction of low-confidence
 * reply classifications). Mirrors the capture-review test conventions:
 * happy-dom + Testing Library + a routed global.fetch mock.
 */

const anna = {
  id: "r1",
  outboundEmailId: "o1",
  contactId: "c1",
  contactName: "Anna Keller",
  toAddress: "anna@romandco.ch",
  subject: "Re: Elevay <> RomandCo",
  replySnippet: "We already work with a competitor, but circle back next quarter.",
  classification: { classification: "objection", confidence: 0.45, reason: "pushback but ambiguous" },
  createdAt: "2026-07-01T10:00:00Z",
};

const noContact = {
  id: "r2",
  outboundEmailId: "o2",
  contactId: null,
  contactName: null,
  toAddress: "info@acme.ch",
  subject: "Re: intro",
  replySnippet: "Thanks, not right now.",
  classification: { classification: "ooo", confidence: 0.3, reason: "" },
  createdAt: "2026-07-01T09:00:00Z",
};

/** GET /api/inbox/review → items; any POST → { ok: true }. */
function mockFetch(items: unknown[]) {
  global.fetch = vi.fn(async (url: unknown, init?: { method?: string }) => {
    if (String(url) === "/api/inbox/review" && (!init || !init.method || init.method === "GET")) {
      return { ok: true, json: async () => ({ items, count: items.length }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  }) as never;
}

describe("ReviewLane (T10 to-classify lane)", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => cleanup());

  it("renders one row per pending item: name (or toAddress fallback), subject, snippet, guess chip with confidence", async () => {
    mockFetch([anna, noContact]);
    render(<ReviewLane onResolved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Anna Keller")).toBeTruthy());
    expect(screen.getByText("Re: Elevay <> RomandCo")).toBeTruthy();
    expect(screen.getByText(/circle back next quarter/)).toBeTruthy();
    // The AI's guess as a chip with the confidence.
    expect(screen.getByText("Objection · 45%")).toBeTruthy();
    // No contact resolved → the toAddress is the display name.
    expect(screen.getByText("info@acme.ch")).toBeTruthy();
    expect(screen.getByText("Out of office · 30%")).toBeTruthy();
  });

  it("confirm POSTs {action:'confirm'}, removes the row and bubbles onResolved", async () => {
    mockFetch([anna]);
    const onResolved = vi.fn();
    render(<ReviewLane onResolved={onResolved} />);
    await waitFor(() => expect(screen.getByText("Anna Keller")).toBeTruthy());

    fireEvent.click(screen.getByLabelText("Confirm the AI's classification"));

    await waitFor(() => expect(screen.queryByText("Anna Keller")).toBeNull());
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/inbox/review/r1",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "confirm" }) }),
    );
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("the correction dropdown lists every REPLY_CLASSIFICATIONS entry and POSTs the chosen one", async () => {
    mockFetch([anna]);
    const onResolved = vi.fn();
    render(<ReviewLane onResolved={onResolved} />);
    await waitFor(() => expect(screen.getByText("Anna Keller")).toBeTruthy());

    fireEvent.click(screen.getByText("Correct"));
    // One option per canonical classification — the vocabulary can't drift.
    expect(screen.getAllByRole("menuitem")).toHaveLength(REPLY_CLASSIFICATIONS.length);

    fireEvent.click(screen.getByText("Meeting request"));
    await waitFor(() => expect(screen.queryByText("Anna Keller")).toBeNull());
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/inbox/review/r1",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "correct", classification: "meeting_request" }),
      }),
    );
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("a failed resolution keeps the row (retryable) and does not bubble onResolved", async () => {
    global.fetch = vi.fn(async (url: unknown, init?: { method?: string }) => {
      if (init?.method === "POST") return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, json: async () => ({ items: [anna], count: 1 }) };
    }) as never;
    const onResolved = vi.fn();
    render(<ReviewLane onResolved={onResolved} />);
    await waitFor(() => expect(screen.getByText("Anna Keller")).toBeTruthy());

    fireEvent.click(screen.getByLabelText("Confirm the AI's classification"));
    await waitFor(() =>
      expect(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls.some(
          (c) => (c[1] as { method?: string } | undefined)?.method === "POST",
        ),
      ).toBe(true),
    );
    expect(screen.getByText("Anna Keller")).toBeTruthy();
    expect(onResolved).not.toHaveBeenCalled();
  });

  it("shows the all-clear empty state when the queue is empty", async () => {
    mockFetch([]);
    render(<ReviewLane onResolved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Nothing to classify")).toBeTruthy());
  });

  it("shows a retryable error when the queue fetch fails (not a silent empty)", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }) as never;
    render(<ReviewLane onResolved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Couldn't load replies to classify")).toBeTruthy());
    expect(screen.getByText("Retry")).toBeTruthy();
  });
});
