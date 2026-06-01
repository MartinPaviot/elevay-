import { describe, expect, it } from "vitest";
import { pickIcpScopedSequence } from "@/lib/icp/enrollment-routing";

describe("pickIcpScopedSequence", () => {
  it("routes to the sequence bound to the company's primary ICP", () => {
    const r = pickIcpScopedSequence("icp-saas", [
      { id: "seq-generic", icpId: null },
      { id: "seq-saas", icpId: "icp-saas" },
      { id: "seq-fintech", icpId: "icp-fintech" },
    ]);
    expect(r).toEqual({ sequenceId: "seq-saas", reason: "primary_icp_match" });
  });

  it("falls back to a tenant-wide sequence when no ICP-bound one matches", () => {
    const r = pickIcpScopedSequence("icp-saas", [
      { id: "seq-generic", icpId: null },
      { id: "seq-fintech", icpId: "icp-fintech" },
    ]);
    expect(r).toEqual({ sequenceId: "seq-generic", reason: "tenant_wide_fallback" });
  });

  it("falls back to tenant-wide when the company has no primary ICP", () => {
    const r = pickIcpScopedSequence(null, [
      { id: "seq-generic", icpId: null },
      { id: "seq-saas", icpId: "icp-saas" },
    ]);
    expect(r).toEqual({ sequenceId: "seq-generic", reason: "tenant_wide_fallback" });
  });

  it("returns no_match when nothing is routable", () => {
    const r = pickIcpScopedSequence("icp-saas", [
      { id: "seq-fintech", icpId: "icp-fintech" },
    ]);
    expect(r).toEqual({ sequenceId: null, reason: "no_match" });
  });

  it("returns no_match on an empty sequence list", () => {
    expect(pickIcpScopedSequence("icp-saas", [])).toEqual({
      sequenceId: null,
      reason: "no_match",
    });
  });

  it("prefers the ICP-bound sequence over a tenant-wide one (priority of specificity)", () => {
    const r = pickIcpScopedSequence("icp-saas", [
      { id: "seq-saas", icpId: "icp-saas" },
      { id: "seq-generic", icpId: null },
    ]);
    expect(r.sequenceId).toBe("seq-saas");
    expect(r.reason).toBe("primary_icp_match");
  });

  it("uses the first tenant-wide sequence when several exist", () => {
    const r = pickIcpScopedSequence(null, [
      { id: "seq-a", icpId: null },
      { id: "seq-b", icpId: null },
    ]);
    expect(r.sequenceId).toBe("seq-a");
  });
});
