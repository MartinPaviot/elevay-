"use client";

/**
 * Floating — a portal-based popover layer.
 *
 * Why this exists: inline `absolute` popovers inherit every ancestor's
 * `overflow` clip. On /call-mode the queue column is a 224px `overflow-hidden`
 * <aside> with an inner `overflow-y-auto` list, so a `right-0` dropdown wider
 * than the column (Tout l'ICP 230px, the reachability tooltip 224px) was sliced
 * off at the column edge — `z-50` is powerless against `overflow:hidden`.
 *
 * Floating renders its children into <body> with `position: fixed`, positioned
 * from the anchor's live `getBoundingClientRect()`, so it escapes ALL overflow
 * ancestors. It clamps to the viewport, flips above the anchor when it would
 * overflow the bottom, and re-measures on scroll/resize. Layer comes from the
 * `--z-popover` token, above page chrome and below the modal.
 */

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

type Placement = "bottom-end" | "bottom-start" | "top-end" | "top-start";

const MARGIN = 8; // viewport breathing room

export function Floating({
  anchorRef,
  open,
  placement = "bottom-end",
  gap = 4,
  className,
  style,
  onClose,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  /** The trigger element to anchor against. */
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  placement?: Placement;
  /** px between the anchor edge and the popover. */
  gap?: number;
  className?: string;
  style?: CSSProperties;
  /** When provided, an outside mousedown / Escape closes the layer (click menus).
   *  Omit for hover layers that manage their own open state. */
  onClose?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: ReactNode;
}) {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const compute = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      const p = popRef.current?.getBoundingClientRect();
      if (!a || !p) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Horizontal: align the requested edge, then clamp into the viewport.
      let left = placement.endsWith("end") ? a.right - p.width : a.left;
      left = Math.max(MARGIN, Math.min(left, vw - p.width - MARGIN));

      // Vertical: open downward by default; flip above the anchor if it would
      // overflow the bottom and there's room above.
      const below = a.bottom + gap;
      const above = a.top - p.height - gap;
      let top = placement.startsWith("top") ? above : below;
      if (top + p.height > vh - MARGIN && above >= MARGIN) top = above;
      if (top < MARGIN) top = below;
      setPos({ left, top });
    };
    compute();
    // Re-measure on any scroll (capture catches inner scrollers) or resize.
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open, anchorRef, placement, gap, children]);

  useLayoutEffect(() => {
    if (!open || !onClose) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={popRef}
      className={className}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "fixed",
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        zIndex: "var(--z-popover)" as unknown as number,
        // Hidden until measured so it never flashes at the wrong spot.
        visibility: pos ? "visible" : "hidden",
        ...style,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
