// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen, act } from "@testing-library/react";
import { SkipLink } from "@/components/a11y/skip-link";
import { LiveRegion } from "@/components/a11y/live-region";

afterEach(() => {
  cleanup();
});

describe("SkipLink", () => {
  it("points at #main-content by default", () => {
    render(<SkipLink />);
    const link = screen.getByText(/skip to main content/i);
    expect(link.getAttribute("href")).toBe("#main-content");
  });

  it("accepts custom target + label", () => {
    render(<SkipLink targetId="chat" label="Skip to chat" />);
    const link = screen.getByText(/skip to chat/i);
    expect(link.getAttribute("href")).toBe("#chat");
  });

  it("is the first tab-stop on the page (no negative tabindex, no aria-hidden)", () => {
    const { container } = render(<SkipLink />);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("tabindex")).not.toBe("-1");
    expect(link!.hasAttribute("aria-hidden")).toBe(false);
  });
});

describe("LiveRegion", () => {
  it("renders with role=status and aria-live=polite by default", () => {
    const { container } = render(<LiveRegion message="hello" />);
    const node = container.firstElementChild as HTMLElement;
    expect(node.getAttribute("role")).toBe("status");
    expect(node.getAttribute("aria-live")).toBe("polite");
    expect(node.getAttribute("aria-atomic")).toBe("true");
  });

  it("switches to role=alert / assertive when politeness is assertive", () => {
    const { container } = render(
      <LiveRegion message="urgent" politeness="assertive" />
    );
    const node = container.firstElementChild as HTMLElement;
    expect(node.getAttribute("role")).toBe("alert");
    expect(node.getAttribute("aria-live")).toBe("assertive");
  });

  it("renders the message after the async flush", async () => {
    const { container } = render(<LiveRegion message="3 accounts selected" />);
    // allow the requestAnimationFrame inside the component to flush
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(container.textContent).toContain("3 accounts selected");
  });

  it("is visually hidden (sr-only-style positioning)", () => {
    const { container } = render(<LiveRegion message="x" />);
    const node = container.firstElementChild as HTMLElement;
    expect(node.className).toContain("sr-only");
    // Inline fallbacks cover the case where the stylesheet is absent.
    expect(node.style.position).toBe("absolute");
    expect(node.style.width).toBe("1px");
  });
});
