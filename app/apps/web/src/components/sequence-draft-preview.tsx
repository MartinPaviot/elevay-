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

interface ContextBundle {
  draft: { id: string; status: string; triggerReason: string | null; generatedAt: string };
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
  signalsAtTriggerTime: unknown;
}

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

          {context?.signalsAtTriggerTime ? (
            <div className="mt-2">
              <p
                className="mb-1 text-[10px] uppercase tracking-wider"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Signals at trigger time
              </p>
              <pre
                className="overflow-x-auto rounded-md p-2 text-[10px]"
                style={{
                  background: "var(--color-bg-page)",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border-default)",
                }}
              >
                {JSON.stringify(context.signalsAtTriggerTime, null, 2)}
              </pre>
            </div>
          ) : null}
        </ContextSection>

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
