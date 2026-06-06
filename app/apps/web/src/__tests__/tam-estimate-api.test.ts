import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression coverage for /api/tam/estimate — guards against the
 * "silent-degradation" failure mode where a filter the UI sends is
 * quietly dropped before it reaches Apollo (so the live count lies).
 * Every Apollo org-search filter the onboarding card exposes must map
 * to its OrgSearchParams key here.
 */

vi.mock("@/lib/auth/auth-utils", () => ({
  getAuthContext: vi.fn(),
}));

vi.mock("@/lib/infra/rate-limit", () => ({
  checkRateLimit: vi.fn(() => null),
}));

vi.mock("@/lib/config/icp-constants", () => ({
  // Mirror the real "1-10" → "1,10" shape so the pass-through branch is exercised.
  sizesToApolloRanges: vi.fn((sizes: string[]) =>
    sizes.map((s) => s.replace(/,/g, "").replace("-", ",")),
  ),
}));

vi.mock("@/lib/icp/apollo-technology-uids", () => ({
  toTechnologyUid: vi.fn((t: string) => t.toLowerCase()),
}));

vi.mock("@/lib/integrations/apollo-client", () => ({
  searchOrganizations: vi.fn(),
  isApolloAvailable: vi.fn(() => true),
}));

import { getAuthContext } from "@/lib/auth/auth-utils";
import { searchOrganizations } from "@/lib/integrations/apollo-client";

const { POST } = await import("@/app/api/tam/estimate/route");

function reqWith(body: unknown): Request {
  return new Request("http://localhost/api/tam/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const authed = {
  userId: "u1",
  tenantId: "t1",
  appUserId: "u1",
  role: "admin",
};

describe("POST /api/tam/estimate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchOrganizations).mockResolvedValue({
      organizations: [],
      pagination: { page: 1, per_page: 1, total_entries: 42 },
    });
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null);
    const res = await POST(reqWith({ industries: ["SaaS"] }));
    expect(res.status).toBe(401);
  });

  it("maps every Apollo org filter the card sends to its OrgSearchParams key", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(authed as never);

    const res = await POST(
      reqWith({
        industries: ["Computer Software"],
        keywords: ["developer tools"],
        companySizes: ["51-200"],
        geographies: ["United States"],
        excludeGeographies: ["India"],
        technologies: ["Kubernetes"],
        revenueMin: 1_000_000,
        revenueMax: 50_000_000,
        totalFundingMin: 5_000_000,
        totalFundingMax: 100_000_000,
        minJobOpenings: 1,
        hiringTitles: ["Account Executive"],
      }),
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.total).toBe(42);

    const params = vi.mocked(searchOrganizations).mock.calls[0][0];
    // Industries + keywords union into one keyword-tags param.
    expect(params.q_organization_keyword_tags).toEqual([
      "Computer Software",
      "developer tools",
    ]);
    expect(params.organization_num_employees_ranges).toEqual(["51,200"]);
    expect(params.organization_locations).toEqual(["United States"]);
    expect(params.organization_not_locations).toEqual(["India"]);
    expect(params.currently_using_any_of_technology_uids).toEqual(["kubernetes"]);
    expect(params.revenue_range).toEqual({ min: 1_000_000, max: 50_000_000 });
    expect(params.total_funding_range).toEqual({ min: 5_000_000, max: 100_000_000 });
    expect(params.organization_num_jobs_range).toEqual({ min: 1 });
    expect(params.q_organization_job_titles).toEqual(["Account Executive"]);
  });

  it("translates fundingRecencyDays into a latest_funding_date_range.min ISO date", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(authed as never);

    const before = Date.now();
    await POST(reqWith({ industries: ["SaaS"], fundingRecencyDays: 180 }));
    const after = Date.now();

    const params = vi.mocked(searchOrganizations).mock.calls[0][0];
    expect(params.latest_funding_date_range?.min).toBeTypeOf("string");
    const min = new Date(params.latest_funding_date_range!.min!).getTime();
    const windowMs = 180 * 24 * 60 * 60 * 1000;
    // min ≈ now − 180d, allowing for the call taking a few ms.
    expect(min).toBeGreaterThanOrEqual(before - windowMs - 5000);
    expect(min).toBeLessThanOrEqual(after - windowMs + 5000);
  });

  it("omits range params when no bound is given", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(authed as never);

    await POST(reqWith({ industries: ["SaaS"] }));
    const params = vi.mocked(searchOrganizations).mock.calls[0][0];
    expect(params.revenue_range).toBeUndefined();
    expect(params.total_funding_range).toBeUndefined();
    expect(params.organization_num_jobs_range).toBeUndefined();
    expect(params.latest_funding_date_range).toBeUndefined();
    expect(params.organization_not_locations).toBeUndefined();
  });

  it("reports capped=true at the Apollo 100k ceiling", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(authed as never);
    vi.mocked(searchOrganizations).mockResolvedValue({
      organizations: [],
      pagination: { page: 1, per_page: 1, total_entries: 100_000 },
    });
    const res = await POST(reqWith({ industries: ["SaaS"] }));
    const data = await res.json();
    expect(data.capped).toBe(true);
  });
});
