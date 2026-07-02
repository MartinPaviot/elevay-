import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * M12-R1 (outreach-autopilot T7) — recordOutreachDecision unit contract:
 *   - exactly ONE row per outreach send, with persona / signal /
 *     message_features / gate_scores assembled from transport-available data;
 *   - a REPLY-class (or unknown-class) send records NOTHING;
 *   - best-effort by contract: a throwing/rejecting db, a missing contact or
 *     company, a duplicate (ON CONFLICT no-op) all resolve without throwing —
 *     the writer must never fail a send.
 *
 * The db is mocked; the REAL @/db/schema and drizzle-orm are used so the
 * query construction paths run for real. Select queries are routed on their
 * projection keys (gate query projects `gate`, company-only projects `props`).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

let contactRows: unknown[] = [];
let companyRows: unknown[] = [];
let gateRows: unknown[] = [];
const inserted: Array<Record<string, unknown>> = [];
let selectCalls = 0;
let selectThrows = false;
let insertThrows = false;
let insertRejects = false;

vi.mock("@/db", () => ({
  db: {
    select: (proj?: Record<string, unknown>) => {
      selectCalls++;
      if (selectThrows) throw new Error("select down");
      const keys = proj ? Object.keys(proj) : [];
      const isGateQuery = keys.includes("gate");
      const isCompanyOnly = keys.includes("props");
      return {
        from: () => ({
          // persona path: contacts leftJoin companies
          leftJoin: () => ({
            where: () => ({ limit: () => Promise.resolve(contactRows) }),
          }),
          where: () => {
            const rows = isGateQuery
              ? gateRows
              : isCompanyOnly
                ? companyRows
                : [];
            // The gate query chains .orderBy(createdAt) then awaits; the
            // company-only query chains .limit(1). Support both plus a direct
            // await for any legacy shape.
            const p = Promise.resolve(rows) as Promise<unknown[]> & {
              limit: () => Promise<unknown[]>;
              orderBy: () => Promise<unknown[]>;
            };
            p.limit = () => Promise.resolve(rows);
            p.orderBy = () => Promise.resolve(rows);
            return p;
          },
        }),
      };
    },
    insert: () => {
      if (insertThrows) throw new Error("insert down");
      return {
        values: (v: Record<string, unknown>) => ({
          onConflictDoNothing: () => {
            if (insertRejects) return Promise.reject(new Error("db down"));
            inserted.push(v);
            return Promise.resolve(undefined);
          },
        }),
      };
    },
  },
}));

import { recordOutreachDecision } from "@/lib/outreach/decision-record";

beforeEach(() => {
  contactRows = [];
  companyRows = [];
  gateRows = [];
  inserted.length = 0;
  selectCalls = 0;
  selectThrows = false;
  insertThrows = false;
  insertRejects = false;
});

const daysAgoIso = (d: number) => new Date(Date.now() - d * DAY_MS).toISOString();

function fullContactRow() {
  return {
    title: "CTO",
    contactProps: { seniority: "exec" },
    contactCompanyId: "co1",
    companySize: "11-50",
    companyIndustry: "software",
    companyProps: {
      signals: [
        // fresh (funding TTL 180d) but OLDER than the hiring one below
        { type: "funding", detectedAt: daysAgoIso(10), source: "apollo" },
        // fresh (hiring TTL 30d) and the most recent -> the FRESHEST pick
        { type: "hiring", detectedAt: daysAgoIso(5), source: "linkedin" },
        // stale (hiring_surge TTL 30d, 90 days old) -> dropped by freshness
        { type: "hiring_surge", detectedAt: daysAgoIso(90), source: "apollo" },
      ],
    },
  };
}

const fullInput = {
  tenantId: "t1",
  sendClass: "outreach",
  contactId: "c1",
  enrollmentId: "e1",
  stepIndex: 2,
  outboundEmailId: "ob1",
  toAddress: "prospect@example.com",
  subject: "Quick question",
  bodyText:
    "Saw the funding news. Would you be open to a quick call next week?",
};

describe("recordOutreachDecision — the outreach learning row", () => {
  it("outreach send writes exactly one row with persona/signal/features/gate scores populated", async () => {
    contactRows = [fullContactRow()];
    gateRows = [
      { gate: 2, score: null, verdict: "pass" },
      { gate: 4, score: 0.82, verdict: "pass" },
    ];
    const written = await recordOutreachDecision(fullInput);
    expect(written).toBe(1);
    expect(inserted).toHaveLength(1);
    const v = inserted[0];
    expect(v).toMatchObject({
      tenantId: "t1",
      contactId: "c1",
      companyId: "co1", // resolved from the contact join
      enrollmentId: "e1",
      stepIndex: 2,
      channel: "email",
      outboundEmailId: "ob1",
      // v1 nulls by design (T8 / T18 fill these)
      model: null,
      angle: null,
      alternatives: null,
      promptVersion: null,
      outcomeId: null,
    });
    expect(v.persona).toEqual({
      seniority: "exec",
      function: "CTO",
      company_size: "11-50",
      sector: "software",
      maturity: null,
    });
    // Freshest = the most recent FRESH signal (stale hiring_surge dropped).
    expect(v.signal).toMatchObject({
      type: "hiring",
      source: "linkedin",
      freshness_days: 5,
    });
    expect((v.signal as Record<string, unknown>).detected_at).toBeTruthy();
    expect(v.messageFeatures).toEqual({
      length_words: 14,
      cta_type: "meeting-ask",
      tone: null,
    });
    expect(v.gateScores).toEqual({
      g2: { score: null, verdict: "pass" },
      g4: { score: 0.82, verdict: "pass" },
      g5: null, // 'send'-row join deferred (documented v1 gap)
    });
    expect(v.scheduledAt).toBeInstanceOf(Date);
  });

  it("reply class records NOTHING (no reads, no writes)", async () => {
    contactRows = [fullContactRow()];
    const written = await recordOutreachDecision({
      ...fullInput,
      sendClass: "reply",
    });
    expect(written).toBe(0);
    expect(inserted).toHaveLength(0);
    expect(selectCalls).toBe(0);
  });

  it("unknown/absent class (legacy or mocked gate) records NOTHING", async () => {
    const written = await recordOutreachDecision({
      tenantId: "t1",
      contactId: "c1",
    });
    expect(written).toBe(0);
    expect(inserted).toHaveLength(0);
  });

  it("missing contact -> nulls, not throws; the row still writes", async () => {
    contactRows = []; // contact deleted between gate and write
    gateRows = [];
    const written = await recordOutreachDecision(fullInput);
    expect(written).toBe(1);
    expect(inserted[0]).toMatchObject({
      contactId: "c1",
      companyId: null,
      persona: null,
      signal: null,
      gateScores: null,
    });
    // Transport-available features never depend on the lookups.
    expect(inserted[0].messageFeatures).toMatchObject({ cta_type: "meeting-ask" });
  });

  it("no contactId but a companyId -> company half of the persona + signal context", async () => {
    companyRows = [
      {
        size: "201-500",
        industry: "fintech",
        props: { signals: [{ type: "funding", detectedAt: daysAgoIso(3) }] },
      },
    ];
    const written = await recordOutreachDecision({
      tenantId: "t1",
      sendClass: "outreach",
      companyId: "co9",
      bodyText: "Take a look: https://example.com/product",
    });
    expect(written).toBe(1);
    expect(inserted[0].companyId).toBe("co9");
    expect(inserted[0].persona).toEqual({
      seniority: null,
      function: null,
      company_size: "201-500",
      sector: "fintech",
      maturity: null,
    });
    expect(inserted[0].signal).toMatchObject({ type: "funding", freshness_days: 3 });
    expect(inserted[0].messageFeatures).toMatchObject({ cta_type: "link-click" });
  });

  it("no gate_decisions rows for the outbound row -> gate_scores null", async () => {
    contactRows = [fullContactRow()];
    gateRows = [];
    await recordOutreachDecision(fullInput);
    expect(inserted[0].gateScores).toBeNull();
  });

  it("only stale signals -> signal null", async () => {
    const row = fullContactRow();
    (row.companyProps as { signals: unknown[] }).signals = [
      { type: "hiring", detectedAt: daysAgoIso(90) }, // TTL 30d -> stale
    ];
    contactRows = [row];
    await recordOutreachDecision(fullInput);
    expect(inserted[0].signal).toBeNull();
  });

  it("best-effort: a THROWING db.select degrades to nulls and still writes", async () => {
    selectThrows = true;
    const written = await recordOutreachDecision(fullInput);
    expect(written).toBe(1);
    expect(inserted[0]).toMatchObject({ persona: null, signal: null, gateScores: null });
  });

  it("best-effort: a THROWING db.insert resolves 0, never throws", async () => {
    contactRows = [fullContactRow()];
    insertThrows = true;
    await expect(recordOutreachDecision(fullInput)).resolves.toBe(0);
  });

  it("best-effort: a REJECTING insert (transport-level conflict/outage) resolves 0, never throws", async () => {
    contactRows = [fullContactRow()];
    insertRejects = true;
    await expect(recordOutreachDecision(fullInput)).resolves.toBe(0);
    expect(inserted).toHaveLength(0);
  });

  it("duplicate (ON CONFLICT DO NOTHING no-op) resolves without throwing — Inngest-retry safe", async () => {
    contactRows = [fullContactRow()];
    // The server silently no-ops a duplicate key; the client sees a normal
    // resolution — same call twice must not throw and must not error.
    await expect(recordOutreachDecision(fullInput)).resolves.toBe(1);
    await expect(recordOutreachDecision(fullInput)).resolves.toBe(1);
  });

  it("minimal input (C5 shape: no ids, no outbound row) writes a null-keyed row", async () => {
    const written = await recordOutreachDecision({
      tenantId: "t1",
      sendClass: "outreach",
      toAddress: "attendee@example.com",
      subject: "Recap",
      bodyText: "Thanks for the time today. Notes attached below.",
    });
    expect(written).toBe(1);
    expect(inserted[0]).toMatchObject({
      tenantId: "t1",
      contactId: null,
      companyId: null,
      enrollmentId: null,
      stepIndex: null,
      outboundEmailId: null, // C5 dedup key is null by design (documented)
      persona: null,
      signal: null,
      gateScores: null,
    });
  });
});
