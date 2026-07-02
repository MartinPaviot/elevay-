"use client";

import { ElevayMark } from "@/components/ui/elevay-mark";

/**
 * "Thinking" indicator — shown from submit until the assistant's first
 * visible token. Three dots painted with the brand gradient's stops
 * (teal, blue, orange), pulsing on the landing agent-showcase rhythm
 * (1.1s, 180ms stagger). Dots, not skeleton bars: bars promise content
 * shape; dots say "the agent is thinking" — and the running tool steps
 * (ToolCallGroup) already occupy the space where the work shows.
 * Colors are the --gradient-brand stops (light values; the dark theme's
 * stops are brighter siblings, close enough for a 6px dot).
 */
const DOT_COLORS = ["#17C3B2", "#2C6BED", "#FF7A3D"];

export function StreamingSkeleton() {
  return (
    <div className="mb-6">
      <div
        className="flex items-center gap-2 text-[12px]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <ElevayMark size={13} />
        <span style={{ fontWeight: 500 }}>Elevay</span>
        <span className="flex items-center gap-1" aria-label="Thinking" role="status">
          {DOT_COLORS.map((color, i) => (
            <span
              key={color}
              className="agent-dot inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: color, animationDelay: `${i * 180}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
