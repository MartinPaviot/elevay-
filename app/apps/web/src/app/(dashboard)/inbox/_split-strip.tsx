"use client";

/**
 * Split-tab strip — the inbox's SECOND nav axis: a horizontal band above the
 * conversation list that sub-segments the attention lane by intention/category.
 * Primary · Needs Reply · Follow Ups · Promotions · Social · <custom> · Noise.
 * Selecting a tab drives the page's activeSplit over the already-wired
 * `?split=` route; the sidebar's intention rows stay in sync. Frontend-only.
 *
 * Styled as the STANDARD dashboard filter bar (continuity pass 2026-07-02):
 * 40px --filter-bar-height, px-6, and the accounts/contacts pill grammar —
 * rounded-md px-2.5 py-1 text-[12px] font-medium, active = accent-soft bg +
 * accent text, inactive = text-tertiary. The former Upstream styling (38px
 * underline tabs, 14px labels, per-category colored icons) was the only
 * multi-color tab bar in the app.
 */

import { Inbox, Reply, Clock, Megaphone, Users, VolumeX, Hash } from "lucide-react";
import type { SplitCount } from "@/lib/inbox/splits";
import { useT } from "@/lib/i18n/locale";

/** i18n key for each built-in split name; custom splits keep their own name. */
const BUILTIN_SPLIT_KEY: Record<string, string> = {
  other: "inbox.split.primary",
  needs_reply: "inbox.split.needsReply",
  follow_ups: "inbox.split.followUps",
  promotions: "inbox.split.promotions",
  social: "inbox.split.social",
};

/** Per-split icon — monochrome, inherits the pill's text color. */
const SPLIT_ICON: Record<string, React.ReactNode> = {
  other: <Inbox size={12} />, // Primary
  needs_reply: <Reply size={12} />,
  follow_ups: <Clock size={12} />,
  promotions: <Megaphone size={12} />,
  social: <Users size={12} />,
  noise: <VolumeX size={12} />,
};

function Tab({
  id,
  name,
  count,
  active,
  onClick,
}: {
  id: string;
  name: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-[var(--color-bg-hover)]"
      style={{
        background: active ? "var(--color-accent-soft)" : "transparent",
        color: active ? "var(--color-accent)" : "var(--color-text-tertiary)",
      }}
    >
      <span className="shrink-0">{SPLIT_ICON[id] ?? <Hash size={12} />}</span>
      {name}
      {count > 0 && (
        <span className="text-[11px] tabular-nums opacity-70">
          {count}
        </span>
      )}
    </button>
  );
}

export function SplitStrip({
  splits,
  noiseCount,
  active,
  onSelect,
  trailing,
}: {
  /** Built-in (Primary/Needs Reply/...) + custom per-sender splits, with counts. */
  splits: SplitCount[];
  /** Demoted-noise count — the trailing Noise tab. */
  noiseCount: number;
  /** The active split id, or null (the whole attention lane / Inbox). */
  active: string | null;
  /** Select a split; passing the active id again clears it (back to all). */
  onSelect: (id: string | null) => void;
}) {
  const t = useT();
  return (
    <div
      className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b px-6"
      style={{
        height: "var(--filter-bar-height)",
        borderColor: "var(--color-border-default)",
        background: "var(--color-bg-card)",
      }}
    >
      {splits.map((s) => (
        <Tab
          key={s.id}
          id={s.id}
          name={BUILTIN_SPLIT_KEY[s.id] ? t(BUILTIN_SPLIT_KEY[s.id]) : s.name}
          count={s.count}
          active={active === s.id}
          onClick={() => onSelect(active === s.id ? null : s.id)}
        />
      ))}
      {noiseCount > 0 && (
        <Tab id="noise" name={t("inbox.split.noise")} count={noiseCount} active={active === "noise"} onClick={() => onSelect(active === "noise" ? null : "noise")} />
      )}
    </div>
  );
}
