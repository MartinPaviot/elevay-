"use client";

import { useEffect, useRef } from "react";

/**
 * Trap keyboard focus inside `ref.current` while `active` is true.
 *
 * Behavior:
 * - On activate: focus the first focusable descendant (or the
 *   container itself if nothing tabbable).
 * - Tab from the last focusable wraps to the first; Shift+Tab from
 *   the first wraps to the last.
 * - On deactivate: restore focus to whatever element had it before
 *   the trap engaged (unless it's gone from the DOM).
 * - Escape key is NOT handled here — callers manage their own
 *   close affordance.
 *
 * Not a substitute for a proper dialog library, but enough for
 * drawers, slide-overs, and the onboarding wizard modal.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]:not([tabindex='-1'])",
  "button:not([disabled]):not([tabindex='-1'])",
  "input:not([disabled]):not([tabindex='-1'])",
  "select:not([disabled]):not([tabindex='-1'])",
  "textarea:not([disabled]):not([tabindex='-1'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = (document.activeElement as HTMLElement | null) ?? null;

    const focusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute("aria-hidden")
      );

    // Move initial focus inside.
    const initial = focusables()[0] ?? container;
    if (!container.contains(document.activeElement)) {
      initial.focus();
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        container?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !container?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active]);

  return ref;
}
