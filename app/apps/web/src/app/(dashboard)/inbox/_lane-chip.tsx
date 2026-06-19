"use client";

/**
 * LaneChip + CountBadge (F1) — the single lane/split tab renderer. Replaces the
 * near-duplicate inline tab blocks (built-in lanes, custom lanes, bundles, splits)
 * so the lane bar can't drift. Active = accent-soft/accent, inactive = tertiary;
 * the count renders as a pill (CountBadge) instead of "(n)" parens, hidden at 0.
 */

export function CountBadge({ count, active = false }: { count: number; active?: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className="rounded-full px-1.5 text-[11px] font-semibold tabular-nums"
      style={{
        background: active ? "var(--color-accent)" : "var(--color-bg-hover)",
        color: active ? "var(--color-bg-card)" : "var(--color-text-tertiary)",
      }}
    >
      {count}
    </span>
  );
}

export function LaneChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  /** When omitted, no count pill is rendered. */
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors"
      style={{
        background: active ? "var(--color-accent-soft)" : "transparent",
        color: active ? "var(--color-accent)" : "var(--color-text-tertiary)",
      }}
    >
      {label}
      {count != null && <CountBadge count={count} active={active} />}
    </button>
  );
}
