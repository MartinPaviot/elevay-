"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

/**
 * Kebab menu for an ACTIVE account-list chip — groups the secondary actions
 * (rename, delete) behind one trigger so the chip isn't two adjacent 16px
 * icon buttons (a destructive × sitting next to the rename pencil).
 *
 * The menu is rendered into a `document.body` portal with `position: fixed`,
 * anchored to the trigger's rect. That is deliberate: the list chips live in a
 * horizontally-scrollable `overflow-x-auto` group, whose computed `overflow-y`
 * is `auto` too — a normal absolute dropdown would be CLIPPED by it. The portal
 * escapes the scroll container entirely. We close (rather than reposition) on
 * scroll/resize so the menu can never drift away from a chip that just moved.
 */
export function ListChipMenu({
  renameLabel,
  deleteLabel,
  triggerAriaLabel,
  onRename,
  onDelete,
}: {
  renameLabel: string;
  deleteLabel: string;
  triggerAriaLabel: string;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    // top-right of the menu just under the trigger; right is measured from the
    // viewport's right edge so the menu stays right-aligned to the kebab.
    setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // capture:true so we also catch scrolls inside the chips' scroll container.
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={triggerAriaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mr-1 ml-0.5 flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-[var(--color-bg-hover)]"
        style={{ color: "var(--color-accent)" }}
      >
        <MoreHorizontal size={12} />
      </button>
      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[60] min-w-40 rounded-lg py-1"
            style={{
              top: pos.top,
              right: pos.right,
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-border-moderate)",
              boxShadow: "var(--shadow-floating)",
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onRename(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--color-bg-hover)]"
              style={{ color: "var(--color-text-primary)" }}
            >
              <Pencil size={13} style={{ color: "var(--color-text-tertiary)" }} />
              {renameLabel}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onDelete(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--color-bg-hover)]"
              style={{ color: "var(--color-danger, #dc2626)" }}
            >
              <Trash2 size={13} />
              {deleteLabel}
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
