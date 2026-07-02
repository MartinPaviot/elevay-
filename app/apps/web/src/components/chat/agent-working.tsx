"use client";

/**
 * The app-wide "agent is working" primitive — the landing's animation
 * language (shipped for chat in #648) as reusable bits, so every surface
 * where Elevay does something shows the SAME brand-gradient motion instead
 * of a flat spinner. The CSS (.agent-dot, .gradient-text-active) is global
 * in globals.css; prefers-reduced-motion neutralizes it there.
 *
 * The dot colors are the --gradient-brand stops (light values; the dark
 * theme's stops are brighter siblings, close enough for a ~6px dot).
 */

const DOT_COLORS = ["#17C3B2", "#2C6BED", "#FF7A3D"];

/**
 * Standalone "thinking" indicator — three gradient dots on the landing
 * rhythm (1.1s, 180ms stagger). For a block context (chat thinking gap).
 */
export function AgentThinkingDots({ size = 6 }: { size?: number }) {
  return (
    <span className="flex items-center gap-1" aria-label="Thinking" role="status">
      {DOT_COLORS.map((color, i) => (
        <span
          key={color}
          className="agent-dot inline-block rounded-full"
          style={{ width: size, height: size, background: color, animationDelay: `${i * 180}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * Inline "working now" indicator — a single brand-gradient dot plus a
 * gradient-swept label. For buttons / rows mid-action (matches the chat
 * tool-panel's running step). Keep the label short ("Preparing…").
 */
export function AgentWorkingInline({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" role="status" aria-label={label}>
      <span
        className="agent-dot inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: "var(--gradient-brand)" }}
      />
      <span className="gradient-text-active" style={{ fontWeight: 550 }}>
        {label}
      </span>
    </span>
  );
}
