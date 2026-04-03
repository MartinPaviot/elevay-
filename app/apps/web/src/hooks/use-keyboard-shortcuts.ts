"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Global keyboard shortcuts for the dashboard.
 *
 * Single-key:
 *   n     — dispatch "leadsens:create" custom event
 *   /     — open command palette (Ctrl+K)
 *   Escape — dispatch "leadsens:escape" custom event
 *
 * Chords (press g, then second key within 1s):
 *   g a — Accounts
 *   g c — Contacts
 *   g d — Deals / Opportunities
 *   g s — Sequences
 *   g t — Tasks
 *   g h — Home / Dashboard
 *
 * All shortcuts are suppressed when focus is inside an input, textarea, or
 * contenteditable element.
 */
export function useKeyboardShortcuts() {
  const router = useRouter();
  const pendingChord = useRef<string | null>(null);
  const chordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearChord = useCallback(() => {
    pendingChord.current = null;
    if (chordTimer.current) {
      clearTimeout(chordTimer.current);
      chordTimer.current = null;
    }
  }, []);

  useEffect(() => {
    function isTyping(e: KeyboardEvent): boolean {
      const target = e.target as HTMLElement | null;
      if (!target) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      return false;
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Never intercept when the user is typing in a field
      if (isTyping(e)) return;

      // Don't intercept modified keys (except Ctrl+K which we handle)
      if (e.metaKey || e.altKey) return;

      // Ctrl+K — command palette (already handled by CommandPalette,
      // but we keep this as a no-op so we don't interfere)
      if (e.ctrlKey && e.key === "k") return;
      if (e.ctrlKey) return;

      // --- Chord handling ---
      if (pendingChord.current === "g") {
        clearChord();
        const chordMap: Record<string, string> = {
          a: "/accounts",
          c: "/contacts",
          d: "/opportunities",
          s: "/sequences",
          t: "/tasks",
          h: "/",
        };
        const dest = chordMap[e.key];
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
        return;
      }

      // --- Start chord ---
      if (e.key === "g") {
        e.preventDefault();
        pendingChord.current = "g";
        chordTimer.current = setTimeout(clearChord, 1000);
        return;
      }

      // --- Single-key shortcuts ---
      if (e.key === "n") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("leadsens:create"));
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        // Simulate Ctrl+K to open command palette
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "k",
            code: "KeyK",
            ctrlKey: true,
            bubbles: true,
          })
        );
        return;
      }

      if (e.key === "Escape") {
        // Dispatch a generic escape event for modals / dropdowns
        window.dispatchEvent(new CustomEvent("leadsens:escape"));
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearChord();
    };
  }, [router, clearChord]);
}
