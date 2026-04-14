"use client";

import { useEffect, useState } from "react";

/**
 * Announce `message` to assistive technologies without rendering
 * visible UI. Mount once near the root; update `message` whenever
 * you need to announce a state change that isn't already wrapped in
 * a `role="alert"` / `role="status"` element (e.g. "Sorted by score",
 * "3 accounts selected").
 *
 * Uses the double-mount trick to force the announcement even when the
 * new message text equals the previous one: we wipe the text to ""
 * for a tick, then set the real message.
 */
export function LiveRegion({
  message,
  politeness = "polite",
}: {
  message: string;
  politeness?: "polite" | "assertive";
}) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!message) {
      setText("");
      return;
    }
    // Blank first so screen readers re-announce identical consecutive messages.
    setText("");
    const raf = requestAnimationFrame(() => setText(message));
    return () => cancelAnimationFrame(raf);
  }, [message]);

  return (
    <div
      role={politeness === "assertive" ? "alert" : "status"}
      aria-live={politeness}
      aria-atomic="true"
      // Visually hidden — class kept in globals for spec consistency.
      className="sr-only"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0,0,0,0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {text}
    </div>
  );
}
