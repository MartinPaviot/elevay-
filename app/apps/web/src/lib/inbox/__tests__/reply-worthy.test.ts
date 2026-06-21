import { describe, it, expect } from "vitest";
import { isReplyWorthy, type ReplyWorthyInput } from "../reply-worthy";

/**
 * B1 selectivity gate. Cases cite the QUALITY-BENCH evidence (the real inbound
 * mail that motivated the gate): bulk welcome mails, an OTP, a newsletter,
 * notifications/receipts should NOT get a draft; real human business mail
 * (the "Benjamin Macé insurance quote" case) and any ambiguous human mail
 * SHOULD (recall bias).
 */

const base: ReplyWorthyInput = {
  isMachineSent: false,
  generalIntent: null,
  isBulk: false,
};

describe("isReplyWorthy — step 1: machine-sent", () => {
  it('QUALITY-BENCH "Welcome to Superhuman" bulk welcome (noreply@) → NOT worthy', () => {
    const r = isReplyWorthy({ ...base, isMachineSent: true, isBulk: true, generalIntent: "promotion_newsletter" });
    expect(r.replyWorthy).toBe(false);
    expect(r.reasons).toEqual(["machine-sent sender"]);
  });

  it('QUALITY-BENCH "Welcome to Resend" bulk welcome (machine-sent) → NOT worthy', () => {
    const r = isReplyWorthy({ ...base, isMachineSent: true, isBulk: true, generalIntent: "fyi_update" });
    expect(r.replyWorthy).toBe(false);
    expect(r.reasons).toEqual(["machine-sent sender"]);
  });

  it('QUALITY-BENCH HubSpot OTP (noreply, security/account) → NOT worthy (machine-sent wins first)', () => {
    const r = isReplyWorthy({ ...base, isMachineSent: true, generalIntent: "security_account" });
    expect(r.replyWorthy).toBe(false);
    expect(r.reasons).toEqual(["machine-sent sender"]);
  });
});

describe("isReplyWorthy — step 2: no-reply intent / bulk gate", () => {
  it("automated_no_reply intent (human-typed addr but no-reply content) → NOT worthy", () => {
    const r = isReplyWorthy({ ...base, generalIntent: "automated_no_reply" });
    expect(r.replyWorthy).toBe(false);
    expect(r.reasons).toEqual(["no-reply intent", "intent: automated_no_reply"]);
  });

  it("QUALITY-BENCH newsletter (promotion_newsletter intent, not flagged machine) → NOT worthy", () => {
    const r = isReplyWorthy({ ...base, generalIntent: "promotion_newsletter" });
    expect(r.replyWorthy).toBe(false);
    expect(r.reasons).toEqual(["no-reply intent", "intent: promotion_newsletter"]);
  });

  it("notification intent → NOT worthy", () => {
    const r = isReplyWorthy({ ...base, generalIntent: "notification" });
    expect(r.replyWorthy).toBe(false);
    expect(r.reasons).toEqual(["no-reply intent", "intent: notification"]);
  });

  it("receipt_confirmation intent (order/booking receipt) → NOT worthy", () => {
    const r = isReplyWorthy({ ...base, generalIntent: "receipt_confirmation" });
    expect(r.replyWorthy).toBe(false);
    expect(r.reasons).toEqual(["no-reply intent", "intent: receipt_confirmation"]);
  });

  it("invoice_billing intent (folded into no-reply family) → NOT worthy", () => {
    const r = isReplyWorthy({ ...base, generalIntent: "invoice_billing" });
    expect(r.replyWorthy).toBe(false);
    expect(r.reasons).toEqual(["no-reply intent", "intent: invoice_billing"]);
  });

  it("security_account intent without machine flag (account notice) → NOT worthy", () => {
    const r = isReplyWorthy({ ...base, generalIntent: "security_account" });
    expect(r.replyWorthy).toBe(false);
    expect(r.reasons).toEqual(["no-reply intent", "intent: security_account"]);
  });

  it("bulk mail with non-human intent (fyi_update) → NOT worthy (bulk gate)", () => {
    const r = isReplyWorthy({ ...base, isBulk: true, generalIntent: "fyi_update" });
    expect(r.replyWorthy).toBe(false);
    expect(r.reasons).toEqual(["bulk/marketing mail"]);
  });

  it("bulk mail with null intent → NOT worthy (bulk gate)", () => {
    const r = isReplyWorthy({ ...base, isBulk: true, generalIntent: null });
    expect(r.replyWorthy).toBe(false);
    expect(r.reasons).toEqual(["bulk/marketing mail"]);
  });

  it("bulk-flagged BUT human-response intent (question) → still worthy (human wins over bulk)", () => {
    const r = isReplyWorthy({ ...base, isBulk: true, generalIntent: "question" });
    expect(r.replyWorthy).toBe(true);
    expect(r.reasons).toEqual(["human-response intent", "intent: question"]);
  });
});

describe("isReplyWorthy — step 3: human-response intents → worthy", () => {
  it('QUALITY-BENCH "Benjamin Macé insurance quote" — real human business email (request_action) → worthy', () => {
    const r = isReplyWorthy({ ...base, generalIntent: "request_action" });
    expect(r.replyWorthy).toBe(true);
    expect(r.reasons).toEqual(["human-response intent", "intent: request_action"]);
  });

  it("a real human question → worthy", () => {
    const r = isReplyWorthy({ ...base, generalIntent: "question" });
    expect(r.replyWorthy).toBe(true);
    expect(r.reasons).toEqual(["human-response intent", "intent: question"]);
  });

  it("meeting_request → worthy", () => {
    const r = isReplyWorthy({ ...base, generalIntent: "meeting_request" });
    expect(r.replyWorthy).toBe(true);
    expect(r.reasons).toEqual(["human-response intent", "intent: meeting_request"]);
  });

  it("scheduling → worthy", () => {
    const r = isReplyWorthy({ ...base, generalIntent: "scheduling" });
    expect(r.replyWorthy).toBe(true);
    expect(r.reasons).toEqual(["human-response intent", "intent: scheduling"]);
  });

  it("sales_reply → worthy", () => {
    const r = isReplyWorthy({ ...base, generalIntent: "sales_reply" });
    expect(r.replyWorthy).toBe(true);
    expect(r.reasons).toEqual(["human-response intent", "intent: sales_reply"]);
  });

  it("support_request → worthy", () => {
    const r = isReplyWorthy({ ...base, generalIntent: "support_request" });
    expect(r.replyWorthy).toBe(true);
    expect(r.reasons).toEqual(["human-response intent", "intent: support_request"]);
  });

  it("personal → worthy", () => {
    const r = isReplyWorthy({ ...base, generalIntent: "personal" });
    expect(r.replyWorthy).toBe(true);
    expect(r.reasons).toEqual(["human-response intent", "intent: personal"]);
  });
});

describe("isReplyWorthy — step 4: ambiguous human mail → worthy (recall bias)", () => {
  it("no clear intent (null), not bulk, not machine → worthy", () => {
    const r = isReplyWorthy({ ...base, generalIntent: null });
    expect(r.replyWorthy).toBe(true);
    expect(r.reasons).toEqual(["default human mail (recall bias)", "intent: unknown"]);
  });

  it("fyi_update (ambiguous but human), not bulk → worthy", () => {
    const r = isReplyWorthy({ ...base, generalIntent: "fyi_update" });
    expect(r.replyWorthy).toBe(true);
    expect(r.reasons).toEqual(["default human mail (recall bias)", "intent: fyi_update"]);
  });

  it("social (ambiguous but human), not bulk → worthy", () => {
    const r = isReplyWorthy({ ...base, generalIntent: "social" });
    expect(r.replyWorthy).toBe(true);
    expect(r.reasons).toEqual(["default human mail (recall bias)", "intent: social"]);
  });
});
