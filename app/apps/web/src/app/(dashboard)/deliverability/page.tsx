"use client";

import { useState, useEffect } from "react";

interface DeliverabilityData {
  totalSent: number;
  totalOpened: number;
  totalReplied: number;
  totalBounced: number;
  spamComplaints: number;
  openRate: number;
  replyRate: number;
  bounceRate: number;
  spamRate: number;
  healthScore: number;
  healthLabel: string;
  warnings: string[];
  enrollmentsByStatus: Record<string, number>;
}

export default function DeliverabilityPage() {
  const [data, setData] = useState<DeliverabilityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/deliverability")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function getHealthColor(label: string) {
    if (label === "excellent") return "text-emerald-400";
    if (label === "good") return "text-blue-400";
    if (label === "fair") return "text-amber-400";
    return "text-red-400";
  }

  function getRateColor(rate: number, goodThreshold: number, badThreshold: number, inverse = false) {
    if (inverse) {
      if (rate <= goodThreshold) return "text-emerald-400";
      if (rate <= badThreshold) return "text-amber-400";
      return "text-red-400";
    }
    if (rate >= goodThreshold) return "text-emerald-400";
    if (rate >= badThreshold) return "text-amber-400";
    return "text-red-400";
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Deliverability</h1>
        <p className="mt-4 text-sm text-[#5a5a70]">Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Deliverability</h1>
        <p className="mt-4 text-sm text-[#5a5a70]">Failed to load deliverability data.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Deliverability</h1>
          <p className="mt-1 text-sm text-[#5a5a70]">
            Email sending health and monitoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-[#5a5a70]">Health Score</p>
            <p className={`text-2xl font-bold ${getHealthColor(data.healthLabel)}`}>
              {data.healthScore}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${getHealthColor(data.healthLabel)} bg-[#1e1f2a]`}>
            {data.healthLabel}
          </span>
        </div>
      </div>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {data.warnings.map((w, i) => (
            <div key={i} className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
              {w}
            </div>
          ))}
        </div>
      )}

      {/* KPI Grid */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border border-[#1e1f2a] bg-[#12131a] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#5a5a70]">Sent</p>
          <p className="mt-1 text-2xl font-semibold text-[#e8e8ed]">{data.totalSent}</p>
        </div>
        <div className="rounded-lg border border-[#1e1f2a] bg-[#12131a] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#5a5a70]">Open Rate</p>
          <p className={`mt-1 text-2xl font-semibold ${getRateColor(data.openRate, 30, 15)}`}>
            {data.openRate}%
          </p>
        </div>
        <div className="rounded-lg border border-[#1e1f2a] bg-[#12131a] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#5a5a70]">Reply Rate</p>
          <p className={`mt-1 text-2xl font-semibold ${getRateColor(data.replyRate, 5, 2)}`}>
            {data.replyRate}%
          </p>
        </div>
        <div className="rounded-lg border border-[#1e1f2a] bg-[#12131a] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#5a5a70]">Bounce Rate</p>
          <p className={`mt-1 text-2xl font-semibold ${getRateColor(data.bounceRate, 2, 5, true)}`}>
            {data.bounceRate}%
          </p>
        </div>
        <div className="rounded-lg border border-[#1e1f2a] bg-[#12131a] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#5a5a70]">Spam Rate</p>
          <p className={`mt-1 text-2xl font-semibold ${getRateColor(data.spamRate, 0.05, 0.1, true)}`}>
            {data.spamRate}%
          </p>
        </div>
        <div className="rounded-lg border border-[#1e1f2a] bg-[#12131a] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#5a5a70]">Replied</p>
          <p className="mt-1 text-2xl font-semibold text-[#e8e8ed]">{data.totalReplied}</p>
        </div>
      </div>

      {/* Enrollment Status */}
      {Object.keys(data.enrollmentsByStatus).length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8b8ba0]">
            Sequence Enrollments
          </h2>
          <div className="mt-3 flex gap-3 flex-wrap">
            {Object.entries(data.enrollmentsByStatus).map(([status, count]) => (
              <div key={status} className="rounded-lg border border-[#1e1f2a] bg-[#12131a] px-4 py-2">
                <span className="text-xs text-[#5a5a70] capitalize">{status}</span>
                <span className="ml-2 text-sm font-semibold text-[#e8e8ed]">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.totalSent === 0 && (
        <div className="mt-8 flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-[#5a5a70]">No emails sent yet</p>
            <p className="mt-1 text-sm text-[#5a5a70]">
              Start sending sequences to see deliverability metrics.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
