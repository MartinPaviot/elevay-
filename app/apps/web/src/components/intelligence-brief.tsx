"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface IntelligenceBriefProps {
  accountId: string;
}

interface BriefData {
  brief: string;
  keyRelationships: string[];
  suggestedAction: string;
}

export function IntelligenceBrief({ accountId }: IntelligenceBriefProps) {
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    fetch(`/api/accounts/${accountId}/intelligence`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [accountId]);

  if (loading) {
    return (
      <div
        className="rounded-lg p-3 mb-3"
        style={{ background: "var(--color-accent-soft)", border: "1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)" }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={12} style={{ color: "var(--color-accent)" }} />
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>
            AI Intelligence
          </span>
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5 mt-1.5" />
        <Skeleton className="h-3 w-3/5 mt-1.5" />
      </div>
    );
  }

  if (!data || !data.brief || data.brief.includes("Not enough data")) {
    return (
      <div
        className="rounded-lg p-3 mb-3"
        style={{ background: "var(--color-bg-page)", border: "1px solid var(--color-border-default)" }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles size={12} style={{ color: "var(--color-text-tertiary)" }} />
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
            AI Intelligence
          </span>
        </div>
        <p className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
          Not enough data yet. Connect your email or add activities to generate insights.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg p-3 mb-3"
      style={{ background: "var(--color-accent-soft)", border: "1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)" }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={12} style={{ color: "var(--color-accent)" }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>
          AI Intelligence
        </span>
      </div>
      <p className="text-[12px] leading-[18px]" style={{ color: "var(--color-text-primary)" }}>
        {data.brief}
      </p>
      {data.keyRelationships.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {data.keyRelationships.map((r, i) => (
            <span
              key={i}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: "var(--color-bg-card)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border-default)" }}
            >
              {r}
            </span>
          ))}
        </div>
      )}
      {data.suggestedAction && (
        <p className="mt-2 text-[11px] font-medium" style={{ color: "var(--color-accent)" }}>
          {data.suggestedAction}
        </p>
      )}
    </div>
  );
}
