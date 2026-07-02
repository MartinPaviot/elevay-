/**
 * Shared initials avatar for a sender (INBOX-R06). Deterministic, no remote logo
 * fetch and no provider name — initials + a stable colour derived purely from the
 * sender address (so the same person always gets the same chip across the list
 * and the reading pane). Colours come from the app-wide badge token system
 * (hash → --color-badge-N, the same 10-hue palette every chip derives from) —
 * the former raw computed-HSL palette was the inbox's last token bypass
 * (continuity pass 2026-07-02).
 */
import { initialsFor, avatarColorIndex } from "@/lib/inbox/sender-auth";

export function SenderAvatar({
  name,
  email,
  size = 28,
}: {
  name: string;
  email: string;
  size?: number;
}) {
  const seed = (email || name || "?").toLowerCase();
  const idx = avatarColorIndex(seed);
  return (
    <span
      aria-hidden
      className="flex shrink-0 select-none items-center justify-center rounded-full font-medium"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        background: `var(--color-badge-${idx}-bg)`,
        color: `var(--color-badge-${idx})`,
        border: `1px solid color-mix(in srgb, var(--color-badge-${idx}) 20%, transparent)`,
      }}
    >
      {initialsFor(name || email)}
    </span>
  );
}
