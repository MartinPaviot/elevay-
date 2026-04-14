// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import { useFocusTrap } from "@/hooks/use-focus-trap";

afterEach(() => {
  cleanup();
});

function Fixture({ active }: { active: boolean }) {
  const ref = useFocusTrap<HTMLDivElement>(active);
  return (
    <div>
      <button data-testid="outside-before">outside before</button>
      <div ref={ref} data-testid="container">
        <button data-testid="first">first</button>
        <input data-testid="middle" />
        <button data-testid="last">last</button>
      </div>
      <button data-testid="outside-after">outside after</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("moves focus to the first focusable child when activated", () => {
    const outsideBefore = document.createElement("button");
    document.body.appendChild(outsideBefore);
    outsideBefore.focus();

    const { getByTestId } = render(<Fixture active={true} />);
    const first = getByTestId("first") as HTMLButtonElement;
    expect(document.activeElement).toBe(first);
  });

  it("wraps Shift+Tab from the first element to the last", () => {
    const { getByTestId } = render(<Fixture active={true} />);
    const first = getByTestId("first") as HTMLButtonElement;
    const last = getByTestId("last") as HTMLButtonElement;
    first.focus();
    act(() => {
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    });
    expect(document.activeElement).toBe(last);
  });

  it("wraps Tab from the last element to the first", () => {
    const { getByTestId } = render(<Fixture active={true} />);
    const first = getByTestId("first") as HTMLButtonElement;
    const last = getByTestId("last") as HTMLButtonElement;
    last.focus();
    act(() => {
      fireEvent.keyDown(document, { key: "Tab" });
    });
    expect(document.activeElement).toBe(first);
  });

  it("ignores keys other than Tab", () => {
    const { getByTestId } = render(<Fixture active={true} />);
    const middle = getByTestId("middle") as HTMLInputElement;
    middle.focus();
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(document.activeElement).toBe(middle);
  });

  it("does not trap when inactive", () => {
    // Move focus somewhere deliberate before render so we can assert it
    // doesn't move into the container.
    const outside = document.createElement("button");
    outside.setAttribute("data-testid", "sentinel");
    document.body.appendChild(outside);
    outside.focus();

    const { getByTestId } = render(<Fixture active={false} />);
    expect(document.activeElement).toBe(outside);

    // Tab while inactive should be a no-op from the hook's perspective
    // (no key handler attached).
    act(() => {
      fireEvent.keyDown(document, { key: "Tab" });
    });
    // Still sentinel — hook didn't redirect.
    expect(document.activeElement).toBe(outside);
    void getByTestId("container"); // ensure fixture rendered
  });
});
