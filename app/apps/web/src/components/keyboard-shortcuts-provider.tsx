"use client";

import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { ShortcutHelp } from "@/components/ui/shortcut-help";

export function KeyboardShortcutsProvider() {
  useKeyboardShortcuts();
  // The `?` cheatsheet overlay. It was built (shortcut-help.tsx) and every
  // surface registers its shortcuts into the registry it reads — but it was
  // never MOUNTED, so Shift+? was a no-op app-wide and every registered
  // shortcut stayed invisible (audit 2026-07-02, round 2).
  return <ShortcutHelp />;
}
