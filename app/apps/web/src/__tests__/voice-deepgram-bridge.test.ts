import { describe, it, expect, vi } from "vitest";
import {
  openBridge,
  type ListenLiveLike,
  type TranscriptChunk,
  type TwilioMediaStreamEvent,
} from "@/lib/voice/deepgram-bridge";

/**
 * The bridge is wire-format agnostic. We feed it parsed Twilio events
 * and a fake Deepgram connection, then assert the persistence layer
 * sees the right transcript chunks.
 */

function makeFakeDeepgram(): {
  conn: ListenLiveLike;
  fire: (event: string, data: unknown) => void;
  sent: Buffer[];
  finished: boolean;
} {
  const handlers = new Map<string, Array<(data: unknown) => void>>();
  const sent: Buffer[] = [];
  let finished = false;
  const conn: ListenLiveLike = {
    send(buf) {
      sent.push(Buffer.from(buf as Buffer));
    },
    finish() {
      finished = true;
    },
    on(event, handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    removeAllListeners() {
      handlers.clear();
    },
  };
  function fire(event: string, data: unknown) {
    const list = handlers.get(event) ?? [];
    for (const h of list) h(data);
  }
  return {
    conn,
    fire,
    sent,
    get finished() {
      return finished;
    },
  };
}

function mediaFrame(payloadBytes: number[]): TwilioMediaStreamEvent {
  return {
    event: "media",
    media: {
      track: "inbound",
      chunk: "1",
      timestamp: "0",
      payload: Buffer.from(payloadBytes).toString("base64"),
    },
  };
}

describe("openBridge — Twilio frames", () => {
  it("forwards media payloads to Deepgram as decoded buffers", async () => {
    const fake = makeFakeDeepgram();
    const chunks: TranscriptChunk[] = [];
    const bridge = await openBridge(
      "call_1",
      {
        openDeepgram: async () => fake.conn,
        appendChunk: async (_id, c) => {
          chunks.push(c);
        },
      },
    );

    await bridge.onTwilioEvent(mediaFrame([0xff, 0x7f, 0x00]));
    await bridge.onTwilioEvent(mediaFrame([0x01, 0x02]));

    expect(fake.sent.length).toBe(2);
    expect(fake.sent[0]).toEqual(Buffer.from([0xff, 0x7f, 0x00]));
    expect(fake.sent[1]).toEqual(Buffer.from([0x01, 0x02]));
    expect(chunks).toEqual([]);
  });

  it("ignores non-media events for audio routing", async () => {
    const fake = makeFakeDeepgram();
    const bridge = await openBridge("call_2", {
      openDeepgram: async () => fake.conn,
      appendChunk: async () => {},
    });
    await bridge.onTwilioEvent({ event: "connected" });
    await bridge.onTwilioEvent({
      event: "start",
      start: {
        streamSid: "s",
        accountSid: "a",
        callSid: "c",
        tracks: ["inbound"],
        mediaFormat: { encoding: "mulaw", sampleRate: 8000, channels: 1 },
      },
    });
    expect(fake.sent.length).toBe(0);
  });

  it("closes the Deepgram connection on stop event", async () => {
    const fake = makeFakeDeepgram();
    const bridge = await openBridge("call_3", {
      openDeepgram: async () => fake.conn,
      appendChunk: async () => {},
    });
    await bridge.onTwilioEvent({
      event: "stop",
      stop: { accountSid: "a", callSid: "c" },
    });
    expect(fake.finished).toBe(true);
  });
});

describe("openBridge — Deepgram results", () => {
  it("appends only final chunks (skips interim)", async () => {
    const fake = makeFakeDeepgram();
    const chunks: TranscriptChunk[] = [];
    await openBridge("call_4", {
      openDeepgram: async () => fake.conn,
      appendChunk: async (_id, c) => {
        chunks.push(c);
      },
    });

    fake.fire("Results", {
      is_final: false,
      channel: { alternatives: [{ transcript: "interim text" }] },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(chunks.length).toBe(0);

    fake.fire("Results", {
      is_final: true,
      start: 1.5,
      channel: {
        alternatives: [
          {
            transcript: "Bonjour Martin",
            words: [
              { word: "Bonjour", speaker: 0 },
              { word: "Martin", speaker: 0 },
            ],
          },
        ],
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toBe("Bonjour Martin");
    expect(chunks[0].speaker).toBe("agent");
    expect(chunks[0].tsMs).toBe(1500);
  });

  it("maps speaker 0 to agent and speaker 1 to prospect", async () => {
    const fake = makeFakeDeepgram();
    const chunks: TranscriptChunk[] = [];
    await openBridge("call_5", {
      openDeepgram: async () => fake.conn,
      appendChunk: async (_id, c) => {
        chunks.push(c);
      },
    });

    fake.fire("Results", {
      is_final: true,
      start: 4.2,
      channel: {
        alternatives: [
          {
            transcript: "Oui, on regarde Outreach.",
            words: [
              { word: "Oui", speaker: 1 },
              { word: "on", speaker: 1 },
              { word: "regarde", speaker: 1 },
              { word: "Outreach", speaker: 1 },
            ],
          },
        ],
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(chunks[0].speaker).toBe("prospect");
  });

  it("falls back to unknown when no speaker info is present", async () => {
    const fake = makeFakeDeepgram();
    const chunks: TranscriptChunk[] = [];
    await openBridge("call_6", {
      openDeepgram: async () => fake.conn,
      appendChunk: async (_id, c) => {
        chunks.push(c);
      },
    });

    fake.fire("Results", {
      is_final: true,
      channel: {
        alternatives: [{ transcript: "Unattributed text" }],
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(chunks[0].speaker).toBe("unknown");
  });

  it("skips empty transcripts (silence chunks)", async () => {
    const fake = makeFakeDeepgram();
    const chunks: TranscriptChunk[] = [];
    await openBridge("call_7", {
      openDeepgram: async () => fake.conn,
      appendChunk: async (_id, c) => {
        chunks.push(c);
      },
    });

    fake.fire("Results", {
      is_final: true,
      channel: { alternatives: [{ transcript: "   " }] },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(chunks.length).toBe(0);
  });

  it("survives a DB append failure without crashing", async () => {
    const fake = makeFakeDeepgram();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await openBridge("call_8", {
      openDeepgram: async () => fake.conn,
      appendChunk: async () => {
        throw new Error("db down");
      },
    });

    fake.fire("Results", {
      is_final: true,
      channel: { alternatives: [{ transcript: "hello" }] },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("openBridge — lifecycle", () => {
  it("close() finishes Deepgram and stops appending", async () => {
    const fake = makeFakeDeepgram();
    const chunks: TranscriptChunk[] = [];
    const bridge = await openBridge("call_9", {
      openDeepgram: async () => fake.conn,
      appendChunk: async (_id, c) => {
        chunks.push(c);
      },
    });
    await bridge.close();
    expect(fake.finished).toBe(true);

    // After close, late Deepgram events must not append.
    fake.fire("Results", {
      is_final: true,
      channel: { alternatives: [{ transcript: "late" }] },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(chunks.length).toBe(0);
  });
});
