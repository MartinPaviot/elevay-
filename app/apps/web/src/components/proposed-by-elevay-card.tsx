"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, Rocket, Loader2, X, ArrowRight, TrendingUp, Users, UserCog, Cpu, Globe, Star, Swords, Package } from "lucide-react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * home-proposed-lane — "Proposed by Elevay", the review surface. Mirrors
 * FollowUpsReadyCard.tsx exactly (a /home-mounted card, fetch-on-mount,
 * self-hides when empty): these proposals already exist (written by the daily
 * cron via lib/home/sequence-proposals-draft.ts) — this is a review queue.
 * Launch NEVER sends: it creates a DRAFT sequence + an account list and
 * enrolls the cohort; the founder activates the sequence in /sequences/[id]
 * after reviewing the copy. Dismiss is terminal (the same cohort never
 * re-proposes; a changed cohort does).
 */

interface Proposal {
  id: string;
  signalFamily: string;
  templateId: string;
  title: string;
  companyNames: string[];
  companyCount: number;
  contactableCount: number;
  freshestAt: string;
  generatedAt: string;
  version: number;
  cadence: string;
}

interface Launched {
  sequenceId: string;
  listName: string;
  enrolled: number;
  skipped: number;
}

/** Family → glyph + gradient, the ACT_GRADIENT hue families (#634): deals in
 *  teal→green, people in blues, tech in indigo→purple, heat in oranges. */
const FAMILY_VISUAL: Record<string, { icon: typeof TrendingUp; gradient: string }> = {
  funding: { icon: TrendingUp, gradient: "linear-gradient(135deg, #17C3B2 0%, #10B981 100%)" },
  hiring: { icon: Users, gradient: "linear-gradient(135deg, #2C6BED 0%, #17C3B2 100%)" },
  leadership_change: { icon: UserCog, gradient: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)" },
  tech_stack_change: { icon: Cpu, gradient: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)" },
  website_visit: { icon: Globe, gradient: "linear-gradient(135deg, #FF7A3D 0%, #F59E0B 100%)" },
  exec_engagement: { icon: Star, gradient: "linear-gradient(135deg, #F59E0B 0%, #FF7A3D 100%)" },
  review_left: { icon: Star, gradient: "linear-gradient(135deg, #F59E0B 0%, #FF7A3D 100%)" },
  competitor_mention: { icon: Swords, gradient: "linear-gradient(135deg, #EF4444 0%, #E8653A 100%)" },
  product_launch: { icon: Package, gradient: "linear-gradient(135deg, #17C3B2 0%, #2C6BED 100%)" },
};

const FAMILY_WHY: Record<string, string> = {
  funding: "recent funding round",
  hiring: "hiring surge",
  leadership_change: "new leadership in seat",
  tech_stack_change: "tech stack change",
  website_visit: "visited your site",
  exec_engagement: "exec engaged",
  review_left: "left a review",
  competitor_mention: "mentioned a competitor",
  product_launch: "product launch",
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ProposedByElevayCard() {
  const { toast } = useToast();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [launched, setLaunched] = useState<Record<string, Launched>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/home/proposals")
      .then((r) => (r.ok ? r.json() : { proposals: [] }))
      .then((data) => {
        if (cancelled) return;
        // Defensive: malformed responses degrade to "no proposals", never a
        // crashed dashboard (mold: FollowUpsReadyCard).
        const rows = Array.isArray((data as { proposals?: Proposal[] })?.proposals)
          ? (data as { proposals: Proposal[] }).proposals
          : [];
        setProposals(rows);
      })
      .catch(() => {
        /* empty state */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const launch = useCallback(
    async (p: Proposal) => {
      setBusy(p.id);
      try {
        const res = await fetch(`/api/home/proposals/${p.id}/launch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: p.version }),
        });
        const data = (await res.json().catch(() => ({}))) as Partial<Launched> & { error?: string };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setLaunched((prev) => ({
          ...prev,
          [p.id]: {
            sequenceId: data.sequenceId ?? "",
            listName: data.listName ?? "",
            enrolled: data.enrolled ?? 0,
            skipped: data.skipped ?? 0,
          },
        }));
        toast(`Draft sequence ready — ${data.enrolled ?? 0} contacts enrolled, nothing sent`, "success");
      } catch (err) {
        console.warn("proposed-by-elevay: launch failed", err);
        toast(err instanceof Error ? err.message : "Launch failed", "error");
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );

  const dismiss = useCallback(
    async (p: Proposal) => {
      setBusy(p.id);
      // Optimistic — the human's "no" is immediate; restore on failure.
      setProposals((prev) => prev.filter((x) => x.id !== p.id));
      try {
        const res = await fetch(`/api/home/proposals/${p.id}/dismiss`, { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.warn("proposed-by-elevay: dismiss failed", err);
        setProposals((prev) => [p, ...prev]);
        toast("Couldn't dismiss — retry?", "error");
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );

  if (loading) return null;
  if (proposals.length === 0) return null;

  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: "var(--color-accent)" }} />
          <h2 className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Proposed by Elevay
          </h2>
        </div>
        <p className="mt-1 text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
          Accounts with a live buying signal, matched to a proven sequence. Launch creates a draft you review — nothing sends until you activate it.
        </p>

        <div className="mt-3 space-y-3">
          {proposals.map((p) => {
            const visual = FAMILY_VISUAL[p.signalFamily] ?? { icon: Sparkles, gradient: "var(--gradient-brand)" };
            const Icon = visual.icon;
            const isBusy = busy === p.id;
            const done = launched[p.id];
            const extra = p.companyCount - p.companyNames.length;
            return (
              <div
                key={p.id}
                className="rounded-md p-3"
                style={{ background: "var(--color-bg-page)", border: "1px solid var(--color-border-default)" }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: visual.gradient, boxShadow: "var(--shadow-button)" }}
                  >
                    <Icon size={13} style={{ color: "#FFFFFF" }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {p.title}
                    </p>
                    <p className="truncate text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                      {FAMILY_WHY[p.signalFamily] ?? p.signalFamily} · freshest {shortDate(p.freshestAt)} · {p.contactableCount} contactable · {p.cadence}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                  {p.companyNames.slice(0, 3).join(", ")}
                  {extra > 0 ? ` +${extra} more` : ""}
                </p>
                {done ? (
                  <div className="mt-2 flex items-center gap-2 text-[12px]" style={{ color: "var(--color-success)" }}>
                    <span>
                      Draft ready — {done.enrolled} enrolled{done.skipped > 0 ? `, ${done.skipped} skipped by gates` : ""}, nothing sent.
                    </span>
                    <Link
                      href={`/sequences/${done.sequenceId}`}
                      className="inline-flex items-center gap-1 font-semibold"
                      style={{ color: "var(--color-accent)" }}
                    >
                      Review sequence <ArrowRight size={12} />
                    </Link>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" onClick={() => void launch(p)} disabled={isBusy}>
                      {isBusy ? (
                        <>
                          <Loader2 size={12} className="animate-spin" /> Preparing…
                        </>
                      ) : (
                        <>
                          <Rocket size={12} /> Launch draft
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void dismiss(p)} disabled={isBusy}>
                      <X size={12} /> Dismiss
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
