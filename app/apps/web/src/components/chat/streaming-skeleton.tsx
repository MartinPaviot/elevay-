"use client";

import { ElevayMark } from "@/components/ui/elevay-mark";
import { AgentThinkingDots } from "@/components/chat/agent-working";

/**
 * "Thinking" indicator — shown from submit until the assistant's first
 * visible token. Three dots painted with the brand gradient's stops,
 * pulsing on the landing agent-showcase rhythm. Dots, not skeleton bars:
 * bars promise content shape; dots say "the agent is thinking" — and the
 * running tool steps (ToolCallGroup) already occupy the work area. The
 * dots themselves are the shared AgentThinkingDots primitive so every
 * surface's working state stays visually identical.
 */
export function StreamingSkeleton() {
  return (
    <div className="mb-6">
      <div
        className="flex items-center gap-2 text-[12px]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <ElevayMark size={13} />
        <span style={{ fontWeight: 500 }}>Elevay</span>
        <AgentThinkingDots />
      </div>
    </div>
  );
}
