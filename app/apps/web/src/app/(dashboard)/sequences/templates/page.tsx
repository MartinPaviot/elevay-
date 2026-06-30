"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { LayoutTemplate, ArrowLeft, Mail, MessageSquare, Phone, Clock, Check } from "lucide-react";

type StepType = "email" | "linkedin_message" | "phone_task";

interface TemplateStepSummary {
  stepNumber: number;
  stepType: StepType;
  delayDays: number;
  subjectTemplate: string;
  valueAdded: string;
}
interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  triggerSignalTypes: string[];
  personaFit: string[];
  recipientBenefitAngle: string;
  channels: StepType[];
  stepCount: number;
  cadenceDays: number;
  steps: TemplateStepSummary[];
  instantiated: boolean;
}

/** FR labels for the trigger signal types. */
const SIGNAL_LABELS: Record<string, string> = {
  website_visit: "Website visit",
  post_funding: "Funding round",
  hiring_signal: "Hiring",
  product_launch: "Product launch",
  leadership_change: "Leadership change",
  tech_stack_change: "Tech stack change",
  exec_engagement: "Exec engagement",
  review_left: "Review left",
  competitor_mention: "Competitor mention",
};

const CHANNEL_ICON: Record<StepType, typeof Mail> = {
  email: Mail,
  linkedin_message: MessageSquare,
  phone_task: Phone,
};
const CHANNEL_LABEL: Record<StepType, string> = {
  email: "Email",
  linkedin_message: "LinkedIn",
  phone_task: "Call",
};

export default function SequenceTemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(false);
      const res = await fetch("/api/sequences/templates");
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const useTemplate = useCallback(
    async (t: TemplateSummary) => {
      setPendingId(t.id);
      try {
        const res = await fetch("/api/sequences/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId: t.id }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const { result } = await res.json();
        toast(
          result?.outcome === "skipped_exists"
            ? `« ${t.name} » is already in your sequences.`
            : `« ${t.name} » added as a draft — activate it when you're ready.`,
          "success",
        );
        setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, instantiated: true } : x)));
      } catch {
        toast("Couldn't add it — try again in a moment.", "error");
      } finally {
        setPendingId(null);
      }
    },
    [toast],
  );

  return (
    <div className="flex h-full flex-col animate-content-in">
      <PageHeader
        icon={<LayoutTemplate size={18} />}
        title="Sequence templates"
        subtitle="Proven sequences, one per trigger — each cadence is tailored to its context."
      >
        <Button variant="outline" size="sm" icon={<ArrowLeft size={14} />} onClick={() => router.push("/sequences")}>
          Sequences
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-auto px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg" style={{ background: "var(--color-bg-hover)" }} />
            ))}
          </div>
        ) : loadError ? (
          <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
            Couldn't load the templates.{" "}
            <button className="underline" onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {templates.map((t) => {
              let cumulative = 0;
              return (
                <Card key={t.id}>
                  <CardBody>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                            {t.name}
                          </h3>
                          {t.instantiated && (
                            <Badge variant="success" size="sm">
                              Added
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                          {t.description}
                        </p>

                        {/* The angle — the spine every step serves. */}
                        <p
                          className="mt-2 text-[12px] italic leading-[17px]"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          « {t.recipientBenefitAngle} »
                        </p>

                        {/* Triggers + channels. */}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {t.triggerSignalTypes.map((s) => (
                            <Badge key={s} variant="info" size="sm">
                              {SIGNAL_LABELS[s] ?? s}
                            </Badge>
                          ))}
                          {t.channels.map((c) => {
                            const Icon = CHANNEL_ICON[c];
                            return (
                              <span
                                key={c}
                                className="inline-flex items-center gap-1 text-[11px]"
                                style={{ color: "var(--color-text-tertiary)" }}
                              >
                                <Icon size={11} /> {CHANNEL_LABEL[c]}
                              </span>
                            );
                          })}
                          <span
                            className="inline-flex items-center gap-1 text-[11px]"
                            style={{ color: "var(--color-text-tertiary)" }}
                          >
                            <Clock size={11} /> {t.stepCount} steps · {t.cadenceDays}d
                          </span>
                        </div>

                        {/* Cadence preview — J+N, channel, subject. */}
                        <div className="mt-2.5 space-y-1">
                          {t.steps.map((step) => {
                            cumulative += step.delayDays;
                            const Icon = CHANNEL_ICON[step.stepType];
                            return (
                              <div
                                key={step.stepNumber}
                                className="flex items-center gap-2 text-[11px]"
                                style={{ color: "var(--color-text-tertiary)" }}
                              >
                                <span className="w-9 shrink-0 tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
                                  D+{cumulative}
                                </span>
                                <Icon size={11} className="shrink-0" />
                                <span className="truncate">
                                  {step.stepType === "email" ? step.subjectTemplate : step.valueAdded}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="ml-2 shrink-0">
                        <Button
                          variant={t.instantiated ? "outline" : "solid"}
                          size="sm"
                          disabled={t.instantiated || pendingId === t.id}
                          loading={pendingId === t.id}
                          icon={t.instantiated ? <Check size={14} /> : undefined}
                          onClick={() => void useTemplate(t)}
                        >
                          {t.instantiated ? "Added" : "Use this template"}
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
