/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SequenceDraftRejectModal } from "@/components/sequence-draft-reject-modal";

describe("SequenceDraftRejectModal", () => {
  it("doesn't render when closed", () => {
    render(
      <SequenceDraftRejectModal
        open={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        recipientName="Sarah"
      />,
    );
    expect(screen.queryByText(/Reject draft/i)).toBeNull();
  });

  it("renders title + recipient when open", () => {
    render(
      <SequenceDraftRejectModal
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        recipientName="Sarah"
      />,
    );
    expect(screen.getAllByText(/Reject draft/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sarah/i)).toBeDefined();
  });

  it("disables submit when reason is empty", () => {
    render(
      <SequenceDraftRejectModal
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        recipientName="Sarah"
      />,
    );
    const btn = screen
      .getAllByText(/Reject draft/i)
      .map((el) => el.closest("button"))
      .find((b) => b !== null) as HTMLButtonElement;
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("enables submit when reason is 3-200 chars", () => {
    render(
      <SequenceDraftRejectModal
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        recipientName="Sarah"
      />,
    );
    const textarea = screen.getByPlaceholderText(/tone is too direct/i);
    fireEvent.change(textarea, { target: { value: "Tone too aggressive" } });
    const btn = screen
      .getAllByText(/Reject draft/i)
      .map((el) => el.closest("button"))
      .find((b) => b && !b.hasAttribute("disabled")) as HTMLButtonElement;
    expect(btn).toBeDefined();
    expect(btn.hasAttribute("disabled")).toBe(false);
  });

  it("shows too-short error when reason has < 3 chars", () => {
    render(
      <SequenceDraftRejectModal
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        recipientName="Sarah"
      />,
    );
    const textarea = screen.getByPlaceholderText(/tone is too direct/i);
    fireEvent.change(textarea, { target: { value: "ab" } });
    expect(screen.getByText(/Min 3 characters/i)).toBeDefined();
  });

  it("calls onSubmit with reason + pauseEnrollment, closes on success", async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }));
    const onClose = vi.fn();
    render(
      <SequenceDraftRejectModal
        open
        onClose={onClose}
        onSubmit={onSubmit}
        recipientName="Sarah"
      />,
    );
    const textarea = screen.getByPlaceholderText(/tone is too direct/i);
    fireEvent.change(textarea, {
      target: { value: "Sequence triggered on outdated signal" },
    });
    const submitBtn = screen
      .getAllByText(/Reject draft/i)
      .map((el) => el.closest("button"))
      .find((b) => b && !b.hasAttribute("disabled")) as HTMLButtonElement;
    fireEvent.click(submitBtn);
    // Allow promises to flush.
    await new Promise((r) => setTimeout(r, 0));
    expect(onSubmit).toHaveBeenCalledWith({
      reason: "Sequence triggered on outdated signal",
      pauseEnrollment: true,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("preserves modal open + shows error when submit fails", async () => {
    const onSubmit = vi.fn(async () => ({ ok: false, error: "Version mismatch" }));
    const onClose = vi.fn();
    render(
      <SequenceDraftRejectModal
        open
        onClose={onClose}
        onSubmit={onSubmit}
        recipientName="Sarah"
      />,
    );
    const textarea = screen.getByPlaceholderText(/tone is too direct/i);
    fireEvent.change(textarea, {
      target: { value: "Sequence triggered on outdated signal" },
    });
    const submitBtn = screen
      .getAllByText(/Reject draft/i)
      .map((el) => el.closest("button"))
      .find((b) => b && !b.hasAttribute("disabled")) as HTMLButtonElement;
    fireEvent.click(submitBtn);
    await new Promise((r) => setTimeout(r, 0));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/Version mismatch/i)).toBeDefined();
  });

  it("populates textarea when a preset is clicked", () => {
    render(
      <SequenceDraftRejectModal
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        recipientName="Sarah"
      />,
    );
    fireEvent.click(screen.getByText(/Tone too aggressive — soften before sending/i));
    const textarea = screen.getByPlaceholderText(/tone is too direct/i) as HTMLTextAreaElement;
    expect(textarea.value).toMatch(/Tone too aggressive/i);
  });

  it("toggle pauseEnrollment off, submit passes false", async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }));
    render(
      <SequenceDraftRejectModal
        open
        onClose={vi.fn()}
        onSubmit={onSubmit}
        recipientName="Sarah"
      />,
    );
    const textarea = screen.getByPlaceholderText(/tone is too direct/i);
    fireEvent.change(textarea, {
      target: { value: "Wrong moment, recipient just signed with competitor" },
    });
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
    const submitBtn = screen
      .getAllByText(/Reject draft/i)
      .map((el) => el.closest("button"))
      .find((b) => b && !b.hasAttribute("disabled")) as HTMLButtonElement;
    fireEvent.click(submitBtn);
    await new Promise((r) => setTimeout(r, 0));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ pauseEnrollment: false }),
    );
  });
});
