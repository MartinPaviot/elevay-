"use client";

/**
 * "To classify" review lane (outreach-autopilot T10, design §12) — the
 * founder's 1-click correction surface for LOW-CONFIDENCE reply
 * classifications. Rendered INSIDE the inbox content area when the trailing
 * `to_classify` pseudo-tab is active (the Noise-tab model); it is NOT a
 * conversation list — one row per pending reply_review_queue item, with the
 * AI's guess + confidence as a chip, a one-click confirm (the AI was right)
 * and a correction dropdown over the canonical REPLY_CLASSIFICATIONS
 * vocabulary. The queue is an OVERLAY: these replies were already routed on
 * the AI's guess; correcting re-routes them server-side (/api/inbox/review).
 *
 * Constraints: controls stay h-7 (28px, the header-control standard), rows
 * min 44px, tokens only (accent = var(--color-accent)), no emoji, EN-default
 * strings via useT(). Resolving a row removes it on success and bubbles up
 * through onResolved so the strip badge stays honest without a refetch.
 */

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Tags } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/locale";
import { REPLY_CLASSIFICATIONS, type ReplyClassificationLabel } from "@/lib/reply/classifications";

/** One pending item, as GET /api/inbox/review returns it. */
interface ReviewItem {
  id: string;
  outboundEmailId: string;
  contactId: string | null;
  contactName: string | null;
  toAddress: string | null;
  subject: string | null;
  replySnippet: string | null;
  /** { classification, confidence, reason } as the model emitted them. */
  classification: { classification?: unknown; confidence?: unknown; reason?: unknown } | null;
  createdAt: string | null;
}

/**
 * Display label for a raw classification id — DERIVED from the id, never a
 * parallel hardcoded list, so a new REPLY_CLASSIFICATIONS entry can't drift
 * out of the dropdown. Labels stay EN like every classification vocabulary
 * map in the inbox (conversations.ts REASON_BY_LABEL precedent).
 */
function classificationLabel(id: string): string {
  if (id === "ooo") return "Out of office";
  const words = id.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Per-row correction dropdown — the SortMenu pattern (outside-click + Escape
 * close, token-styled menu). Options come straight off REPLY_CLASSIFICATIONS.
 */
function CorrectMenu({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (classification: ReplyClassificationLabel) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        // h-7 = the 28px control standard (44px header invariant family).
        className="flex h-7 items-center gap-1 rounded-md border px-2 text-[12px] font-medium transition-colors hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
        style={{ borderColor: "var(--color-border-default)", background: "var(--color-bg-card)", color: "var(--color-text-secondary)" }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {t("inbox.review.correct")}
        <ChevronDown size={12} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[190px] rounded-lg py-1"
          style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border-default)", boxShadow: "var(--shadow-floating)" }}
        >
          <div
            className="px-3 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wide"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {t("inbox.review.reclassifyAs")}
          </div>
          {REPLY_CLASSIFICATIONS.map((c) => (
            <button
              key={c}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPick(c);
              }}
              className="flex w-full items-center px-3 py-1.5 text-[13px] transition-colors"
              style={{ color: "var(--color-text-primary)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              {classificationLabel(c)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReviewLane({
  /** A row was resolved (confirmed or corrected) — decrement the strip badge. */
  onResolved,
}: {
  onResolved: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch("/api/inbox/review")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { items?: ReviewItem[] }) => {
        if (!cancelled) setItems(Array.isArray(d.items) ? d.items : []);
      })
      // A failing queue must be visibly retryable, never a silent empty
      // (capture-review lesson).
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function resolve(
    id: string,
    body: { action: "confirm" } | { action: "correct"; classification: ReplyClassificationLabel },
  ) {
    setBusy(id);
    try {
      const r = await fetch(`/api/inbox/review/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // Success → remove the row + bubble up so the strip badge refreshes.
      setItems((prev) => prev.filter((i) => i.id !== id));
      onResolved();
    } catch {
      // Keep the row on failure — the founder can retry the same click.
      toast(t("inbox.review.actionFailed"), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    // Same white list surface as the conversation column (inbox continuity).
    <div className="flex-1 overflow-y-auto" style={{ background: "var(--color-bg-card)" }}>
      {loading ? (
        // Footprint skeleton mirroring the resolved rows — never a bare spinner.
        <div aria-hidden className="animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-b px-4 py-3" style={{ borderColor: "var(--color-border-default)" }}>
              <div className="h-3 w-40 rounded" style={{ background: "var(--color-bg-hover)" }} />
              <div className="mt-2 h-3 w-3/4 rounded" style={{ background: "var(--color-bg-hover)" }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          variant="error"
          title={t("inbox.review.loadError")}
          actionLabel={t("common.retry")}
          onAction={() => setReloadKey((k) => k + 1)}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Tags size={20} />}
          title={t("inbox.review.emptyTitle")}
          description={t("inbox.review.emptyDescription")}
        />
      ) : (
        items.map((item) => {
          const guess =
            typeof item.classification?.classification === "string"
              ? item.classification.classification
              : null;
          const confidence =
            typeof item.classification?.confidence === "number"
              ? Math.round(item.classification.confidence * 100)
              : null;
          const reason =
            typeof item.classification?.reason === "string" ? item.classification.reason : undefined;
          return (
            <div
              key={item.id}
              data-review-id={item.id}
              // min 44px row; grows with the 2-line snippet clamp.
              className="flex min-h-[44px] items-start gap-3 border-b px-4 py-2.5"
              style={{ borderColor: "var(--color-border-default)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    {item.contactName || item.toAddress || t("inbox.review.unknownRecipient")}
                  </span>
                  {guess && (
                    // The AI's guess + confidence, in the strip's active-pill
                    // grammar (accent-soft bg + accent text).
                    <span
                      className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums"
                      style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
                      title={reason}
                    >
                      {classificationLabel(guess)}
                      {confidence != null ? ` · ${confidence}%` : ""}
                    </span>
                  )}
                </div>
                {item.subject && (
                  <div className="truncate text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                    {item.subject}
                  </div>
                )}
                {item.replySnippet && (
                  <div className="mt-0.5 line-clamp-2 text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                    {item.replySnippet}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  disabled={busy === item.id}
                  onClick={() => void resolve(item.id, { action: "confirm" })}
                  // h-7 w-7 icon control (28px standard), accent = "the AI was right".
                  className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
                  style={{ color: "var(--color-accent)" }}
                  title={t("inbox.review.confirmTitle")}
                  aria-label={t("inbox.review.confirmTitle")}
                >
                  {busy === item.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                </button>
                <CorrectMenu
                  disabled={busy === item.id}
                  onPick={(classification) => void resolve(item.id, { action: "correct", classification })}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
