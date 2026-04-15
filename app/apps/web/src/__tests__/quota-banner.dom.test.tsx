// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, act, waitFor } from "@testing-library/react";
import { QuotaBanner } from "@/components/quota-banner";

type QuotaKind = "contacts" | "emails" | "ai_queries";

interface QuotaFixture {
  plan: string;
  periodStart: string;
  periodEnd: string | null;
  usage: Record<QuotaKind, number>;
  limits: {
    contacts: number | null;
    emailsPerMonth: number | null;
    aiQueriesPerMonth: number | null;
  };
  overLimit: QuotaKind[];
  nearLimit: QuotaKind[];
}

function fixture(overrides: Partial<QuotaFixture> = {}): QuotaFixture {
  return {
    plan: "trial",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: null,
    usage: { contacts: 5, emails: 10, ai_queries: 20 },
    limits: { contacts: 100, emailsPerMonth: 50, aiQueriesPerMonth: 100 },
    overLimit: [],
    nearLimit: [],
    ...overrides,
  };
}

function mockQuotaFetch(data: QuotaFixture | null, opts: { status?: number } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      if (String(url).endsWith("/api/billing/quota")) {
        if (data === null) {
          return new Response("{}", { status: opts.status ?? 500 });
        }
        return new Response(JSON.stringify(data), {
          status: opts.status ?? 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    })
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function flushFetch() {
  // Let the useEffect fire the fetch, resolve it, and render. The banner
  // fetches on mount — we await a microtask and the state update.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("QuotaBanner — render rules", () => {
  it("renders nothing while the fetch is in flight (no SSR mismatch surface)", () => {
    mockQuotaFetch(fixture());
    const { container } = render(<QuotaBanner />);
    expect(container.textContent).toBe("");
  });

  it("renders nothing when no kind is near or over limit", async () => {
    mockQuotaFetch(fixture({ overLimit: [], nearLimit: [] }));
    const { container } = render(<QuotaBanner />);
    await flushFetch();
    expect(container.textContent).toBe("");
  });

  it("renders a yellow-ish near-limit banner when only nearLimit is set", async () => {
    mockQuotaFetch(
      fixture({
        usage: { contacts: 5, emails: 45, ai_queries: 20 },
        nearLimit: ["emails"],
      })
    );
    render(<QuotaBanner />);
    await flushFetch();
    expect(
      await screen.findByText(/approaching your email sends limit/i)
    ).toBeTruthy();
    // The CTA is still there so the user can upgrade proactively.
    expect(screen.getByRole("link", { name: /upgrade/i })).toBeTruthy();
  });

  it("prefers overLimit over nearLimit when both are set", async () => {
    mockQuotaFetch(
      fixture({
        usage: { contacts: 100, emails: 50, ai_queries: 20 },
        overLimit: ["contacts"],
        nearLimit: ["emails"],
      })
    );
    render(<QuotaBanner />);
    await flushFetch();
    expect(
      await screen.findByText(/you've hit your trial plan limit for contacts/i)
    ).toBeTruthy();
    // Emails banner must NOT appear — one kind at a time, over beats near.
    expect(screen.queryByText(/approaching your email/i)).toBeNull();
  });

  it("shows 'X / Y used' counter for finite limits", async () => {
    mockQuotaFetch(
      fixture({
        usage: { contacts: 5, emails: 45, ai_queries: 20 },
        nearLimit: ["emails"],
      })
    );
    const { container } = render(<QuotaBanner />);
    await flushFetch();
    // The count appears both inside the message ("(45 / 50 used)") and as
    // a separate label — assert on the DOM text as a whole so we don't
    // have to care which span the reader picks up.
    await waitFor(() => {
      expect(container.textContent ?? "").toContain("45 / 50 used");
    });
  });

  it("does not print '/ null' when the limit is unlimited", async () => {
    // An unlimited (null) limit shouldn't appear in near/over arrays in
    // practice, but defend against a server bug where it does. Expect no
    // "/ null" in the output.
    mockQuotaFetch(
      fixture({
        plan: "pro",
        limits: { contacts: 10000, emailsPerMonth: 5000, aiQueriesPerMonth: null },
        usage: { contacts: 1, emails: 1, ai_queries: 999_999 },
        // Hypothetical buggy server that includes unlimited:
        overLimit: ["ai_queries"],
      })
    );
    const { container } = render(<QuotaBanner />);
    await flushFetch();
    expect(container.textContent ?? "").not.toMatch(/\/\s*null/);
  });

  it("is aria-announced (role=status, aria-live=polite)", async () => {
    mockQuotaFetch(
      fixture({
        usage: { contacts: 100, emails: 0, ai_queries: 0 },
        overLimit: ["contacts"],
      })
    );
    const { container } = render(<QuotaBanner />);
    await flushFetch();
    await waitFor(() => {
      const el = container.querySelector('[role="status"]');
      expect(el).not.toBeNull();
      expect(el!.getAttribute("aria-live")).toBe("polite");
    });
  });
});

describe("QuotaBanner — dismiss", () => {
  it("hides the banner + writes sessionStorage when the dismiss button is clicked", async () => {
    mockQuotaFetch(
      fixture({
        usage: { contacts: 100, emails: 0, ai_queries: 0 },
        overLimit: ["contacts"],
      })
    );
    const { container } = render(<QuotaBanner />);
    await flushFetch();

    const dismissBtn = await screen.findByLabelText(/dismiss quota banner/i);
    expect(container.querySelector('[role="status"]')).not.toBeNull();

    await act(async () => {
      dismissBtn.click();
    });

    expect(container.querySelector('[role="status"]')).toBeNull();
    const stored = sessionStorage.getItem("quota-banner-dismissed-at");
    expect(stored).toBeTruthy();
    expect(Number(stored)).toBeGreaterThan(0);
  });

  it("stays hidden on re-mount when a recent dismiss timestamp is present", async () => {
    sessionStorage.setItem("quota-banner-dismissed-at", String(Date.now()));
    mockQuotaFetch(
      fixture({
        usage: { contacts: 100, emails: 0, ai_queries: 0 },
        overLimit: ["contacts"],
      })
    );
    const { container } = render(<QuotaBanner />);
    await flushFetch();
    expect(container.textContent).toBe("");
  });

  it("re-renders if the dismiss timestamp is older than 1h", async () => {
    // 2h in the past — beyond the 1h TTL.
    sessionStorage.setItem(
      "quota-banner-dismissed-at",
      String(Date.now() - 2 * 60 * 60 * 1000)
    );
    mockQuotaFetch(
      fixture({
        usage: { contacts: 100, emails: 0, ai_queries: 0 },
        overLimit: ["contacts"],
      })
    );
    render(<QuotaBanner />);
    await flushFetch();
    expect(await screen.findByText(/you've hit your trial plan limit/i)).toBeTruthy();
  });

  it("ignores garbage in the dismiss key (shows banner, doesn't crash)", async () => {
    sessionStorage.setItem("quota-banner-dismissed-at", "not-a-number");
    mockQuotaFetch(
      fixture({
        usage: { contacts: 100, emails: 0, ai_queries: 0 },
        overLimit: ["contacts"],
      })
    );
    render(<QuotaBanner />);
    await flushFetch();
    expect(await screen.findByText(/you've hit your trial plan limit/i)).toBeTruthy();
  });
});

describe("QuotaBanner — fetch resilience", () => {
  it("renders nothing when /api/billing/quota errors (no banner, no throw)", async () => {
    mockQuotaFetch(null, { status: 500 });
    const { container } = render(<QuotaBanner />);
    await flushFetch();
    expect(container.textContent).toBe("");
  });

  it("renders nothing when fetch itself rejects (offline)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network error");
      })
    );
    const { container } = render(<QuotaBanner />);
    await flushFetch();
    expect(container.textContent).toBe("");
  });
});
