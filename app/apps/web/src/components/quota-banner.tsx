"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Zap, X } from "lucide-react";

type QuotaKind = "contacts" | "emails" | "ai_queries";

interface QuotaResponse {
  plan: string;
  periodStart: string;
  periodEnd: string | null;
  usage: Record<QuotaKind, number>;
  limits: {
    contacts: number | null;
    emailsPerMonth: number | null;
    aiQueriesPerMonth: number | null;
  };
  overLimit: QuotaKind[];
  nearLimit: QuotaKind[];
}

const KIND_LABEL: Record<QuotaKind, string> = {
  contacts: "contacts",
  emails: "email sends",
  ai_queries: "AI queries",
};

const LIMIT_FIELD: Record<QuotaKind, keyof QuotaResponse["limits"]> = {
  contacts: "contacts",
  emails: "emailsPerMonth",
  ai_queries: "aiQueriesPerMonth",
};

/** Session-scoped dismissal key so the banner doesn't nag on every nav. */
const DISMISS_KEY = "quota-banner-dismissed-at";
/** How long a dismissal lasts — 1h, long enough to finish the task, short
 * enough that an over-limit tenant sees it again on the next session. */
const DISMISS_TTL_MS = 60 * 60 * 1000;

function isDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function QuotaBanner() {
  const [data, setData] = useState<QuotaResponse | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => isDismissed());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/billing/quota", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as QuotaResponse;
        if (!cancelled) setData(json);
      } catch {
        /* offline or route unavailable — stay silent */
      }
    }
    load();
    // Re-poll every 60s. Quotas don't cross thresholds second-by-second.
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!data || dismissed) return null;
  if (data.overLimit.length === 0 && data.nearLimit.length === 0) return null;

  const isOver = data.overLimit.length > 0;
  const kind: QuotaKind = isOver ? data.overLimit[0] : data.nearLimit[0];
  const used = data.usage[kind];
  const limit = data.limits[LIMIT_FIELD[kind]];

  // Design language: CSS vars + monochrome tones. Yellow for near, red for over.
  const accentColor = isOver ? "var(--color-danger, #ef4444)" : "var(--color-warning, #f59e0b)";
  const bg = isOver ? "rgba(239, 68, 68, 0.08)" : "rgba(245, 158, 11, 0.08)";
  const border = isOver ? "rgba(239, 68, 68, 0.25)" : "rgba(245, 158, 11, 0.25)";

  const label = KIND_LABEL[kind];
  const countLabel = limit === null ? `${used.toLocaleString()} used` : `${used.toLocaleString()} / ${limit.toLocaleString()} used`;

  const message = isOver
    ? `You've hit your ${data.plan} plan limit for ${label} this period.`
    : `Approaching your ${label} limit (${countLabel}).`;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore storage errors */
    }
    setDismissed(true);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 border-b px-4 py-2"
      style={{
        background: bg,
        borderColor: border,
        color: "var(--color-text-primary)",
      }}
    >
      <AlertTriangle size={15} style={{ color: accentColor, flexShrink: 0 }} />
      <span className="text-[13px]" style={{ color: "var(--color-text-primary)" }}>
        {message}
      </span>
      {limit !== null && (
        <span className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
          {countLabel}
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium"
          style={{
            background: accentColor,
            color: "white",
          }}
        >
          <Zap size={12} />
          Upgrade
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss quota banner for this session"
          className="rounded p-1"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
