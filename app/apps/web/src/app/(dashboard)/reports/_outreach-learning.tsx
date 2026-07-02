"use client";

/**
 * Outreach-autopilot T11 (M11-R1) — the OUTCOMES-FIRST strip that leads the
 * Reports results screen, plus the per-gate block-rate section and the
 * persona x signal decisions table. All three read from one call to
 * GET /api/reports/outreach-learning (tenant-scoped, read-only).
 *
 * Metric prominence is the point: meetings HELD reads largest and in accent,
 * then booked, then positive replies, then deals advanced; `sends` is grayed
 * (var(--color-text-tertiary)) and last — volume, never the headline.
 * Open rate deliberately does NOT live here: it is a deliverability
 * diagnostic (Apple MPP auto-opens inflate it) and lives on the
 * deliverability screen. Do not add an open-rate KPI to this results view.
 */

import { useState, useEffect } from "react";
import { Card, CardBody } from "@/components/ui/card";
import {
  CalendarCheck,
  CalendarClock,
  MessageSquareReply,
  TrendingUp,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

interface OutcomeCounts {
  meetingsHeld: number;
  meetingsBooked: number;
  positiveReplies: number;
  dealsAdvanced: number;
  sends: number;
}

interface GateBlockRate {
  gate: number;
  rubricVersion: string;
  path: string | null;
  n: number;
  blocked: number;
  blockRate: number;
}

interface DecisionBucket {
  persona: string;
  signal: string;
  n: number;
  lift: number;
  positivityAvg: number;
}

interface LearningResponse {
  window: { days: number; since: string };
  outcomes: OutcomeCounts;
  gates: GateBlockRate[];
  decisions: DecisionBucket[];
  decisionsSummary: { total: number; baseline: number | null };
}

/** Per-gate guided reading. No em-dashes in copy (project fixture rule). */
const GATE_META: Record<number, { label: string; reading: string }> = {
  1: {
    label: "Targeting",
    reading:
      "A high block rate means few contacts clear the fresh-signal and ICP bar. Widen the ICP or refresh signals.",
  },
  2: {
    label: "Factual",
    reading:
      "A high block rate means drafts assert claims the brief cannot ground. Load more assets or tighten the copy.",
  },
  3: {
    label: "Interchangeability",
    reading:
      "A high block rate means messages read as templated. Add per-prospect specifics.",
  },
  4: {
    label: "Copy quality",
    reading:
      "A high block rate means copy scores below the quality threshold. Review tone, length, and the call to action.",
  },
  5: {
    label: "Deliverability",
    reading:
      "A high block rate means content trips spam or deliverability checks. Revise wording and links.",
  },
};

function sectionTitle(text: string) {
  return (
    <h2
      className="mt-8 mb-3 text-[12px] font-semibold uppercase tracking-wider"
      style={{ color: "var(--color-text-tertiary)" }}
    >
      {text}
    </h2>
  );
}

/** One outcome KPI tile. `emphasis` drives the outcomes-first hierarchy:
 *  "lead" = meetings held (accent, largest); "outcome" = other real outcomes;
 *  "volume" = sends (grayed, de-emphasized, never the headline). */
function OutcomeTile({
  label,
  value,
  icon: Icon,
  emphasis,
}: {
  label: string;
  value: number;
  icon: typeof CalendarCheck;
  emphasis: "lead" | "outcome" | "volume";
}) {
  const valueColor =
    emphasis === "lead"
      ? "var(--color-accent)"
      : emphasis === "volume"
        ? "var(--color-text-tertiary)"
        : "var(--color-text-primary)";
  const valueSize =
    emphasis === "lead"
      ? "text-[26px]"
      : emphasis === "volume"
        ? "text-[18px]"
        : "text-[22px]";
  return (
    <Card className={emphasis === "volume" ? "opacity-80" : ""}>
      <CardBody>
        <div className="flex items-center gap-1.5">
          <Icon
            size={13}
            style={{
              color:
                emphasis === "volume"
                  ? "var(--color-text-muted)"
                  : "var(--color-text-tertiary)",
            }}
          />
          <p
            className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {label}
          </p>
        </div>
        <p
          className={`mt-1 font-bold ${valueSize}`}
          style={{ color: valueColor }}
        >
          {value.toLocaleString()}
        </p>
        {emphasis === "volume" && (
          <p
            className="text-[10px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Volume
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function GateRow({ g }: { g: GateBlockRate }) {
  const meta = GATE_META[g.gate];
  const pct = Math.round(g.blockRate * 100);
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck
            size={13}
            className="shrink-0"
            style={{ color: "var(--color-text-tertiary)" }}
          />
          <span
            className="text-[13px] font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            G{g.gate} {meta?.label ?? "Gate"}
          </span>
          {g.path && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px]"
              style={{
                background: "var(--color-bg-page)",
                color: "var(--color-text-muted)",
              }}
            >
              {g.path}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-[13px] font-semibold tabular-nums"
            style={{ color: "var(--color-text-primary)" }}
          >
            {pct}%
          </span>
          <span
            className="text-[11px] tabular-nums"
            style={{ color: "var(--color-text-muted)" }}
          >
            {g.blocked}/{g.n}
          </span>
        </div>
      </div>
      {/* Inline block-rate bar (reports/deliverability pattern, no new gauge). */}
      <div className="mt-1.5 h-1.5 w-full rounded-full bg-[var(--color-bg-page)]">
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: "var(--color-accent)",
          }}
        />
      </div>
      {meta && (
        <p
          className="mt-1 text-[11px] leading-relaxed"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {meta.reading}
        </p>
      )}
    </div>
  );
}

export function OutreachLearning() {
  const [data, setData] = useState<LearningResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/reports/outreach-learning");
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as LearningResponse;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fail-soft: a results screen that cannot load its aggregates simply
  // renders nothing extra rather than blocking the always-on cards below.
  if (failed && !data) return null;

  const days = data?.window.days ?? 30;
  // Cold-start = no OUTCOME landed yet (sends is volume, not an outcome).
  const noOutcomesYet =
    !!data &&
    data.outcomes.meetingsHeld === 0 &&
    data.outcomes.meetingsBooked === 0 &&
    data.outcomes.positiveReplies === 0 &&
    data.outcomes.dealsAdvanced === 0;

  return (
    <section data-testid="outreach-learning">
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          className="text-[12px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Outreach results
        </h2>
        <span
          className="text-[11px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          Last {days} days
        </span>
      </div>

      {loading || !data ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardBody>
                <div className="h-3 w-20 rounded bg-[var(--color-bg-page)]" />
                <div className="mt-2 h-6 w-12 rounded bg-[var(--color-bg-page)]" />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Outcomes-first strip: outcomes lead, sends grayed + last. */}
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <OutcomeTile
              label="Meetings held"
              value={data.outcomes.meetingsHeld}
              icon={CalendarCheck}
              emphasis="lead"
            />
            <OutcomeTile
              label="Meetings booked"
              value={data.outcomes.meetingsBooked}
              icon={CalendarClock}
              emphasis="outcome"
            />
            <OutcomeTile
              label="Positive replies"
              value={data.outcomes.positiveReplies}
              icon={MessageSquareReply}
              emphasis="outcome"
            />
            <OutcomeTile
              label="Deals advanced"
              value={data.outcomes.dealsAdvanced}
              icon={TrendingUp}
              emphasis="outcome"
            />
            <OutcomeTile
              label="Sends"
              value={data.outcomes.sends}
              icon={Send}
              emphasis="volume"
            />
          </div>

          {/* Cold-start framing (verify finding): five bare zeros read as
              "broken". When no OUTCOME has landed yet, contextualize the strip
              the way the forecast/cohort cards below do — "not yet", not
              "nothing works". Adapts to whether any outreach has gone out. */}
          {noOutcomesYet && (
            <div className="mt-2 flex items-start gap-2">
              <Sparkles
                size={14}
                className="mt-0.5 shrink-0"
                style={{ color: "var(--color-text-muted)" }}
              />
              <p
                className="text-[12px] leading-relaxed"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {data.outcomes.sends > 0
                  ? `${data.outcomes.sends.toLocaleString()} outreach sent in the last ${days} days. Meetings, replies, and advanced deals will populate here as they land.`
                  : "No outreach sent yet. Your first meetings, replies, and deals will appear here as the autopilot runs."}
              </p>
            </div>
          )}

          {/* Gates block-rate section. */}
          {sectionTitle("Quality gates: block rate")}
          <Card>
            <CardBody>
              {data.gates.length === 0 ? (
                <p
                  className="text-[12px]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  No gate decisions recorded in this window yet.
                </p>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {data.gates.map((g) => (
                    <GateRow key={`${g.gate}-${g.rubricVersion}-${g.path ?? "none"}`} g={g} />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Persona x signal decisions. */}
          {sectionTitle("What is working: persona x signal")}
          <Card>
            <CardBody>
              {data.decisions.length === 0 ? (
                <div className="flex items-start gap-2">
                  <Sparkles
                    size={14}
                    className="mt-0.5 shrink-0"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <p
                    className="text-[12px] leading-relaxed"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    Not enough resolved outcomes yet to surface a pattern.{" "}
                    {data.decisionsSummary.total} resolved decisions in the last{" "}
                    {days} days; patterns unlock as outcomes accrue.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead>
                      <tr style={{ color: "var(--color-text-tertiary)" }}>
                        <th className="pb-2 pr-3 font-medium">Persona</th>
                        <th className="pb-2 pr-3 font-medium">Signal</th>
                        <th className="pb-2 pr-3 text-right font-medium">n</th>
                        <th className="pb-2 text-right font-medium">Lift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.decisions.map((d, i) => {
                        const up = d.lift >= 0;
                        return (
                          <tr
                            key={i}
                            className="border-t border-[var(--color-border)]"
                          >
                            <td
                              className="py-2 pr-3"
                              style={{ color: "var(--color-text-primary)" }}
                            >
                              {d.persona}
                            </td>
                            <td
                              className="py-2 pr-3"
                              style={{ color: "var(--color-text-secondary)" }}
                            >
                              {d.signal}
                            </td>
                            <td
                              className="py-2 pr-3 text-right tabular-nums"
                              style={{ color: "var(--color-text-secondary)" }}
                            >
                              {d.n}
                            </td>
                            <td
                              className="py-2 text-right font-semibold tabular-nums"
                              style={{
                                color: up
                                  ? "var(--color-success, #17C3B2)"
                                  : "var(--color-error)",
                              }}
                            >
                              {up ? "+" : ""}
                              {d.lift.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </section>
  );
}
