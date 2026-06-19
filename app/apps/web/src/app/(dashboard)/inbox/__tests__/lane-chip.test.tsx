// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LaneChip, CountBadge } from "../_lane-chip";

describe("LaneChip", () => {
  it("renders the label + a count pill, fires onClick", () => {
    const onClick = vi.fn();
    render(<LaneChip label="Attention" count={5} active={false} onClick={onClick} />);
    expect(screen.getByText("Attention")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    screen.getByRole("button").click();
    expect(onClick).toHaveBeenCalled();
  });

  it("active vs inactive use the accent vs tertiary branch", () => {
    const { rerender } = render(<LaneChip label="Done" count={0} active={false} onClick={vi.fn()} />);
    const inactive = screen.getByRole("button").getAttribute("style") ?? "";
    expect(inactive).toContain("var(--color-text-tertiary)");
    rerender(<LaneChip label="Done" count={0} active={true} onClick={vi.fn()} />);
    const active = screen.getByRole("button").getAttribute("style") ?? "";
    expect(active).toContain("var(--color-accent)");
  });

  it("omits the count pill when count is 0 or absent", () => {
    render(<LaneChip label="Empty" count={0} active={false} onClick={vi.fn()} />);
    expect(screen.queryByText("0")).toBeNull();
  });
});

describe("CountBadge", () => {
  it("renders the number when > 0, nothing at 0", () => {
    const { container, rerender } = render(<CountBadge count={42} />);
    expect(screen.getByText("42")).toBeTruthy();
    rerender(<CountBadge count={0} />);
    expect(container.textContent).toBe("");
  });
});
