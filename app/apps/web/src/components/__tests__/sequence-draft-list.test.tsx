/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  SequenceDraftList,
  type DraftListItem,
} from "@/components/sequence-draft-list";

function draft(overrides: Partial<DraftListItem> = {}): DraftListItem {
  return {
    id: "d-1",
    sequenceId: "s-1",
    stepId: "step-1",
    enrollmentId: "e-1",
    contactId: "c-1",
    subject: "Quick question",
    bodyText: "Hi Sarah, saw you just shipped agent v2…",
    triggerReason: "high-intent web visit",
    status: "pending_approval",
    generatedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    reviewReason: null,
    scheduledSendAt: null,
    version: 1,
    ...overrides,
  };
}

describe("SequenceDraftList", () => {
  it("renders empty state with helpful copy per status", () => {
    render(
      <SequenceDraftList
        drafts={[]}
        selectedDraftId={null}
        onSelect={vi.fn()}
        status="pending_approval"
        onStatusChange={vi.fn()}
        hasMore={false}
        onLoadMore={vi.fn()}
        loading={false}
      />,
    );
    expect(
      screen.getByText(/No drafts awaiting review/i),
    ).toBeDefined();
  });

  it("renders draft items with subject + age + trigger reason", () => {
    render(
      <SequenceDraftList
        drafts={[draft()]}
        selectedDraftId={null}
        onSelect={vi.fn()}
        status="pending_approval"
        onStatusChange={vi.fn()}
        hasMore={false}
        onLoadMore={vi.fn()}
        loading={false}
      />,
    );
    expect(screen.getByText("Quick question")).toBeDefined();
    expect(screen.getByText(/high-intent web visit/i)).toBeDefined();
    expect(screen.getByText(/m ago/i)).toBeDefined();
  });

  it("calls onSelect when a draft card is clicked", () => {
    const onSelect = vi.fn();
    render(
      <SequenceDraftList
        drafts={[draft({ id: "click-me" })]}
        selectedDraftId={null}
        onSelect={onSelect}
        status="pending_approval"
        onStatusChange={vi.fn()}
        hasMore={false}
        onLoadMore={vi.fn()}
        loading={false}
      />,
    );
    fireEvent.click(screen.getByText("Quick question"));
    expect(onSelect).toHaveBeenCalledWith("click-me");
  });

  it("calls onStatusChange when a filter chip is clicked", () => {
    const onStatusChange = vi.fn();
    render(
      <SequenceDraftList
        drafts={[]}
        selectedDraftId={null}
        onSelect={vi.fn()}
        status="pending_approval"
        onStatusChange={onStatusChange}
        hasMore={false}
        onLoadMore={vi.fn()}
        loading={false}
      />,
    );
    fireEvent.click(screen.getByText("Rejected"));
    expect(onStatusChange).toHaveBeenCalledWith("rejected");
  });

  it("renders Load more when hasMore is true", () => {
    const onLoadMore = vi.fn();
    render(
      <SequenceDraftList
        drafts={[draft()]}
        selectedDraftId={null}
        onSelect={vi.fn()}
        status="pending_approval"
        onStatusChange={vi.fn()}
        hasMore={true}
        onLoadMore={onLoadMore}
        loading={false}
      />,
    );
    fireEvent.click(screen.getByText("Load more"));
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("disables Load more while loading", () => {
    render(
      <SequenceDraftList
        drafts={[draft()]}
        selectedDraftId={null}
        onSelect={vi.fn()}
        status="pending_approval"
        onStatusChange={vi.fn()}
        hasMore={true}
        onLoadMore={vi.fn()}
        loading={true}
      />,
    );
    const btn = screen.getByText(/Loading/i).closest("button")!;
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("shows status badge per draft (rejected differs from pending)", () => {
    render(
      <SequenceDraftList
        drafts={[draft({ id: "1", status: "rejected" })]}
        selectedDraftId={null}
        onSelect={vi.fn()}
        status="rejected"
        onStatusChange={vi.fn()}
        hasMore={false}
        onLoadMore={vi.fn()}
        loading={false}
      />,
    );
    // The "Rejected" badge appears alongside the chip filter ; ensure
    // we have at least one occurrence in the card body too.
    const allRejected = screen.getAllByText(/Rejected/i);
    expect(allRejected.length).toBeGreaterThanOrEqual(2);
  });
});
