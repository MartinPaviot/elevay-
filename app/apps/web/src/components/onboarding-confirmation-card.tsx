"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Shield, Target, Loader2, Check } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

/**
 * WS-2 v2 onboarding confirmation card — collapses v1's welcome +
 * product + icp steps into a single page with three zones:
 *
 * 1. Identity + product (Category A fields)
 *    — shown with AI-inference attribution badges where applicable.
 *    — editable inline.
 *    — `aiTone` surfaces the LLM-suggested value explicitly (no silent
 *      override, per WS-0 audit bug BUG-WS0-004).
 *
 * 2. Targeting (Category B fields)
 *    — preset verticals + tighter/looser adjuster (simplified for v1
 *      of this component; full adjuster lands in a follow-up polish
 *      pass once Martin has the UX signal).
 *    — live Apollo count via GET /api/tam/estimate, debounced 400 ms.
 *
 * 3. Guardrails (Category C fields)
 *    — informational reuse of WS-1 infrastructure; the actual controls
 *      live in Settings → Guardrails. The card surfaces the user's
 *      current defaults so they know what they're opting into.
 *
 * Gated behind `onboarding.v2.confirmation-card` feature flag — the
 * parent wizard decides whether to render this component vs v1.
 */

export interface ConfirmationCardInferred {
  fullName: string;
  companyName: string;
  domain: string;
  /** Pre-filled from analyze-website; empty string when the LLM
   *  couldn't infer a meaningful description. */
  productDescription: string;
  /** Suggested tone from the LLM, or null when no suggestion. When
   *  non-null, the UI renders an attribution badge next to the tone
   *  radio. */
  suggestedTone: "Formal" | "Direct" | "Casual" | null;
  /** Current aiTone (starts at the tenant's default or "Direct"). */
  aiTone: string;
  /** Inferred from browser; user can override. */
  language: string;
  timezone: string;
  /** 0-1 confidence from the LLM's ICP inference. */
  overallConfidence: number;
  /** Fields flagged < 0.7 confidence by the LLM — UI highlights them. */
  lowConfidenceFields: string[];
}

export interface ConfirmationCardTargeting {
  industries: string[];
  companySizes: string[];
  geographies: string[];
  targetSeniorities: string[];
  targetDepartments: string[];
}

export interface ConfirmationCardGuardrails {
  approvalMode: "review-each" | "batch-daily" | "auto-high-confidence";
  llmMonthlyCostCapUsd: number;
  sendingMailboxMode: string;
  sendingDailyCapPrimary: number;
}

export interface ConfirmationCardProps {
  inferred: ConfirmationCardInferred;
  targeting: ConfirmationCardTargeting;
  guardrails: ConfirmationCardGuardrails;
  onConfirm: (next: {
    identity: ConfirmationCardInferred;
    targeting: ConfirmationCardTargeting;
  }) => Promise<void>;
  onEdit: (next: {
    identity: ConfirmationCardInferred;
    targeting: ConfirmationCardTargeting;
  }) => void;
}

const TONE_OPTIONS: Array<"Formal" | "Direct" | "Casual"> = [
  "Formal",
  "Direct",
  "Casual",
];

function InferenceBadge({
  source,
  confidence,
}: {
  source: string;
  confidence?: number;
}) {
  const low = typeof confidence === "number" && confidence < 0.7;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]"
      style={{
        background: low
          ? "rgba(234,179,8,.12)"
          : "rgba(44,107,237,.08)",
        color: low ? "rgb(133,77,14)" : "var(--color-accent)",
      }}
      title={
        low
          ? "AI inferred this with low confidence — please verify"
          : `AI inferred this from ${source}`
      }
    >
      <Sparkles size={10} />
      AI · {source}
      {low && " · verify"}
    </span>
  );
}

/** Debounced Apollo count query — hits /api/tam/estimate with the
 *  current targeting params. Returns loading state + count + whether
 *  Apollo capped. */
function useApolloCount(targeting: ConfirmationCardTargeting) {
  const [count, setCount] = useState<{
    total: number | null;
    capped: boolean;
    loading: boolean;
  }>({ total: null, capped: false, loading: false });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (targeting.industries.length === 0 && targeting.companySizes.length === 0) {
      setCount({ total: null, capped: false, loading: false });
      return;
    }
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setCount((prev) => ({ ...prev, loading: true }));
      fetch("/api/tam/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industries: targeting.industries,
          companySizes: targeting.companySizes,
          geographies: targeting.geographies,
          targetSeniorities: targeting.targetSeniorities,
          targetDepartments: targeting.targetDepartments,
        }),
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          setCount({
            total: data.total ?? null,
            capped: !!data.capped,
            loading: false,
          });
        })
        .catch(() => {
          setCount((prev) => ({ ...prev, loading: false }));
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [targeting]);

  return count;
}

export function OnboardingConfirmationCard({
  inferred: inferredInit,
  targeting: targetingInit,
  guardrails,
  onConfirm,
  onEdit,
}: ConfirmationCardProps) {
  const { toast } = useToast();
  const [identity, setIdentity] = useState(inferredInit);
  const [targeting, setTargeting] = useState(targetingInit);
  const [confirming, setConfirming] = useState(false);
  const apolloCount = useApolloCount(targeting);

  const updateIdentity = useCallback(
    (next: Partial<ConfirmationCardInferred>) => {
      setIdentity((prev) => {
        const merged = { ...prev, ...next };
        onEdit({ identity: merged, targeting });
        return merged;
      });
    },
    [onEdit, targeting],
  );

  const updateTargeting = useCallback(
    (next: Partial<ConfirmationCardTargeting>) => {
      setTargeting((prev) => {
        const merged = { ...prev, ...next };
        onEdit({ identity, targeting: merged });
        return merged;
      });
    },
    [onEdit, identity],
  );

  async function handleConfirm() {
    setConfirming(true);
    try {
      await onConfirm({ identity, targeting });
    } catch (err) {
      console.warn("confirmation-card: confirm failed", err);
      toast("Couldn't save your setup — please retry", "error");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Zone 1 — Identity + product */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: "var(--color-accent)" }} />
            <h2
              className="text-[14px] font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Here&apos;s what I picked up about you
            </h2>
          </div>
          <p className="mt-1 text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
            Edit anything that doesn&apos;t match. Each field shows where the
            inference came from.
          </p>

          <div className="mt-3 space-y-3">
            <Field
              label="Your name"
              value={identity.fullName}
              onChange={(v) => updateIdentity({ fullName: v })}
            />
            <Field
              label="Company"
              value={identity.companyName}
              onChange={(v) => updateIdentity({ companyName: v })}
              badge={identity.domain ? (
                <InferenceBadge source={identity.domain} />
              ) : null}
            />
            <Field
              label="Company website"
              value={identity.domain}
              onChange={(v) => updateIdentity({ domain: v })}
              badge={<InferenceBadge source="your email" />}
            />
            <div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  What you sell
                </label>
                {identity.productDescription && (
                  <InferenceBadge
                    source="your website"
                    confidence={identity.overallConfidence}
                  />
                )}
              </div>
              <textarea
                value={identity.productDescription}
                onChange={(e) => updateIdentity({ productDescription: e.target.value })}
                rows={2}
                className="mt-0.5 w-full rounded-md px-2 py-1 text-[12px]"
                style={{
                  background: "var(--color-bg-page)",
                  border: "1px solid var(--color-border-default)",
                  color: "var(--color-text-primary)",
                  resize: "vertical",
                }}
              />
            </div>

            {/* aiTone — explicit surface (silent override removed) */}
            <div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  Email tone
                </label>
                {identity.suggestedTone && identity.suggestedTone !== identity.aiTone && (
                  <span className="text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
                    AI suggests <strong>{identity.suggestedTone}</strong> — change below if needed
                  </span>
                )}
              </div>
              <div className="mt-1 flex gap-1.5">
                {TONE_OPTIONS.map((tone) => {
                  const active = identity.aiTone === tone;
                  return (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => updateIdentity({ aiTone: tone })}
                      className="rounded-full px-3 py-1 text-[11px]"
                      style={{
                        background: active
                          ? "var(--color-accent)"
                          : "var(--color-bg-page)",
                        color: active
                          ? "white"
                          : "var(--color-text-primary)",
                        border: `1px solid ${
                          active
                            ? "var(--color-accent)"
                            : "var(--color-border-default)"
                        }`,
                      }}
                    >
                      {tone}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Zone 2 — Targeting */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-2">
            <Target size={16} style={{ color: "var(--color-accent)" }} />
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Who you&apos;re going after
            </h2>
          </div>
          <p className="mt-1 text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
            Adjust anything that doesn&apos;t fit. The live count below reflects your current criteria.
          </p>

          <div className="mt-3 space-y-2">
            <TargetingRow
              label="Industries"
              items={targeting.industries}
              onChange={(v) => updateTargeting({ industries: v })}
              placeholder="e.g. Computer Software, Financial Services"
            />
            <TargetingRow
              label="Company sizes"
              items={targeting.companySizes}
              onChange={(v) => updateTargeting({ companySizes: v })}
              placeholder="e.g. 11-50, 51-200"
            />
            <TargetingRow
              label="Geographies"
              items={targeting.geographies}
              onChange={(v) => updateTargeting({ geographies: v })}
              placeholder="e.g. United States, France"
            />
            <TargetingRow
              label="Seniorities"
              items={targeting.targetSeniorities}
              onChange={(v) => updateTargeting({ targetSeniorities: v })}
              placeholder="e.g. C-Suite, VP"
            />
            <TargetingRow
              label="Departments"
              items={targeting.targetDepartments}
              onChange={(v) => updateTargeting({ targetDepartments: v })}
              placeholder="e.g. Engineering, Sales"
            />
          </div>

          <div
            className="mt-3 rounded-md p-2 text-[12px]"
            style={{
              background: "var(--color-bg-page)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            {apolloCount.loading ? (
              <span className="inline-flex items-center gap-1" style={{ color: "var(--color-text-tertiary)" }}>
                <Loader2 size={12} className="animate-spin" /> Computing TAM…
              </span>
            ) : apolloCount.total === null ? (
              <span style={{ color: "var(--color-text-tertiary)" }}>
                Add at least one industry or size to see the TAM estimate.
              </span>
            ) : (
              <span style={{ color: "var(--color-text-primary)" }}>
                <strong>
                  ≈ {apolloCount.capped ? "100,000+" : apolloCount.total.toLocaleString()}
                </strong>{" "}
                companies match your criteria.
              </span>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Zone 3 — Guardrails summary */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-2">
            <Shield size={16} style={{ color: "var(--color-accent)" }} />
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Your sending protections
            </h2>
          </div>
          <p className="mt-1 text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
            By default, Elevay sends your first emails from your primary inbox with protective caps
            ({guardrails.sendingDailyCapPrimary}/day max, warm follow-ups to existing contacts only).
            We deliberately don&apos;t send cold outreach from your primary domain — it would damage your
            deliverability within weeks. When you&apos;re ready to scale to cold outreach, we&apos;ll walk you
            through setting up dedicated sending infrastructure.
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-[12px]">
            <div>
              <dt style={{ color: "var(--color-text-tertiary)" }}>Approval mode</dt>
              <dd className="mt-0.5 font-medium" style={{ color: "var(--color-text-primary)" }}>
                {guardrails.approvalMode}
              </dd>
            </div>
            <div>
              <dt style={{ color: "var(--color-text-tertiary)" }}>LLM budget</dt>
              <dd className="mt-0.5 font-medium" style={{ color: "var(--color-text-primary)" }}>
                ${guardrails.llmMonthlyCostCapUsd}/mo
              </dd>
            </div>
            <div>
              <dt style={{ color: "var(--color-text-tertiary)" }}>Sending mode</dt>
              <dd className="mt-0.5 font-medium" style={{ color: "var(--color-text-primary)" }}>
                {guardrails.sendingMailboxMode}
              </dd>
            </div>
          </dl>
          <a
            href="/settings/guardrails"
            className="mt-3 inline-block text-[12px]"
            style={{ color: "var(--color-accent)" }}
          >
            Adjust guardrails →
          </a>
        </CardBody>
      </Card>

      <div className="pt-2">
        <Button
          onClick={() => void handleConfirm()}
          disabled={confirming}
          size="md"
        >
          {confirming ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Building your pipeline…
            </>
          ) : (
            <>
              <Check size={14} /> Looks right — build my pipeline
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  badge,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  badge?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <label
          className="text-[11px] font-medium"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {label}
        </label>
        {badge}
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TargetingRow({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");
  return (
    <div>
      <label
        className="text-[11px] font-medium"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {label}
      </label>
      <div className="mt-0.5 flex flex-wrap gap-1">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
            style={{ background: "var(--color-accent)", color: "white" }}
          >
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((x) => x !== item))}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
              }}
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              e.preventDefault();
              if (!items.includes(input.trim())) {
                onChange([...items, input.trim()]);
              }
              setInput("");
            }
          }}
          placeholder={items.length === 0 ? placeholder : "Add more…"}
          className="rounded-full px-2 py-0.5 text-[11px]"
          style={{
            background: "var(--color-bg-page)",
            border: "1px solid var(--color-border-default)",
            color: "var(--color-text-primary)",
            minWidth: 80,
          }}
        />
      </div>
    </div>
  );
}
