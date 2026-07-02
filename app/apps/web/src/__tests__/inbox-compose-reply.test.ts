import { describe, it, expect } from "vitest";
import { composeReply, buildReplyPrompt, replySubjectFor, type ReplyDraft } from "@/lib/inbox/compose-reply";
import type { ThreadMessage } from "@/lib/inbox/summarize-thread";

const msgs: ThreadMessage[] = [
  { direction: "outbound", from: "me@pilae.ch", body: "Intro — worth a chat?", at: "2026-06-01T10:00:00Z" },
  { direction: "inbound", from: "anna@acme.ch", body: "Maybe — what's pricing for 20 seats?", at: "2026-06-02T10:00:00Z" },
];

describe("compose-reply (INBOX-C01/G08)", () => {
  it("indexes the thread and folds in instructions + context", () => {
    const p = buildReplyPrompt(msgs, { instructions: "Sign off as Martin.", context: "Open deal: Proposal stage." });
    expect(p).toContain("[0] You:");
    expect(p).toContain("[1] anna@acme.ch:");
    expect(p.startsWith("Sign off as Martin.")).toBe(true);
    expect(p).toContain("What you know about them: Open deal: Proposal stage.");
    // The no-already-sent guardrail must be present (casing is incidental — it
    // became a sentence-start "Never imply…" when the no-fabrication clause landed).
    expect(p.toLowerCase()).toContain("never imply the email has already been sent");
  });

  it("maps + trims a generator result", async () => {
    const gen = async (): Promise<ReplyDraft> => ({ subject: "  Re: Intro  ", text: "  20 seats is CHF X. Tue 2pm?  " });
    const d = await composeReply(msgs, {}, gen);
    expect(d).toEqual({ subject: "Re: Intro", text: "20 seats is CHF X. Tue 2pm?" });
  });

  it("returns empty for an empty thread (composer unchanged)", async () => {
    const gen = async (): Promise<ReplyDraft> => ({ subject: "x", text: "y" });
    expect(await composeReply([], {}, gen)).toEqual({ subject: "", text: "" });
  });

  it("fails closed on a generator error", async () => {
    const boom = async (): Promise<ReplyDraft> => {
      throw new Error("model down");
    };
    expect(await composeReply(msgs, {}, boom)).toEqual({ subject: "", text: "" });
  });
});

// Live audit 2026-07-02: the model rewrote the reply subject 4/4 ("Re: Bonjour",
// "Re: Pricing for your team", …) because the prompt-side "keep the subject"
// instruction is unenforceable — the model never sees the subject. The thread
// subject must win in code; the model's subject is only a fallback for
// subjectless threads (LinkedIn).
describe("compose-reply forced thread subject (audit 2026-07-02)", () => {
  const gen = async (): Promise<ReplyDraft> => ({ subject: "Re: Pricing for your team", text: "body" });

  it("the thread subject overrides the model's invented subject", async () => {
    const d = await composeReply(msgs, { threadSubject: "Re: Scaling outbound at Northwind" }, gen);
    expect(d.subject).toBe("Re: Scaling outbound at Northwind");
  });

  it("prefixes Re: when the thread subject has none", async () => {
    const d = await composeReply(msgs, { threadSubject: "Scaling outbound at Northwind" }, gen);
    expect(d.subject).toBe("Re: Scaling outbound at Northwind");
  });

  it("falls back to the model subject for subjectless threads", async () => {
    const d = await composeReply(msgs, { threadSubject: "" }, gen);
    expect(d.subject).toBe("Re: Pricing for your team");
    const d2 = await composeReply(msgs, {}, gen);
    expect(d2.subject).toBe("Re: Pricing for your team");
  });

  it("replySubjectFor keeps existing Re:/Fwd: prefixes (any case) and trims", () => {
    expect(replySubjectFor("RE: hello")).toBe("RE: hello");
    expect(replySubjectFor("fwd: docs")).toBe("fwd: docs");
    expect(replySubjectFor("  hello  ")).toBe("Re: hello");
    expect(replySubjectFor("   ")).toBe("");
  });

  it("the prompt no longer offers the 'unless a new one is clearly better' escape hatch", () => {
    const p = buildReplyPrompt(msgs);
    expect(p).not.toContain("clearly better");
    expect(p).toContain("only used when the thread has no subject");
  });

  it("the no-fabrication clause covers product facts, calendar slots and FR register", () => {
    const p = buildReplyPrompt(msgs);
    expect(p).toContain("pricing model or structure");
    expect(p).toContain("SOC 2");
    expect(p).toContain("Never propose a specific meeting date or time slot");
    expect(p).toContain('never mix "tu" and "vous"');
  });
});

// Live audit 2026-07-02 (internal same-domain thread): the user never replied
// through Elevay, so every message was inbound, the prompt carried ZERO "You"
// lines, and the model inferred the roles from the quoted history — it drafted
// AS the counterparty and opened "Salut Martin,". The fix anchors identity the
// way suggest-reply-prompt does with its FROM line: label the user's own
// messages via their mailbox addresses, and name the reply target explicitly.
describe("compose-reply role anchoring (internal-thread audit 2026-07-02)", () => {
  const internal: ThreadMessage[] = [
    {
      direction: "inbound",
      from: "Paul Madelenat <paul.madelenat@pilae.ch>",
      body: "Salut Martin, on avance sur YC ?\n\nLe 30 juin 2026, martin.paviot@pilae.ch a écrit :\n> Paul, regarde ça",
      at: "2026-07-01T10:00:00Z",
    },
  ];

  it("names the reply target + the user's own address on an all-inbound internal thread", () => {
    const p = buildReplyPrompt(internal, { selfAddresses: ["martin.paviot@pilae.ch"] });
    expect(p).toContain("The reply goes TO Paul Madelenat <paul.madelenat@pilae.ch>");
    expect(p).toContain("writing from martin.paviot@pilae.ch");
    expect(p).toContain("never greet or address yourself");
    expect(p).toContain("not the sender's own words"); // quoted-history clause
  });

  it("relabels the user's own inbound-captured messages to You and skips them as reply target", () => {
    const withOwnReply: ThreadMessage[] = [
      { direction: "inbound", from: "Paul Madelenat <paul.madelenat@pilae.ch>", body: "Question", at: "2026-07-01T10:00:00Z" },
      { direction: "inbound", from: "martin.paviot@pilae.ch", body: "Ma reponse synchronisee via IMAP", at: "2026-07-01T11:00:00Z" },
    ];
    const p = buildReplyPrompt(withOwnReply, { selfAddresses: ["MARTIN.PAVIOT@pilae.ch"] }); // case-insensitive
    expect(p).toContain("[1] You: Ma reponse synchronisee via IMAP");
    // The LATEST message is the user's own — the target must be the latest NON-self sender.
    expect(p).toContain("The reply goes TO Paul Madelenat <paul.madelenat@pilae.ch>");
  });

  it("still names the target from direction labels alone when selfAddresses is absent", () => {
    const p = buildReplyPrompt(msgs);
    expect(p).toContain("The reply goes TO anna@acme.ch");
    expect(p).not.toContain("writing from");
    // No "<a@x> <a@x>" duplication when the header has no display name.
    expect(p).not.toContain("anna@acme.ch <anna@acme.ch>");
  });

  it("omits the roles block when the thread has no identifiable counterparty", () => {
    const own: ThreadMessage[] = [{ direction: "outbound", from: "me@pilae.ch", body: "ping", at: null }];
    const p = buildReplyPrompt(own);
    expect(p).not.toContain("Roles — never confuse them");
  });

  it("handles a LinkedIn-style sender without an email address", () => {
    const li: ThreadMessage[] = [{ direction: "inbound", from: "Jane Doe", body: "hi", at: null }];
    const p = buildReplyPrompt(li, { selfAddresses: ["me@pilae.ch"] });
    expect(p).toContain("The reply goes TO Jane Doe.");
    expect(p).not.toContain("<jane doe>");
  });
});

describe("compose-reply nudge mode (B7 B3.1)", () => {
  it("nudge mode swaps to the gentle follow-up task with never-pushy / no-new-facts constraints", () => {
    const p = buildReplyPrompt(msgs, { mode: "nudge" });
    expect(p).toContain("follow-up nudge");
    expect(p).toContain("went unanswered");
    expect(p).toContain("never pushy");
    expect(p).toContain("no new facts");
    expect(p).toContain("never imply the email has already been sent"); // shared safety
    // It must NOT carry the reply task wording.
    expect(p).not.toContain("Answer their actual question");
    expect(p).not.toContain("Write a complete reply");
  });

  it("default mode is unchanged (reply task), a regression guard", () => {
    const dflt = buildReplyPrompt(msgs);
    const reply = buildReplyPrompt(msgs, { mode: "reply" });
    expect(dflt).toBe(reply);
    expect(dflt).toContain("Write a complete reply");
    expect(dflt).toContain("Answer their actual question");
    expect(dflt).not.toContain("follow-up nudge");
  });

  it("composeReply threads the nudge prompt to the generator and still trims/fails-closed", async () => {
    let seen = "";
    const gen = async (prompt: string): Promise<ReplyDraft> => {
      seen = prompt;
      return { subject: "  Re: Intro  ", text: "  Just floating this back up — still keen?  " };
    };
    const d = await composeReply(msgs, { mode: "nudge" }, gen);
    expect(seen).toContain("follow-up nudge");
    expect(d).toEqual({ subject: "Re: Intro", text: "Just floating this back up — still keen?" });
  });
});
