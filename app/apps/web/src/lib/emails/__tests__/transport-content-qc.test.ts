import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * M13-G5 (T3) — the transport content QC profile. Pins: the text basis
 * (bodyText first, tag-stripped HTML fallback); the pre-footer link budget
 * (counted on the STORED body — the unsubscribe footer is appended after the
 * gate and never counts); the unsubscribe-mechanism rule (provided by the
 * path OR mentioned in the body); failure codes. Spam scoring itself belongs
 * to email-spam-check's own tests — mocked here to drive the threshold.
 */

const spamState = vi.hoisted(() => ({
  score: 0,
  warnings: [] as Array<{ code: string }>,
  lastArgs: null as null | { subject: string; body: string },
}));
vi.mock("@/lib/emails/email-spam-check", () => ({
  checkSpamSignals: vi.fn((subject: string, body: string) => {
    spamState.lastArgs = { subject, body };
    return { score: spamState.score, severity: "clean", warnings: spamState.warnings };
  }),
}));

import {
  runTransportContentQc,
  stripHtmlToText,
  TRANSPORT_MAX_LINKS,
  TRANSPORT_MAX_SPAM_SCORE,
} from "@/lib/emails/transport-content-qc";

beforeEach(() => {
  spamState.score = 0;
  spamState.warnings = [];
  spamState.lastArgs = null;
});

const CLEAN = {
  subject: "Question about your GTM ramp",
  bodyText: "Bonjour, felicitations pour votre levee. Pour vous desinscrire, repondez stop.",
  unsubscribeProvided: true,
};

describe("runTransportContentQc", () => {
  it("passes a clean body", () => {
    expect(runTransportContentQc(CLEAN)).toEqual({ passed: true, failures: [] });
  });

  it("blocks at the spam threshold with the warning codes in the failure", () => {
    spamState.score = TRANSPORT_MAX_SPAM_SCORE;
    spamState.warnings = [{ code: "spammy-phrase" }];
    const r = runTransportContentQc(CLEAN);
    expect(r.passed).toBe(false);
    expect(r.failures).toEqual(["spam:spammy-phrase"]);
  });

  it("uses bodyText as the spam basis when present, stripped HTML otherwise", () => {
    runTransportContentQc({ ...CLEAN, bodyText: "plain text wins", bodyHtml: "<p>html</p>" });
    expect(spamState.lastArgs?.body).toBe("plain text wins");
    runTransportContentQc({ ...CLEAN, bodyText: null, bodyHtml: "<p>Hello <b>there</b></p>" });
    expect(spamState.lastArgs?.body).toBe("Hello there");
  });

  it("blocks above the pre-footer link budget, counting anchors in the HTML source", () => {
    // Relative hrefs: countLinks counts each anchor ONCE (an absolute href
    // would also match the raw-URL regex and double-count — its documented
    // behavior, covered by qc.ts's own tests).
    const links = Array.from({ length: TRANSPORT_MAX_LINKS + 1 }, (_, i) => `<a href="/x${i}">x</a>`).join(" ");
    const r = runTransportContentQc({ ...CLEAN, bodyHtml: `<p>hi ${links}</p>` });
    expect(r.passed).toBe(false);
    expect(r.failures[0]).toMatch(/^links:4>max3$/);
  });

  it("allows exactly the budget (the unsubscribe footer is appended AFTER this check)", () => {
    const links = Array.from({ length: TRANSPORT_MAX_LINKS }, (_, i) => `https://x${i}.com`).join(" ");
    expect(runTransportContentQc({ ...CLEAN, bodyText: `hi ${links}` }).passed).toBe(true);
  });

  it("blocks when NO unsubscribe mechanism exists: not provided by the path, not mentioned in the body", () => {
    const r = runTransportContentQc({
      subject: "s",
      bodyText: "Bonjour, on se voit demain pour parler produit.",
      unsubscribeProvided: false,
    });
    expect(r.passed).toBe(false);
    expect(r.failures).toEqual(["unsubscribe:missing"]);
  });

  it("passes without the path mechanism when the body carries an opt-out mention (EN and FR)", () => {
    for (const mention of ["reply to unsubscribe", "repondez pour vous désinscrire", "se désabonner ici", "opt-out anytime", "opt out anytime"]) {
      const r = runTransportContentQc({
        subject: "s",
        bodyText: `Bonjour. ${mention}.`,
        unsubscribeProvided: false,
      });
      expect(r.passed, mention).toBe(true);
    }
  });

  it("reports multiple failures at once", () => {
    spamState.score = 100;
    spamState.warnings = [{ code: "x" }];
    const r = runTransportContentQc({
      subject: "s",
      bodyText: "aucune mention ici https://a.com https://b.com https://c.com https://d.com",
      unsubscribeProvided: false,
    });
    expect(r.passed).toBe(false);
    expect(r.failures).toHaveLength(3);
  });
});

describe("stripHtmlToText", () => {
  it("drops tags, style and script blocks, decodes basic entities", () => {
    expect(
      stripHtmlToText('<style>.a{color:red}</style><p>Hi&nbsp;<b>you</b> &amp; team</p><script>x()</script>'),
    ).toBe("Hi you & team");
  });
});
