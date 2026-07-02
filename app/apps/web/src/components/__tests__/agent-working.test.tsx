// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { StreamingSkeleton } from "@/components/chat/streaming-skeleton";
import { ToolCallGroup, ToolCallPanel } from "@/components/tool-call-panel";

/**
 * Agent-working motion (landing language in-product): thinking dots on
 * the brand gradient's stops, gradient-swept label + gradient rail while
 * a step runs, neutral + check once settled. The animation itself is
 * CSS; these tests pin the class/state wiring so a refactor can't
 * silently drop the working-state identity.
 */

describe("StreamingSkeleton (thinking)", () => {
  it("renders the three brand-stop dots on the landing rhythm", () => {
    const { container } = render(<StreamingSkeleton />);
    const dots = container.querySelectorAll(".agent-dot");
    expect(dots).toHaveLength(3);
    const colors = [...dots].map((d) => (d as HTMLElement).style.background);
    expect(colors).toEqual(["#17C3B2", "#2C6BED", "#FF7A3D"]);
    const delays = [...dots].map((d) => (d as HTMLElement).style.animationDelay);
    expect(delays).toEqual(["0ms", "180ms", "360ms"]);
  });

  it("no skeleton bars anymore — dots say thinking, bars promised content", () => {
    const { container } = render(<StreamingSkeleton />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
  });
});

describe("ToolCallPanel states", () => {
  it("running: gradient dot + gradient-swept label, no flat accent", () => {
    const { container, getByText } = render(
      <ToolCallPanel toolName="getCallList" args={{}} result={undefined} isStreaming />,
    );
    const dot = container.querySelector(".agent-dot") as HTMLElement;
    expect(dot).not.toBeNull();
    expect(dot.style.background).toContain("var(--gradient-brand)");
    const label = getByText(/\.\.\.$/);
    expect(label.className).toContain("gradient-text-active");
  });

  it("done: neutral label with the green check, no working classes", () => {
    const { container } = render(
      <ToolCallPanel toolName="getCallList" args={{}} result={{ items: [] }} isStreaming={false} />,
    );
    expect(container.querySelector(".gradient-text-active")).toBeNull();
    expect(container.querySelector(".agent-dot")).toBeNull();
  });

  it("each step enters with the landing fade (agent-step-in)", () => {
    const { container } = render(
      <ToolCallPanel toolName="getCallList" args={{}} result={{ items: [] }} isStreaming={false} />,
    );
    expect(container.querySelector(".agent-step-in")).not.toBeNull();
  });
});

describe("ToolCallGroup rail", () => {
  const call = (isStreaming: boolean) => ({
    toolName: "getCallList",
    args: {},
    result: isStreaming ? undefined : { items: [] },
    isStreaming,
  });

  it("gradient spine while any step in the group is live", () => {
    const { container } = render(<ToolCallGroup calls={[call(false), call(true)]} />);
    expect(container.querySelector(".agent-rail-active")).not.toBeNull();
  });

  it("neutral spine once the group settles", () => {
    const { container } = render(<ToolCallGroup calls={[call(false), call(false)]} />);
    expect(container.querySelector(".agent-rail-active")).toBeNull();
  });
});
