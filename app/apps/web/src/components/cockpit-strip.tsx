"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { registerShortcut, type RegisteredShortcut } from "@/lib/hotkey-registry";

/**
 * Cockpit strip (outreach-autopilot T11b) — additive /home extension mounted
 * under the PageHeader, at the top of the scroll container. Two zones that load
 * together behind one footprint skeleton (no CLS):
 *
 *  1. StatBar — three read-only stats: the daily send-cap gauge
 *     (/api/outreach/cap), the deliverability guard light
 *     (/api/deliverability/status) and meetings booked this week
 *     (/api/dashboard/summary → weekSummary.meetingsBooked).
 *  2. "Ready for you" — what genuinely needs the founder, from the three real
 *     tables (/api/home/ready-for-you): drafts to review, replies to classify,
 *     actions to approve. j/k move the selection, Enter/click opens it.
 *
 * Tokens only; the 44px header invariant is the page's, not ours. EN strings.
 */

const COCKPIT_SHORTCUTS: RegisteredShortcut[] = [
  { combo: "j", description: "Next Ready-for-you item", group: "Home" },
  { combo: "k", description: "Previous Ready-for-you item", group: "Home" },
  { combo: "Enter", description: "Open the selected item", group: "Home" },
];

interface CapData {
  sent: number;
  cap: number;
  timezone: string;
  deferredCount: number;
}
interface DeliverabilityStatus {
  tripped: boolean;
  pauseReason: string | null;
}
interface SummaryData {
  weekSummary?: { meetingsBooked?: number };
}
interface ReadyData {
  drafts: number;
  replies: number;
  actions: number;
}

interface ReadyItem {
  key: string;
  count: number;
  label: string;
  why: string;
  href: string;
}

function buildReadyItems(ready: ReadyData): ReadyItem[] {
  const items: ReadyItem[] = [];
  if (ready.drafts > 0) {
    items.push({
      key: "drafts",
      count: ready.drafts,
      label: `${ready.drafts} draft${ready.drafts === 1 ? "" : "s"} to review`,
      why: "Sequence emails the autopilot wrote, waiting for your approval",
      href: "/sequences/review",
    });
  }
  if (ready.replies > 0) {
    items.push({
      key: "replies",
      count: ready.replies,
      label: `${ready.replies} ${ready.replies === 1 ? "reply" : "replies"} to classify`,
      why: "Replies the classifier wasn't sure about, waiting for your call",
      // The T10 review lane: /inbox reads ?split=to_classify (inbox/page.tsx:295).
      href: "/inbox?split=to_classify",
    });
  }
  if (ready.actions > 0) {
    items.push({
      key: "actions",
      count: ready.actions,
      label: `${ready.actions} action${ready.actions === 1 ? "" : "s"} to approve`,
      why: "Actions the agent decided but is holding for your OK",
      // No dedicated approvals page exists yet (AgentFeed is unmounted); the
      // agent surface is /chat. Flagged for the visual pass.
      href: "/chat",
    });
  }
  return items;
}

/** One stat card — mirrors the up-next-view KPI strip styling (up-next-view.tsx:182-208). */
function StatCard({
  label,
  value,
  valueColor,
  sub,
  children,
}: {
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-3.5"
      style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border-default)" }}
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className="text-[21px] font-bold tabular-nums leading-none tracking-[-0.01em]"
          style={{ color: valueColor ?? "var(--color-text-primary)" }}
        >
          {value}
        </span>
      </div>
      {children}
      {sub && <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>{sub}</p>}
    </div>
  );
}

function CockpitSkeleton() {
  return (
    <div>
      {/* StatBar footprint — 3 cards. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-3.5"
            style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border-default)" }}
          >
            <Skeleton className="h-2.5 w-20 rounded" />
            <Skeleton className="mt-2 h-5 w-16 rounded" />
            <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
      {/* Ready-for-you footprint — header + 2 rows. */}
      <div className="mt-4">
        <Skeleton className="h-3 w-24 rounded" />
        <div className="mt-2.5 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl p-3"
              style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border-default)" }}
            >
              <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3 w-1/2 rounded" />
                <Skeleton className="mt-1.5 h-2.5 w-3/4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CockpitStrip() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cap, setCap] = useState<CapData | null>(null);
  const [deliverability, setDeliverability] = useState<DeliverabilityStatus | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [ready, setReady] = useState<ReadyData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const getJson = <T,>(url: string): Promise<T | null> =>
      fetch(url).then((r) => (r.ok ? (r.json() as Promise<T>) : null)).catch(() => null);

    void Promise.all([
      getJson<CapData>("/api/outreach/cap"),
      getJson<DeliverabilityStatus>("/api/deliverability/status"),
      getJson<SummaryData>("/api/dashboard/summary"),
      getJson<ReadyData>("/api/home/ready-for-you"),
    ]).then(([capData, deliv, summaryData, readyData]) => {
      if (cancelled) return;
      setCap(capData);
      setDeliverability(deliv);
      setSummary(summaryData);
      setReady(readyData);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Surface j/k/Enter in the global `?` cheatsheet (mirrors INBOX_SHORTCUTS).
  useEffect(() => {
    const unregs = COCKPIT_SHORTCUTS.map(registerShortcut);
    return () => unregs.forEach((u) => u());
  }, []);

  const items = useMemo(() => (ready ? buildReadyItems(ready) : []), [ready]);

  // Keep the selection inside the (possibly shrinking) item list.
  useEffect(() => {
    setSelectedIndex((idx) => Math.min(idx, Math.max(0, items.length - 1)));
  }, [items.length]);

  // Keyboard: j/k move the Ready-for-you selection, Enter opens it. Never while
  // typing in a field (mirrors inbox/page.tsx:1074-1085 exactly).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (items.length === 0) return;

      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const nextIdx =
          e.key === "j"
            ? Math.min(selectedIndex + 1, items.length - 1)
            : Math.max(selectedIndex - 1, 0);
        setSelectedIndex(nextIdx);
        listRef.current
          ?.querySelector(`[data-cockpit-idx="${nextIdx}"]`)
          ?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        const item = items[selectedIndex];
        if (item) {
          e.preventDefault();
          router.push(item.href);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selectedIndex, router]);

  if (loading) return <CockpitSkeleton />;

  // ── StatBar values ──
  const capValue = cap ? `${cap.sent} / ${cap.cap}` : "-";
  const atCap = cap ? cap.sent >= cap.cap : false;
  const capPct = cap && cap.cap > 0 ? Math.min(100, Math.round((cap.sent / cap.cap) * 100)) : 0;
  const capFillWidth = atCap ? 100 : capPct;
  const capFillColor = atCap ? "var(--color-success)" : "var(--color-accent)";
  const capSub = !cap
    ? undefined
    : atCap
      ? cap.deferredCount > 0
        ? `resumes tomorrow · ${cap.deferredCount} deferred to tomorrow`
        : "resumes tomorrow"
      : `resets at midnight ${cap.timezone}`;

  const meetings = summary?.weekSummary?.meetingsBooked ?? 0;

  return (
    <div>
      {/* StatBar */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {/* Cap gauge */}
        <StatCard label="Daily send cap" value={capValue} sub={capSub}>
          <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: "var(--color-bg-page)" }}>
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${capFillWidth}%`, background: capFillColor }}
            />
          </div>
        </StatCard>

        {/* Deliverability health */}
        <StatCard
          label="Deliverability"
          value={deliverability?.tripped ? "Paused" : "Healthy"}
          valueColor={deliverability?.tripped ? "var(--color-error)" : "var(--color-success)"}
          sub={deliverability?.tripped ? "sending paused" : "all clear"}
        />

        {/* Meetings this week */}
        <StatCard label="Meetings" value={String(meetings)} sub="this week" />
      </div>

      {/* Ready for you */}
      {ready && (
        <section className="mt-4">
          <h2
            className="text-[10.5px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Ready for you
          </h2>
          {items.length === 0 ? (
            <div
              className="mt-2.5 rounded-xl p-4 text-center text-[13px]"
              style={{
                background: "var(--color-bg-card)",
                border: "1px solid var(--color-border-default)",
                color: "var(--color-text-tertiary)",
              }}
            >
              You&apos;re all caught up
            </div>
          ) : (
            <div ref={listRef} className="mt-2.5 space-y-2">
              {items.map((item, i) => {
                const selected = i === selectedIndex;
                return (
                  <button
                    key={item.key}
                    type="button"
                    data-cockpit-idx={i}
                    onClick={() => router.push(item.href)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors"
                    style={{
                      background: selected ? "var(--color-bg-hover)" : "var(--color-bg-card)",
                      border: selected ? "1px solid var(--color-accent)" : "1px solid var(--color-border-default)",
                    }}
                  >
                    <span
                      className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg px-1.5 text-[13px] font-bold tabular-nums"
                      style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
                    >
                      {item.count}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        {item.label}
                      </p>
                      <p className="truncate text-[11.5px]" style={{ color: "var(--color-text-tertiary)" }}>
                        {item.why}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
