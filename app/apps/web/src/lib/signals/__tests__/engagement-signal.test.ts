import { describe, expect, it, vi, beforeEach } from "vitest";

// Spy on the underlying writer (vi.hoisted so it exists when the hoisted
// vi.mock factory runs).
const { recordCompanySignal } = vi.hoisted(() => ({
  recordCompanySignal: vi.fn((_tenantId: string, _companyId: string, _entry: Record<string, unknown>): Promise<void> => Promise.resolve()),
}));
vi.mock("../record-signal", () => ({ recordCompanySignal }));

// Mock the drizzle db so db.select().from().where().limit() resolves to `rows`.
let rows: Array<{ companyId: string | null }> = [];
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => rows }),
      }),
    }),
  },
}));

import { recordEngagementSignal } from "../engagement-signal";

beforeEach(() => {
  recordCompanySignal.mockClear();
  rows = [];
});

describe("recordEngagementSignal", () => {
  it("no-ops when contactId is missing", async () => {
    await recordEngagementSignal("t1", null, "email_opened");
    await recordEngagementSignal("t1", undefined, "email_opened");
    expect(recordCompanySignal).not.toHaveBeenCalled();
  });

  it("uses a provided companyId (no lookup) and names the contact as the signal person", async () => {
    await recordEngagementSignal("t1", "c1", "demo_request", { companyId: "co1", strength: "high" });
    expect(recordCompanySignal).toHaveBeenCalledTimes(1);
    const [tenantId, companyId, entry] = recordCompanySignal.mock.calls[0];
    expect(tenantId).toBe("t1");
    expect(companyId).toBe("co1");
    expect(entry.type).toBe("demo_request");
    expect(entry.strength).toBe("high");
    expect(entry.source).toBe("engagement");
    expect(entry.person).toEqual({ contactId: "c1" });
    expect(typeof entry.detectedAt).toBe("string");
  });

  it("resolves the company from the contact when no companyId is given", async () => {
    rows = [{ companyId: "co-resolved" }];
    await recordEngagementSignal("t1", "c1", "email_clicked");
    expect(recordCompanySignal).toHaveBeenCalledTimes(1);
    expect(recordCompanySignal.mock.calls[0][1]).toBe("co-resolved");
  });

  it("no-ops when the contact has no company (the signal is account-level)", async () => {
    rows = [{ companyId: null }];
    await recordEngagementSignal("t1", "c1", "email_opened");
    expect(recordCompanySignal).not.toHaveBeenCalled();
  });

  it("no-ops when the contact is not found", async () => {
    rows = [];
    await recordEngagementSignal("t1", "missing", "email_opened");
    expect(recordCompanySignal).not.toHaveBeenCalled();
  });
});
