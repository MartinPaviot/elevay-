"use client";

import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  BarChart3,
  Loader2,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* ── Types ── */

interface ForecastScenario {
  period: string;
  p10: number;
  p50: number;
  p90: number;
  mean: number;
  dealCount: number;
}

interface TopDeal {
  id: string;
  name: string;
  value: number;
  winProbability: number;
  expectedCloseWeek: string;
}

interface ForecastResult {
  scenarios: ForecastScenario[];
  topDeals: TopDeal[];
  riskFactors: string[];
  simulationCount: number;
  computedAt: string;
}

/* ── Helpers ── */

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function periodLabel(period: string): string {
  // "2026-05" -> "May 2026", "2026-Q2" -> "Q2 2026"
  if (period.includes("Q")) {
    return `${period.slice(5)} ${period.slice(0, 4)}`;
  }
  if (period.includes("W")) {
    return `Week ${period.slice(6)}, ${period.slice(0, 4)}`;
  }
  const [year, month] = period.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}

/* ── Main Component ── */

export function RevenueForecast() {
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchForecast();
  }, []);

  async function fetchForecast() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/forecast?granularity=month&horizon=3&simulations=10000");
      if (res.ok) {
        const data = await res.json();
        setForecast(data);
      } else {
        setError("Failed to load forecast");
      }
    } catch {
      setError("Failed to load forecast");
    } finally {
      setLoading(false);
    }
  }

  async function refreshForecast() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/forecast?granularity=month&horizon=3&simulations=10000");
      if (res.ok) {
        const data = await res.json();
        setForecast(data);
      } else {
        setError("Failed to refresh forecast");
      }
    } catch {
      setError("Failed to refresh forecast");
    } finally {
      setRefreshing(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <Card>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={14} style={{ color: "var(--color-accent)" }} />
            <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>
              Revenue Forecast
            </span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Loader2 size={14} className="animate-spin" style={{ color: "var(--color-accent)" }} />
            <span className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>Running Monte Carlo simulation...</span>
          </div>
        </div>
      </Card>
    );
  }

  // No data or error
  if (!forecast || forecast.scenarios.length === 0) {
    return (
      <Card>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={14} style={{ color: "var(--color-text-tertiary)" }} />
            <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
              Revenue Forecast
            </span>
          </div>
          <p className="text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
            {error || "No open deals in pipeline. Add opportunities to generate a forecast."}
          </p>
        </div>
      </Card>
    );
  }

  const maxP90 = Math.max(...forecast.scenarios.map(s => s.p90), 1);

  return (
    <Card>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3"
        style={{ borderBottom: expanded ? "1px solid var(--color-border-default)" : "none" }}
      >
        <div className="flex items-center gap-2">
          <BarChart3 size={14} style={{ color: "var(--color-accent)" }} />
          <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>
            Revenue Forecast
          </span>
          {!expanded && forecast.scenarios.length > 0 && (
            <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
              Next month: {formatCurrency(forecast.scenarios[0].p10)} - {formatCurrency(forecast.scenarios[0].p90)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="icon"
            size="sm"
            onClick={(e) => { e.stopPropagation(); refreshForecast(); }}
            disabled={refreshing}
            title="Refresh forecast"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          </Button>
          {expanded ? <ChevronUp size={14} style={{ color: "var(--color-text-tertiary)" }} /> : <ChevronDown size={14} style={{ color: "var(--color-text-tertiary)" }} />}
        </div>
      </button>

      {error && (
        <p className="px-4 py-2 text-[11px]" style={{ color: "var(--color-error)" }}>{error}</p>
      )}

      {expanded && (
        <div className="px-4 py-3 space-y-4">
          {/* Range Bars */}
          <div className="space-y-3">
            {forecast.scenarios.map((scenario) => (
              <div key={scenario.period}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {periodLabel(scenario.period)}
                  </span>
                  <span className="text-[11px] tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
                    {formatCurrency(scenario.p10)} - {formatCurrency(scenario.p50)} - {formatCurrency(scenario.p90)}
                  </span>
                </div>

                {/* Bar visualization */}
                <div className="relative h-7 rounded-md overflow-hidden" style={{ background: "var(--color-bg-hover)" }}>
                  {/* P10-P90 range (full bar) */}
                  <div
                    className="absolute top-0 h-full rounded-md"
                    style={{
                      left: `${(scenario.p10 / maxP90) * 100}%`,
                      width: `${Math.max(((scenario.p90 - scenario.p10) / maxP90) * 100, 2)}%`,
                      background: "linear-gradient(90deg, #ef4444 0%, #f59e0b 40%, #22c55e 100%)",
                      opacity: 0.25,
                    }}
                  />

                  {/* P10 marker */}
                  <div
                    className="absolute top-0 h-full"
                    style={{
                      left: `${(scenario.p10 / maxP90) * 100}%`,
                      width: 2,
                      background: "#ef4444",
                    }}
                  />

                  {/* P50 marker (thicker, prominent) */}
                  <div
                    className="absolute top-0 h-full"
                    style={{
                      left: `${(scenario.p50 / maxP90) * 100}%`,
                      width: 3,
                      background: "#f59e0b",
                      boxShadow: "0 0 4px rgba(245, 158, 11, 0.4)",
                    }}
                  />

                  {/* P90 marker */}
                  <div
                    className="absolute top-0 h-full"
                    style={{
                      left: `${Math.min((scenario.p90 / maxP90) * 100, 99.5)}%`,
                      width: 2,
                      background: "#22c55e",
                    }}
                  />

                  {/* Labels inside bar */}
                  <div className="absolute inset-0 flex items-center justify-between px-2">
                    <span className="text-[9px] font-medium" style={{ color: "#ef4444" }}>
                      P10
                    </span>
                    <span className="text-[9px] font-bold" style={{ color: "#f59e0b" }}>
                      P50
                    </span>
                    <span className="text-[9px] font-medium" style={{ color: "#22c55e" }}>
                      P90
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    {scenario.dealCount} deal{scenario.dealCount !== 1 ? "s" : ""} contributing
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    Mean: {formatCurrency(scenario.mean)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Simulation footnote */}
          <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
            Based on {forecast.simulationCount.toLocaleString()} Monte Carlo simulations
            {forecast.computedAt && ` -- computed ${new Date(forecast.computedAt).toLocaleString()}`}
          </p>

          {/* Top Deals Table */}
          {forecast.topDeals.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={12} style={{ color: "var(--color-text-tertiary)" }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
                  Top Deals by Expected Value
                </span>
              </div>
              <div className="rounded-md overflow-hidden" style={{ border: "1px solid var(--color-border-default)" }}>
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ background: "var(--color-bg-hover)" }}>
                      <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Deal</th>
                      <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: "var(--color-text-tertiary)" }}>Value</th>
                      <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-right" style={{ color: "var(--color-text-tertiary)" }}>Win Prob.</th>
                      <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Expected Close</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.topDeals.slice(0, 5).map((deal) => (
                      <tr
                        key={deal.id}
                        style={{ borderTop: "1px solid var(--color-border-default)" }}
                      >
                        <td className="px-3 py-2">
                          <span className="text-[12px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                            {deal.name}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="text-[12px] font-medium tabular-nums" style={{ color: "var(--color-success)" }}>
                            {formatCurrency(deal.value)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <ProbabilityBadge probability={deal.winProbability} />
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-[11px] tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
                            {deal.expectedCloseWeek}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Risk Factors */}
          {forecast.riskFactors.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle size={12} style={{ color: "var(--color-warning)" }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
                  Risk Factors
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {forecast.riskFactors.map((risk, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px]"
                    style={{
                      background: "var(--color-warning-soft)",
                      color: "var(--color-warning)",
                      border: "1px solid var(--color-warning)20",
                    }}
                  >
                    <AlertTriangle size={10} />
                    {risk}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ── Probability Badge ── */

function ProbabilityBadge({ probability }: { probability: number }) {
  const pct = Math.round(probability * 100);
  let variant: "success" | "warning" | "error" | "neutral" = "neutral";
  if (pct >= 60) variant = "success";
  else if (pct >= 30) variant = "warning";
  else if (pct > 0) variant = "error";

  return (
    <Badge variant={variant} size="sm">
      {pct}%
    </Badge>
  );
}
