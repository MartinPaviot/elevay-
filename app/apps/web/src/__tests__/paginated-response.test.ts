import { describe, it, expect } from "vitest";
import {
  buildListQuery,
  DEFAULT_PAGE_SIZE,
  isPaginatedResponse,
} from "@/lib/api/paginated-response";

describe("buildListQuery", () => {
  it("emits page + pageSize defaults when called with no arguments", () => {
    const qs = buildListQuery();
    expect(qs).toBe(`page=1&pageSize=${DEFAULT_PAGE_SIZE}`);
  });

  it("clamps page to ≥ 1", () => {
    expect(buildListQuery({ page: 0 })).toContain("page=1");
    expect(buildListQuery({ page: -5 })).toContain("page=1");
  });

  it("emits sort + dir when sort is set", () => {
    const qs = buildListQuery({ sort: { field: "score", dir: "desc" } });
    expect(qs).toContain("sort=score");
    expect(qs).toContain("dir=desc");
  });

  it("omits sort params when sort is null or undefined", () => {
    const qs = buildListQuery({ sort: null });
    expect(qs).not.toContain("sort=");
    expect(qs).not.toContain("dir=");
  });

  it("serialises array filter values as repeated keys", () => {
    const qs = buildListQuery({
      filters: { industry: ["SaaS", "FinTech"] },
    });
    expect(qs.split("&").filter((p) => p.startsWith("industry="))).toEqual([
      "industry=SaaS",
      "industry=FinTech",
    ]);
  });

  it("drops null/undefined filter values (clearing a filter)", () => {
    const qs = buildListQuery({ filters: { industry: null, score: 50 } });
    expect(qs).not.toContain("industry");
    expect(qs).toContain("score=50");
  });

  it("keeps empty-string filter values (deliberate caller choice)", () => {
    const qs = buildListQuery({ filters: { search: "" } });
    expect(qs).toContain("search=");
  });

  it("coerces booleans and numbers into string filter values", () => {
    const qs = buildListQuery({ filters: { active: true, minScore: 70 } });
    expect(qs).toContain("active=true");
    expect(qs).toContain("minScore=70");
  });

  it("URL-encodes filter values", () => {
    const qs = buildListQuery({ filters: { search: "acme & co" } });
    expect(qs).toContain("search=acme+%26+co");
  });
});

describe("isPaginatedResponse", () => {
  const valid = {
    items: [{ id: "a" }],
    pagination: { page: 1, pageSize: 25, total: 100, hasMore: true },
  };

  it("accepts a well-formed response", () => {
    expect(isPaginatedResponse(valid)).toBe(true);
  });

  it("rejects null / primitive inputs", () => {
    expect(isPaginatedResponse(null)).toBe(false);
    expect(isPaginatedResponse(undefined)).toBe(false);
    expect(isPaginatedResponse(42)).toBe(false);
    expect(isPaginatedResponse("foo")).toBe(false);
  });

  it("rejects responses missing the items array", () => {
    expect(isPaginatedResponse({ pagination: valid.pagination })).toBe(false);
    expect(
      isPaginatedResponse({ items: "not an array", pagination: valid.pagination })
    ).toBe(false);
  });

  it("rejects responses missing required pagination fields", () => {
    expect(isPaginatedResponse({ items: [], pagination: {} })).toBe(false);
    expect(
      isPaginatedResponse({
        items: [],
        pagination: { page: 1, pageSize: 25, total: 100 }, // no hasMore
      })
    ).toBe(false);
  });

  it("rejects responses where pagination fields have wrong types", () => {
    expect(
      isPaginatedResponse({
        items: [],
        pagination: {
          page: "1",
          pageSize: 25,
          total: 100,
          hasMore: true,
        },
      })
    ).toBe(false);
  });
});
