import { describe, it, expect } from "vitest";
import { toInboundLinkedInMessage } from "../linkedin-capture";
import type { UnipileChat, UnipileMessage } from "@/lib/providers/unipile/http";

const chat: UnipileChat = {
  id: "chat-1",
  account_id: "acc-1",
  attendee_provider_id: "ACoAA-prospect",
  name: "Jane Prospect",
  unread_count: 1,
};
const baseMsg: UnipileMessage = {
  id: "msg-1",
  chat_id: "chat-1",
  text: "Hey, sounds interesting — can we talk Tuesday?",
  is_sender: 0,
  is_event: 0,
  timestamp: "2026-06-25T13:27:25.323Z",
};

describe("toInboundLinkedInMessage", () => {
  it("maps an inbound human message (is_sender=0) to the capture shape", () => {
    const r = toInboundLinkedInMessage(chat, baseMsg);
    expect(r).not.toBeNull();
    expect(r!.providerMessageId).toBe("msg-1");
    expect(r!.chatId).toBe("chat-1");
    expect(r!.senderProviderId).toBe("ACoAA-prospect"); // from chat.attendee_provider_id
    expect(r!.senderName).toBe("Jane Prospect");
    expect(r!.text).toContain("Tuesday");
    expect(r!.occurredAt.toISOString()).toBe("2026-06-25T13:27:25.323Z");
  });

  it("drops our own echo (is_sender=1)", () => {
    expect(toInboundLinkedInMessage(chat, { ...baseMsg, is_sender: 1 })).toBeNull();
  });

  it("drops a system event (is_event=1)", () => {
    expect(toInboundLinkedInMessage(chat, { ...baseMsg, is_event: 1 })).toBeNull();
  });

  it("drops empty / whitespace-only text", () => {
    expect(toInboundLinkedInMessage(chat, { ...baseMsg, text: "   " })).toBeNull();
    expect(toInboundLinkedInMessage(chat, { ...baseMsg, text: null })).toBeNull();
  });

  it("drops a message with a bad timestamp", () => {
    expect(toInboundLinkedInMessage(chat, { ...baseMsg, timestamp: "not-a-date" })).toBeNull();
  });

  it("falls back to the chat id when chat_id is absent on the message", () => {
    const r = toInboundLinkedInMessage(chat, { ...baseMsg, chat_id: undefined });
    expect(r!.chatId).toBe("chat-1");
  });
});
