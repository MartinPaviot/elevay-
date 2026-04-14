// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act, screen, fireEvent } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast";
import { useInlineEdit } from "@/hooks/use-inline-edit";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function Fixture({
  initialValue,
  onSave,
  onUndo,
}: {
  initialValue: string;
  onSave: (next: string) => Promise<void>;
  onUndo?: (prev: string) => Promise<void>;
}) {
  const edit = useInlineEdit({
    initialValue,
    onSave,
    onUndo,
    label: "Name",
  });
  return (
    <div>
      <input
        data-testid="input"
        value={edit.value}
        onFocus={edit.startEdit}
        onChange={(e) => edit.setValue(e.target.value)}
      />
      <button data-testid="save" onClick={() => void edit.save()}>save</button>
      <button data-testid="cancel" onClick={edit.cancel}>cancel</button>
      <span data-testid="saving">{String(edit.saving)}</span>
      <span data-testid="error">{edit.error ? String(edit.error) : ""}</span>
    </div>
  );
}

function renderWithToast(el: React.ReactElement) {
  return render(<ToastProvider>{el}</ToastProvider>);
}

describe("useInlineEdit", () => {
  it("commits the new value via onSave on save()", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { getByTestId } = renderWithToast(
      <Fixture initialValue="Acme" onSave={onSave} />
    );
    fireEvent.focus(getByTestId("input"));
    fireEvent.change(getByTestId("input"), { target: { value: "Acme Corp" } });
    await act(async () => {
      fireEvent.click(getByTestId("save"));
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("Acme Corp");
    expect((getByTestId("input") as HTMLInputElement).value).toBe("Acme Corp");
  });

  it("is a no-op when save() is called without a change", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { getByTestId } = renderWithToast(
      <Fixture initialValue="Acme" onSave={onSave} />
    );
    await act(async () => {
      fireEvent.click(getByTestId("save"));
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("reverts the local value when onSave rejects", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("boom"));
    const { getByTestId } = renderWithToast(
      <Fixture initialValue="Acme" onSave={onSave} />
    );
    fireEvent.focus(getByTestId("input"));
    fireEvent.change(getByTestId("input"), { target: { value: "Nope" } });
    await act(async () => {
      fireEvent.click(getByTestId("save"));
    });
    expect((getByTestId("input") as HTMLInputElement).value).toBe("Acme");
    expect(getByTestId("error").textContent).toContain("boom");
  });

  it("shows an Undo toast that calls onUndo with the previous value", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onUndo = vi.fn().mockResolvedValue(undefined);
    const { getByTestId } = renderWithToast(
      <Fixture initialValue="Acme" onSave={onSave} onUndo={onUndo} />
    );
    fireEvent.focus(getByTestId("input"));
    fireEvent.change(getByTestId("input"), { target: { value: "Acme v2" } });
    await act(async () => {
      fireEvent.click(getByTestId("save"));
    });

    const undoButton = screen.getByText("Undo");
    await act(async () => {
      fireEvent.click(undoButton);
    });

    expect(onUndo).toHaveBeenCalledWith("Acme");
    expect((getByTestId("input") as HTMLInputElement).value).toBe("Acme");
  });

  it("falls back to onSave(previous) when onUndo is omitted", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { getByTestId } = renderWithToast(
      <Fixture initialValue="Acme" onSave={onSave} />
    );
    fireEvent.focus(getByTestId("input"));
    fireEvent.change(getByTestId("input"), { target: { value: "Acme v2" } });
    await act(async () => {
      fireEvent.click(getByTestId("save"));
    });
    // First call = save("Acme v2")
    expect(onSave).toHaveBeenNthCalledWith(1, "Acme v2");

    const undoButton = screen.getByText("Undo");
    await act(async () => {
      fireEvent.click(undoButton);
    });
    // Second call = save("Acme") through the undo fallback.
    expect(onSave).toHaveBeenNthCalledWith(2, "Acme");
  });

  it("cancel() restores the last committed baseline", () => {
    const onSave = vi.fn();
    const { getByTestId } = renderWithToast(
      <Fixture initialValue="Acme" onSave={onSave} />
    );
    fireEvent.focus(getByTestId("input"));
    fireEvent.change(getByTestId("input"), { target: { value: "Acme v2" } });
    fireEvent.click(getByTestId("cancel"));
    expect((getByTestId("input") as HTMLInputElement).value).toBe("Acme");
    expect(onSave).not.toHaveBeenCalled();
  });
});
