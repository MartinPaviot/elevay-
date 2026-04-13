import {
  Inbox,
  SearchX,
  AlertCircle,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "./button";

/**
 * Five canonical empty-state variants.
 *
 * - `first-use` — the user has never created anything in this list. Should
 *   nudge toward creation (primary CTA: "Create X", secondary: "Import").
 * - `no-filter-match` — data exists but the current filter hides it.
 *   Primary CTA: "Clear filters".
 * - `error` — an unrecoverable fetch error. Primary CTA: "Retry".
 * - `loading` — transient state used instead of a spinner on page shells
 *   that benefit from a full-frame message (rare; most callers prefer a
 *   skeleton table).
 * - `no-permission` — user lacks the role to see this list.
 */
export type EmptyStateVariant =
  | "first-use"
  | "no-filter-match"
  | "error"
  | "loading"
  | "no-permission";

interface EmptyStateProps {
  /** Variant picks the default icon + tone. Callers may still override
   *  `icon` with a custom node — useful for domain-specific first-use
   *  screens (e.g. handshake icon for empty deals list). */
  variant?: EmptyStateVariant;
  icon?: React.ReactNode;
  title: string;
  description?: string;

  /** Primary action. Legacy prop name kept for backwards-compat. */
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: "gradient" | "solid" | "outline";

  /** Optional ghost-style secondary action (e.g. "Import" next to "Create"). */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

const DEFAULT_ICONS: Record<EmptyStateVariant, React.ReactNode> = {
  "first-use": <Inbox size={20} />,
  "no-filter-match": <SearchX size={20} />,
  error: <AlertCircle size={20} />,
  loading: <Loader2 size={20} className="animate-spin" />,
  "no-permission": <Lock size={20} />,
};

const VARIANT_TONE: Record<EmptyStateVariant, { bg: string; fg: string }> = {
  "first-use": { bg: "var(--color-bg-hover)", fg: "var(--color-text-tertiary)" },
  "no-filter-match": { bg: "var(--color-bg-hover)", fg: "var(--color-text-tertiary)" },
  error: { bg: "rgba(220,38,38,0.08)", fg: "var(--color-error, #b91c1c)" },
  loading: { bg: "var(--color-bg-hover)", fg: "var(--color-text-tertiary)" },
  "no-permission": { bg: "var(--color-bg-hover)", fg: "var(--color-text-muted)" },
};

/**
 * Render a centered empty-state block. Suitable for list pages and
 * card bodies. For inline empty states (e.g. an empty row inside a
 * table), use a lighter copy inline — this component assumes it owns
 * a large amount of vertical space.
 */
export function EmptyState({
  variant = "first-use",
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = "solid",
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  const renderedIcon = icon ?? DEFAULT_ICONS[variant];
  const tone = VARIANT_TONE[variant];

  return (
    <div
      className="flex flex-col items-center justify-center py-16"
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ background: tone.bg, color: tone.fg }}
      >
        {renderedIcon}
      </div>
      <h3
        className="mt-4 text-[15px] font-semibold"
        style={{ color: "var(--color-text-primary)" }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="mt-1.5 max-w-sm text-center text-[13px]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {description}
        </p>
      )}
      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-4 flex items-center gap-2">
          {actionLabel && onAction && (
            <Button variant={actionVariant} onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outline" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
