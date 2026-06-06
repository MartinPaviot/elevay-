"use client";

/**
 * Persona search — Apollo-style "describe who you want to reach" in natural
 * language, right in the Accounts window. Parses the phrase into a structured
 * ICP (industries / sizes / geos / titles / seniorities), shows the live
 * Apollo match count, and saves it as the tenant ICP so it drives sourcing,
 * the daily call list, and fit scoring.
 */

import { useState } from "react";
import { Target, Loader2, Search, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface ParsedIcp {
  industries: string[];
  keywords: string[];
  companySizes: string[];
  geographies: string[];
  excludeGeographies: string[];
  technologies: string[];
  revenueMin: number | null;
  revenueMax: number | null;
  fundingRecencyDays: number | null;
  titles: string[];
  seniorities: string[];
}

const EMPTY: ParsedIcp = {
  industries: [], keywords: [], companySizes: [], geographies: [], excludeGeographies: [],
  technologies: [], revenueMin: null, revenueMax: null, fundingRecencyDays: null, titles: [], seniorities: [],
};

const EXAMPLES = [
  "VP Engineering and CTOs at Series B fintech in France, 50-200 employees",
  "decision makers at mid-market healthcare companies in Suisse romande",
  "Heads of Sales at B2B SaaS using Salesforce, 200-1000, recently funded",
];

export function PersonaSearch({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const { toast } = useToast();
  const [phrase, setPhrase] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [icp, setIcp] = useState<ParsedIcp | null>(null);
  const [summary, setSummary] = useState("");
  const [estimate, setEstimate] = useState<{ total: number | null; capped?: boolean; gated?: boolean } | null>(null);

  async function parse(q: string) {
    if (!q.trim()) return;
    setParsing(true);
    setEstimate(null);
    try {
      const res = await fetch("/api/icp/parse-nl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Couldn't understand that — try rephrasing", "error");
        return;
      }
      const parsed: ParsedIcp = { ...EMPTY, ...data.icp };
      setIcp(parsed);
      setSummary(data.summary || "");
      void runEstimate(parsed);
    } catch {
      toast("Network error — try again", "error");
    } finally {
      setParsing(false);
    }
  }

  async function runEstimate(p: ParsedIcp) {
    try {
      const res = await fetch("/api/tam/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industries: p.industries,
          keywords: p.keywords,
          companySizes: p.companySizes,
          geographies: p.geographies,
          excludeGeographies: p.excludeGeographies,
          technologies: p.technologies,
          revenueMin: p.revenueMin,
          revenueMax: p.revenueMax,
          fundingRecencyDays: p.fundingRecencyDays,
        }),
      });
      if (res.status === 402 || res.status === 500) {
        setEstimate({ total: null, gated: true });
        return;
      }
      const data = await res.json();
      setEstimate({ total: data.total ?? null, capped: data.capped });
    } catch {
      setEstimate({ total: null, gated: true });
    }
  }

  function removeChip(field: keyof ParsedIcp, value: string) {
    if (!icp) return;
    const next = { ...icp, [field]: (icp[field] as string[]).filter((v) => v !== value) };
    setIcp(next);
    void runEstimate(next);
  }

  async function save() {
    if (!icp) return;
    setSaving(true);
    try {
      const res = await fetch("/api/icp/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(icp),
      });
      if (!res.ok) {
        toast("Couldn't save the ICP", "error");
        return;
      }
      toast("Saved as your ICP — Elevay will source these accounts", "success");
      onSaved?.();
      onClose();
    } catch {
      toast("Network error — try again", "error");
    } finally {
      setSaving(false);
    }
  }

  const chip = (field: keyof ParsedIcp, value: string, tone: "default" | "exclude" = "default") => (
    <span
      key={field + value}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px]"
      style={{
        background: tone === "exclude" ? "var(--color-error-soft)" : "var(--color-accent-soft)",
        color: tone === "exclude" ? "var(--color-error)" : "var(--color-accent)",
      }}
    >
      {value}
      <button type="button" onClick={() => removeChip(field, value)} className="opacity-60 hover:opacity-100"><X size={11} /></button>
    </span>
  );

  const Group = ({ label, field, tone }: { label: string; field: keyof ParsedIcp; tone?: "default" | "exclude" }) => {
    const vals = (icp?.[field] as string[]) ?? [];
    if (vals.length === 0) return null;
    return (
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--color-text-tertiary)" }}>{label}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">{vals.map((v) => chip(field, v, tone))}</div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto p-6" style={{ background: "color-mix(in srgb, var(--color-bg-base) 70%, transparent)" }} onClick={onClose}>
      <div
        className="mt-[6vh] w-full max-w-xl rounded-2xl p-6"
        style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-default)", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
            <Target size={18} />
          </div>
          <div className="flex-1">
            <h2 className="text-[16px] font-semibold" style={{ color: "var(--color-text-primary)", letterSpacing: "-0.3px" }}>Find your ideal accounts</h2>
            <p className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>Describe who you want to reach in plain language — Elevay turns it into your target audience.</p>
          </div>
          <button type="button" onClick={onClose} style={{ color: "var(--color-text-tertiary)" }}><X size={18} /></button>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && phrase.trim()) parse(phrase); }}
            placeholder="e.g. VP Engineering at Series B fintech in France, 50-200"
            className="flex-1 rounded-lg px-3 py-2 text-[13px]"
            style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border-default)", color: "var(--color-text-primary)" }}
            autoFocus
          />
          <Button variant="gradient" disabled={parsing || !phrase.trim()} onClick={() => parse(phrase)}>
            {parsing ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {icp ? "Refine" : "Search"}
          </Button>
        </div>

        {!icp && (
          <div className="mt-3 flex flex-col gap-1.5">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => { setPhrase(ex); parse(ex); }}
                className="text-left text-[12px] hover:underline" style={{ color: "var(--color-text-tertiary)" }}>
                &ldquo;{ex}&rdquo;
              </button>
            ))}
          </div>
        )}

        {icp && (
          <div className="mt-5 space-y-3.5">
            {summary && (
              <p className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>{summary}</p>
            )}
            <Group label="Industries" field="industries" />
            <Group label="Keywords" field="keywords" />
            <Group label="Company size" field="companySizes" />
            <Group label="Geographies" field="geographies" />
            <Group label="Exclude" field="excludeGeographies" tone="exclude" />
            <Group label="Technologies" field="technologies" />
            <Group label="Titles (persona)" field="titles" />
            <Group label="Seniority" field="seniorities" />

            <div className="rounded-lg px-3.5 py-2.5 text-[13px]" style={{ background: "var(--color-bg-hover)", color: "var(--color-text-secondary)" }}>
              {estimate === null ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Estimating reach…</span>
              ) : estimate.gated ? (
                <span>Connect Apollo in Settings to see the live match count. Your ICP still saves and drives sourcing.</span>
              ) : estimate.total === null ? (
                <span>Couldn&rsquo;t fetch the live count right now.</span>
              ) : (
                <span>≈ <strong style={{ color: "var(--color-text-primary)" }}>{estimate.total.toLocaleString()}{estimate.capped ? "+" : ""}</strong> companies match this audience.</span>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="gradient" className="flex-1" disabled={saving} onClick={save}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Save as my ICP
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
