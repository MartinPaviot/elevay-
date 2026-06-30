// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ListChipMenu } from "../_list-chip-menu";

afterEach(cleanup);

function setup() {
  const onRename = vi.fn();
  const onDelete = vi.fn();
  render(
    <ListChipMenu
      triggerAriaLabel="Options for the Hot list"
      renameLabel="Rename this list"
      deleteLabel="Delete this list"
      onRename={onRename}
      onDelete={onDelete}
    />,
  );
  return { onRename, onDelete };
}

describe("ListChipMenu — active-list-chip kebab", () => {
  it("is closed by default (no menu items rendered)", () => {
    setup();
    expect(screen.getByRole("button", { name: "Options for the Hot list" })).toBeTruthy();
    expect(screen.queryByText("Rename this list")).toBeNull();
    expect(screen.queryByText("Delete this list")).toBeNull();
  });

  it("opens on trigger click and shows Rename + Delete", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Options for the Hot list" }));
    expect(screen.getByText("Rename this list")).toBeTruthy();
    expect(screen.getByText("Delete this list")).toBeTruthy();
  });

  it("invokes onRename and closes the menu", () => {
    const { onRename } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Options for the Hot list" }));
    fireEvent.click(screen.getByText("Rename this list"));
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Rename this list")).toBeNull(); // closed
  });

  it("invokes onDelete (destructive) from the menu", () => {
    const { onDelete } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Options for the Hot list" }));
    fireEvent.click(screen.getByText("Delete this list"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape without firing an action", () => {
    const { onRename, onDelete } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Options for the Hot list" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Rename this list")).toBeNull();
    expect(onRename).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
