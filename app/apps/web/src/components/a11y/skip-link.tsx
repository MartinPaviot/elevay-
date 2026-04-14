"use client";

/**
 * Keyboard-only "Skip to main content" anchor — the first focusable
 * element on the page, invisible until focused, then animated into
 * view at the top-left. A fundamental a11y affordance: screen-reader
 * and keyboard-only users would otherwise tab through the entire
 * navigation on every page load to reach the main content.
 */
export function SkipLink({
  targetId = "main-content",
  label = "Skip to main content",
}: {
  targetId?: string;
  label?: string;
}) {
  return (
    <a
      href={`#${targetId}`}
      className="skip-link"
      // Inline styles so the component works without a global stylesheet.
      // Globals may refine these via `.skip-link:focus`.
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        transform: "translateY(-120%)",
        transition: "transform 150ms ease",
        background: "var(--color-bg-card, #fff)",
        color: "var(--color-text-primary, #111)",
        border: "1px solid var(--color-border-default, #e4e4e7)",
        borderRadius: 6,
        padding: "6px 12px",
        fontSize: 13,
        fontWeight: 600,
        zIndex: 10000,
        boxShadow: "var(--shadow-floating, 0 4px 12px rgba(0,0,0,0.08))",
      }}
      onFocus={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.transform = "translateY(-120%)";
      }}
    >
      {label}
    </a>
  );
}
