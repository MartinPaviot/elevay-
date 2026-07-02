// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRef } from "react";
import { render, cleanup, act, fireEvent } from "@testing-library/react";

/**
 * EmailComposerPanel renders two ways from ONE component:
 *  - drawer (default): a right-edge slide-over, portalled to <body>, with a
 *    page-dimming backdrop. Used by standalone "new email" compose.
 *  - inline: an in-flow block (Gmail/Outlook reply pinned under the thread),
 *    no portal, no backdrop. Used by the inbox reply.
 * These tests pin that the `inline` prop flips between the two without leaking
 * the fixed drawer chrome into the inline path.
 */

const { toastApi } = vi.hoisted(() => ({ toastApi: { toast: () => {} } }));
vi.mock("@/components/ui/toast", () => ({
  useToast: () => toastApi,
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { EmailComposerPanel, type EmailComposerDraft, type EmailComposerHandle } from "@/components/email-composer-panel";

const DRAFT: EmailComposerDraft = {
  to: "marie@ems.ch",
  subject: "Re: demo",
  body: "Bonjour Marie,",
};

async function flush() {
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EmailComposerPanel — inline vs drawer", () => {
  it("inline: renders in the document flow — no slide-over drawer, no backdrop", async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<EmailComposerPanel draft={DRAFT} inline onClose={() => {}} />));
    });
    await flush();

    // The fixed slide-over chrome must be absent everywhere.
    expect(document.querySelector(".slide-in-right")).toBeNull();
    // No page-dimming backdrop (the thread stays interactive behind the reply).
    expect(document.querySelector('[style*="overlay-fade-in"]')).toBeNull();
    // The composer body renders INSIDE the caller's container (not portalled away).
    expect(container.querySelector("textarea")).not.toBeNull();
    // The inline composer is an in-flow CARD in the pane's single scroll — it
    // must NOT nest its own scroll container (a nested scrollbar would fight
    // the pane's and re-create the draft/thread seam the founder rejected,
    // UI pass 2026-07-02). Send stays reachable because the PANE scrolls.
    expect(container.querySelector(".overflow-y-auto")).toBeNull();
    expect(container.firstElementChild?.className).toContain("rounded-lg");
  });

  it("inline: the writing area has a generous viewport-scaled floor (not the old cramped 88px)", async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<EmailComposerPanel draft={DRAFT} inline onClose={() => {}} />));
    });
    await flush();
    const ta = container.querySelector("textarea")!;
    // Founder: "la zone où j'écris n'est pas très grande." The inline reply is now
    // the pane's primary area, so the floor scales with the viewport, not 88px.
    expect(ta.style.minHeight).toContain("clamp");
    expect(ta.style.minHeight).toContain("30vh");
    expect(ta.style.minHeight).not.toBe("88px");
  });

  it("imperative handle reaches the textarea: tone setBody, snippet appendBody, booked appendMeetingLink", async () => {
    const ref = createRef<EmailComposerHandle>();
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<EmailComposerPanel ref={ref} draft={DRAFT} inline onClose={() => {}} />));
    });
    await flush();
    const ta = () => container.querySelector("textarea")! as HTMLTextAreaElement;
    expect(ta().value).toBe("Bonjour Marie,");

    // Tone switcher replaces the body.
    await act(async () => { ref.current!.setBody("Salut Marie !"); });
    expect(ta().value).toBe("Salut Marie !");

    // Snippet insertion appends below the current body.
    await act(async () => { ref.current!.appendBody("Tarifs en pièce jointe."); });
    expect(ta().value).toContain("Salut Marie !");
    expect(ta().value).toContain("Tarifs en pièce jointe.");

    // Booking a meeting injects the sovereign join link (INBOX-G10) into the reply.
    await act(async () => { ref.current!.appendMeetingLink("https://visio.example/xyz"); });
    expect(ta().value).toContain("https://visio.example/xyz");

    // getBody returns the live edited value.
    expect(ref.current!.getBody()).toBe(ta().value);
  });

  it("owns its body: a draft.body prop change AFTER mount is ignored (edits must use the handle)", async () => {
    let container!: HTMLElement;
    let rerender!: (ui: React.ReactElement) => void;
    await act(async () => {
      ({ container, rerender } = render(
        <EmailComposerPanel draft={{ to: "a@b.io", subject: "Re", body: "first" }} inline onClose={() => {}} />,
      ));
    });
    await flush();
    expect(container.querySelector("textarea")!.value).toBe("first");
    await act(async () => {
      rerender(<EmailComposerPanel draft={{ to: "a@b.io", subject: "Re", body: "SECOND" }} inline onClose={() => {}} />);
    });
    // editBody is seeded once; the panel intentionally ignores later draft.body
    // mutations (that was the latent bug — onBooked mutated the prop and nothing
    // reached the textarea). External edits now go through the imperative handle.
    expect(container.querySelector("textarea")!.value).toBe("first");
  });

  it("flushes the in-progress draft to localStorage on unmount (no lost keystrokes on close)", async () => {
    const store: Record<string, string> = {};
    const setItem = vi.fn((k: string, v: string) => { store[k] = v; });
    vi.stubGlobal("localStorage", { getItem: (k: string) => store[k] ?? null, setItem, removeItem: () => {}, clear: () => {} });

    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(<EmailComposerPanel draft={{ to: "", subject: "", body: "" }} inline onClose={() => {}} />);
    });
    await flush();
    const textarea = result.container.querySelector("textarea")!;
    await act(async () => {
      fireEvent.change(textarea, { target: { value: "Bonjour, dernier mot tapé" } });
    });
    // Unmount immediately (before the 800ms debounce fires) — the flush-on-unmount
    // must still persist the latest body so a click-away close loses nothing.
    setItem.mockClear();
    await act(async () => { result.unmount(); });
    expect(setItem).toHaveBeenCalled();
    expect(JSON.stringify(store)).toContain("dernier mot");
  });

  it("drawer (default): portals a slide-over + backdrop to <body>", async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<EmailComposerPanel draft={DRAFT} onClose={() => {}} />));
    });
    await flush();

    // The drawer is portalled to <body>, so it is OUTSIDE the render container…
    expect(container.querySelector(".slide-in-right")).toBeNull();
    // …but present in the document, alongside a dimming backdrop.
    expect(document.querySelector(".slide-in-right")).not.toBeNull();
    expect(document.querySelector('[style*="overlay-fade-in"]')).not.toBeNull();
  });
});
