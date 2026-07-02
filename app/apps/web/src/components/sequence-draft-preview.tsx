"use client";

/**
 * Sequence draft preview — main pane of /sequences/review (P0-1 task 1.3).
 *
 * Renders the draft content + the surrounding context bundle from
 * `/api/sequences/drafts/[id]/context` :
 *  - Subject + body (editable inline when status === pending_approval)
 *  - Contact / account / deal cards
 *  - Recent activities (last 5)
 *  - "Why this draft?" — trigger reason + signals at trigger time
 *
 * Approve / Reject / Edit actions wire to the 3 lifecycle endpoints.
 * Edit hits `/api/sequences/drafts/[id]/edit` ; the version stamp goes
 * along with every mutation so concurrent reviewers race-fail at the
 * SQL level (409 surfaces as a "refresh" toast).
 */

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  User,
  Building2,
  Briefcase,
  Send,
  X,
  Pencil,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DraftListItem } from "./sequence-draft-list";

/** A personalization source cited by the copy engine (AI-UI primitive shape).
 *  Every field is optional — older drafts stored looser objects. */
interface DraftCitation {
  kind?: string;
  label?: string;
  href?: string;
  quote?: string;
}

/** T11c — one gate's verdict for the review panel. */
interface GateScore {
  score: number | null;
  verdict: string;
}

interface ContextBundle {
  draft: {
    id: string;
    status: string;
    triggerReason: string | null;
    generatedAt: string;
    // T11c — the data-backed composite quality score (0-1), when graded.
    qualityScore?: number | null;
  };
  // T11c — { g1?, g2?, g4?, g5? } => verdict + score (M13-R7).
  gateScores?: Record<string, GateScore>;
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    title: string | null;
    score: number | null;
  } | null;
  account: {
    id: string;
    name: string | null;
    domain: string | null;
    score: number | null;
  } | null;
  deal: {
    id: string;
    name: string;
    stage: string;
    value: number | null;
  } | null;
  recentInteractions: Array<{
    id: string;
    type: string;
    channel: string | null;
    direction: string | null;
    occurredAt: string | null;
    summary: string | null;
    sentiment: string | null;
  }>;
  signalsAtTriggerTime: DraftCitation[] | null;
}

/** Normalize the loosely-typed personalization_sources into citations.
 *  Exported for unit testing — this IS the T11c citation logic. */
export function toCitations(raw: unknown): DraftCitation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      kind: typeof s.kind === "string" ? s.kind : undefined,
      label: typeof s.label === "string" ? s.label : undefined,
      href: typeof s.href === "string" ? s.href : undefined,
      quote: typeof s.quote === "string" ? s.quote : undefined,
    }))
    .filter((c) => c.label || c.quote || c.href || c.kind);
}

/** Verdict -> token color (pass = success, blocked = error, reworked = warn).
 *  Exported for unit testing. */
export function verdictColor(verdict: string): string {
  if (verdict === "pass") return "var(--color-success)";
  if (verdict === "blocked") return "var(--color-error)";
  if (verdict === "reworked") return "var(--color-warning)";
  return "var(--color-text-tertiary)";
}

/** The gates surfaced in the panel, in reading order, with human labels. */
const GATE_META: Array<{ key: string; label: string }> = [
  { key: "g1", label: "Targeting" },
  { key: "g2", label: "Factual" },
  { key: "g4", label: "Copy quality" },
  { key: "g5", label: "Deliverability" },
];

interface SequenceDraftPreviewProps {
  draft: DraftListItem;
  onApprove: () => Promise<void>;
  onReject: () => void;
  onEditSaved: (updated: DraftListItem) => void;
}

export function SequenceDraftPreview({
  draft,
  onApprove,
  onReject,
  onEditSaved,
}: SequenceDraftPreviewProps) {
  const [context, setContext] = useState<ContextBundle | null>(null);
  const [contextLoading, setContextLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState(draft.subject);
  const [editBody, setEditBody] = useState(draft.bodyText ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [approving, setApproving] = useState(false);

  const fetchContext = useCallback(async () => {
    setContextLoading(true);
    try {
      const res = await fetch(`/api/sequences/drafts/${draft.id}/context`);
      if (res.ok) {
        const data = await res.json();
        setContext(data);
      }
    } catch {
      // Non-blocking — empty context is fine.
    } finally {
      setContextLoading(false);
    }
  }, [draft.id]);

  useEffect(() => {
    fetchContext();
    setEditing(false);
    setEditSubject(draft.subject);
    setEditBody(draft.bodyText ?? "");
    setSaveError(null);
  }, [draft.id, draft.subject, draft.bodyText, fetchContext]);

  async function saveEdit() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/sequences/drafts/${draft.id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editSubject,
          bodyText: editBody,
          version: draft.version,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(
          (data as { error?: string }).error ??
            `Save failed (HTTP ${res.status})`,
        );
        return;
      }
      onEditSaved((data as { draft: DraftListItem }).draft);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    try {
      await onApprove();
    } finally {
      setApproving(false);
    }
  }

  const isTerminal = ["sent", "rejected", "expired"].includes(draft.status);
  const canMutate = draft.status === "pending_approval";
  const recipientName = context?.contact
    ? [context.contact.firstName, context.contact.lastName]
        .filter(Boolean)
        .join(" ") || context.contact.email || "Unknown"
    : "—";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header strip */}
      <div
        className="flex shrink-0 items-center gap-3 border-b px-6 py-3"
        style={{ borderColor: "var(--color-border-default)" }}
      >
        <div className="flex-1 min-w-0">
          <p
            className="truncate text-[13px] font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            To {recipientName}
            {context?.contact?.email && (
              <span
                className="ml-2 text-[11px] font-normal"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {context.contact.email}
              </span>
            )}
          </p>
          {context?.account?.name && (
            <p
              className="mt-0.5 truncate text-[11px]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {context.account.name}
              {context.account.domain ? ` · ${context.account.domain}` : ""}
            </p>
          )}
        </div>

        {canMutate && (
          <div className="flex shrink-0 items-center gap-2">
            {!editing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Pencil size={13} />}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<X size={13} />}
                  onClick={onReject}
                >
                  Reject
                </Button>
                <Button
                  variant="gradient"
                  size="sm"
                  icon={
                    approving ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Send size={13} />
                    )
                  }
                  onClick={handleApprove}
                  disabled={approving}
                >
                  Approve & send
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setEditSubject(draft.subject);
                    setEditBody(draft.bodyText ?? "");
                    setSaveError(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  variant="gradient"
                  size="sm"
                  icon={
                    saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />
                  }
                  onClick={saveEdit}
                  disabled={saving}
                >
                  Save
                </Button>
              </>
            )}
          </div>
        )}

        {isTerminal && (
          <span
            className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider"
            style={{
              background: "var(--color-bg-card)",
              color: "var(--color-text-tertiary)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            {draft.status}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Subject + body */}
        <div className="mb-6">
          {editing ? (
            <input
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-[14px] font-semibold"
              style={{
                background: "var(--color-bg-card)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-default)",
              }}
              maxLength={998}
            />
          ) : (
            <h1
              className="text-[16px] font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {draft.subject || "(no subject)"}
            </h1>
          )}

          {editing ? (
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="mt-3 w-full rounded-md px-3 py-2 text-[13px] leading-relaxed"
              style={{
                background: "var(--color-bg-card)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-default)",
                minHeight: 240,
                fontFamily: "inherit",
              }}
              maxLength={200_000}
            />
          ) : (
            <pre
              className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed"
              style={{
                color: "var(--color-text-secondary)",
                fontFamily: "inherit",
              }}
            >
              {draft.bodyText ?? "(empty body)"}
            </pre>
          )}

          {saveError && (
            <p
              className="mt-2 flex items-center gap-1 text-[12px]"
              style={{ color: "var(--color-error)" }}
            >
              <AlertCircle size={12} /> {saveError}
            </p>
          )}
        </div>

        {/* Why this draft */}
        <ContextSection title="Why this draft?" icon={<Clock size={12} />}>
          {draft.triggerReason ? (
            <p
              className="text-[12px]"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {draft.triggerReason}
            </p>
          ) : (
            <p
              className="text-[12px]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              No trigger reason recorded.
            </p>
          )}

          {(() => {
            // T11c — the per-claim SOURCES the copy used, as citation chips
            // (was a raw JSON.stringify dump). Each is the label + an optional
            // kind badge + a link when the source has an href; the verbatim
            // quote is the hover title so the founder can trace every claim.
            const citations = toCitations(context?.signalsAtTriggerTime);
            if (citations.length === 0) return null;
            return (
              <div className="mt-2">
                <p
                  className="mb-1 text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  Sources cited
                </p>
                <div className="flex flex-wrap gap-1">
                  {citations.map((c, i) => {
                    const text = c.label || c.quote || c.href || c.kind || "source";
                    const chip = (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                        style={{
                          background: "var(--color-accent-soft)",
                          color: "var(--color-accent)",
                          border: "1px solid var(--color-accent-muted)",
                        }}
                        title={c.quote || undefined}
                      >
                        {c.kind ? (
                          <span
                            className="text-[9px] uppercase tracking-wider"
                            style={{ color: "var(--color-text-tertiary)" }}
                          >
                            {c.kind}
                          </span>
                        ) : null}
                        <span className="max-w-[220px] truncate">{text}</span>
                      </span>
                    );
                    return c.href ? (
                      <a
                        key={i}
                        href={c.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="no-underline"
                      >
                        {chip}
                      </a>
                    ) : (
                      <span key={i}>{chip}</span>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </ContextSection>

        {/* T11c — Quality gates: the verdicts behind this draft (M13-R7). */}
        {context?.gateScores && Object.keys(context.gateScores).length > 0 && (
          <ContextSection title="Quality gates" icon={<CheckCircle2 size={12} />}>
            {typeof context.draft.qualityScore === "number" ? (
              <div className="mb-2 flex items-center justify-between text-[12px]">
                <span style={{ color: "var(--color-text-secondary)" }}>Composite quality</span>
                <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
                  {(context.draft.qualityScore * 100).toFixed(0)}%
                </span>
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              {GATE_META.map(({ key, label }) => {
                const g = context.gateScores?.[key];
                if (!g) return null;
                return (
                  <div key={key} className="flex items-center justify-between text-[12px]">
                    <span style={{ color: "var(--color-text-secondary)" }}>{label}</span>
                    <span className="inline-flex items-center gap-2">
                      {typeof g.score === "number" ? (
                        <span style={{ color: "var(--color-text-tertiary)" }}>
                          {(g.score * 100).toFixed(0)}%
                        </span>
                      ) : null}
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                        style={{
                          color: verdictColor(g.verdict),
                          border: `1px solid ${verdictColor(g.verdict)}`,
                        }}
                      >
                        {g.verdict}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </ContextSection>
        )}

        {/* Contact */}
        {context?.contact && (
          <ContextSection title="Contact" icon={<User size={12} />}>
            <ContextRow label="Name" value={recipientName} />
            <ContextRow label="Email" value={context.contact.email} />
            <ContextRow label="Title" value={context.contact.title} />
            <ContextRow
              label="Score"
              value={context.contact.score?.toString() ?? null}
            />
          </ContextSection>
        )}

        {/* Account */}
        {context?.account && (
          <ContextSection title="Account" icon={<Building2 size={12} />}>
            <ContextRow label="Name" value={context.account.name} />
            <ContextRow label="Domain" value={context.account.domain} />
            <ContextRow
              label="Score"
              value={context.account.score?.toString() ?? null}
            />
          </ContextSection>
        )}

        {/* Deal */}
        {context?.deal && (
          <ContextSection title="Open deal" icon={<Briefcase size={12} />}>
            <ContextRow label="Name" value={context.deal.name} />
            <ContextRow label="Stage" value={context.deal.stage} />
            <ContextRow
              label="Value"
              value={
                context.deal.value !== null
                  ? `$${context.deal.value.toLocaleString("en-US")}`
                  : null
              }
            />
          </ContextSection>
        )}

        {/* Recent activities */}
        {context && context.recentInteractions.length > 0 && (
          <ContextSection
            title="Recent activity (last 5)"
            icon={<Mail size={12} />}
          >
            <div className="space-y-1.5">
              {context.recentInteractions.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-2 text-[11px]"
                >
                  <span
                    className="mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] uppercase tracking-wider"
                    style={{
                      background: "var(--color-bg-card)",
                      color: "var(--color-text-tertiary)",
                      border: "1px solid var(--color-border-default)",
                    }}
                  >
                    {a.type.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 min-w-0">
                    {a.summary ? (
                      <p
                        className="truncate"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {a.summary}
                      </p>
                    ) : (
                      <p
                        className="truncate italic"
                        style={{ color: "var(--color-text-tertiary)" }}
                      >
                        (no summary)
                      </p>
                    )}
                    {a.occurredAt && (
                      <p
                        className="text-[10px]"
                        style={{ color: "var(--color-text-tertiary)" }}
                      >
                        {new Date(a.occurredAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ContextSection>
        )}

        {contextLoading && (
          <p
            className="text-[12px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Loading context…
          </p>
        )}
      </div>
    </div>
  );
}

function ContextSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mb-4 rounded-lg p-3"
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border-default)",
      }}
    >
      <p
        className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function ContextRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span
        className="text-[11px]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </span>
      <span
        className="truncate text-[12px]"
        style={{ color: "var(--color-text-primary)" }}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}
