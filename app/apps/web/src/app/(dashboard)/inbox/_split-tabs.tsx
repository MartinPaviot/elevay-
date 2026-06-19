"use client";

/**
 * Intention-Split tabs (B3) — sub-segments the attention lane into Needs Reply /
 * Follow Ups / Promotions / Social. Renders only on the attention lane; selecting
 * a split drives the `?split=` query. Mirrors the page's lane-tab token style
 * (one chip system, tokens-only, no emoji) so the two strips can't drift.
 */

import type { BuiltInSplit } from "./_types";

interface SplitCount {
  id: string;
  name: string;
  count: number;
}

export function SplitTabs({
  splits,
  active,
  onSelect,
}: {
  splits: SplitCount[];
  active: BuiltInSplit | null;
  onSelect: (id: BuiltInSplit | null) => void;
}) {
  // Always show the four intention splits; "other" only when it has mail.
  const shown = splits.filter((s) => s.id !== "other" || s.count > 0);
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 px-4 py-2"
      style={{ borderBottom: "0.5px solid var(--color-border-default)" }}
    >
      <SplitChip label="All" count={null} active={active === null} onClick={() => onSelect(null)} />
      {shown.map((s) => (
        <SplitChip
          key={s.id}
          label={s.name}
          count={s.count}
          active={active === s.id}
          onClick={() => onSelect(s.id as BuiltInSplit)}
        />
      ))}
    </div>
  );
}

function SplitChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors"
      style={{
        border: "1px solid var(--color-border-default)",
        background: active ? "var(--color-accent-soft)" : "transparent",
        color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
      }}
    >
      {label}
      {count != null && count > 0 && (
        <span
          className="rounded-full px-1.5 text-[10px] font-semibold"
          style={{
            background: active ? "var(--color-accent)" : "var(--color-bg-muted)",
            color: active ? "var(--color-bg-card)" : "var(--color-text-tertiary)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
