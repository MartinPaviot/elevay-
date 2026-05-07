"use client";

/**
 * Reject modal — captures the rejection reason that the
 * evaluator-optimizer learner (P0-1 task 1.6) consumes.
 *
 * Validation matches `validateRejectionReason` on the server :
 *  - Required, 3-200 chars after trim
 * UI also exposes a "pause sequence enrollment" toggle (default ON)
 * since rejecting a single step usually means "this whole sequence
 * isn't right for this contact".
 */

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";

interface SequenceDraftRejectModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (args: {
    reason: string;
    pauseEnrollment: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  recipientName: string;
}

const MIN_REASON = 3;
const MAX_REASON = 200;

const REASON_PRESETS = [
  "Wrong moment — recipient just signed with a competitor",
  "Tone too aggressive — soften before sending",
  "Personalization is shallow — needs better context",
  "Sequence triggered on outdated signal",
];

export function SequenceDraftRejectModal({
  open,
  onClose,
  onSubmit,
  recipientName,
}: SequenceDraftRejectModalProps) {
  const [reason, setReason] = useState("");
  const [pauseEnrollment, setPauseEnrollment] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setPauseEnrollment(true);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const trimmed = reason.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_REASON;
  const tooLong = trimmed.length > MAX_REASON;
  const validReason =
    trimmed.length >= MIN_REASON && trimmed.length <= MAX_REASON;

  async function handleSubmit() {
    if (!validReason || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await onSubmit({ reason: trimmed, pauseEnrollment });
    if (!result.ok) {
      setError(result.error ?? "Failed to reject");
      setSubmitting(false);
      return;
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="Reject draft"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="gradient"
            size="sm"
            onClick={handleSubmit}
            disabled={!validReason || submitting}
            icon={
              submitting ? <Loader2 size={13} className="animate-spin" /> : undefined
            }
          >
            Reject draft
          </Button>
        </div>
      }
    >
      <p
        className="mb-3 text-[12px]"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Why is this draft to <strong>{recipientName}</strong> not ready ? Your
        reason feeds the rejection learner so future drafts avoid the same
        issue.
      </p>

      {/* Presets */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {REASON_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setReason(p)}
            className="rounded-full px-2.5 py-1 text-[11px]"
            style={{
              background: "var(--color-bg-card)",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <label
        className="mb-1 block text-[11px] uppercase tracking-wider"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        Reason ({trimmed.length}/{MAX_REASON})
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        className="w-full rounded-md px-3 py-2 text-[13px]"
        style={{
          background: "var(--color-bg-card)",
          color: "var(--color-text-primary)",
          border: tooShort || tooLong
            ? "1px solid var(--color-error)"
            : "1px solid var(--color-border-default)",
          fontFamily: "inherit",
        }}
        placeholder="e.g. Tone is too direct — Sarah just had a delicate exec change"
        autoFocus
        disabled={submitting}
        maxLength={MAX_REASON + 1}
      />
      {tooShort && (
        <p
          className="mt-1 flex items-center gap-1 text-[11px]"
          style={{ color: "var(--color-error)" }}
        >
          <AlertCircle size={11} /> Min {MIN_REASON} characters.
        </p>
      )}
      {tooLong && (
        <p
          className="mt-1 flex items-center gap-1 text-[11px]"
          style={{ color: "var(--color-error)" }}
        >
          <AlertCircle size={11} /> Max {MAX_REASON} characters.
        </p>
      )}

      {/* Pause enrollment toggle */}
      <label
        className="mt-3 flex cursor-pointer items-start gap-2"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <input
          type="checkbox"
          checked={pauseEnrollment}
          onChange={(e) => setPauseEnrollment(e.target.checked)}
          className="mt-0.5"
          disabled={submitting}
        />
        <span className="text-[12px]">
          Pause this contact&apos;s enrollment in the sequence.
          <br />
          <span
            className="text-[11px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Recommended — most rejections mean the sequence is wrong for this
            contact, not just the step.
          </span>
        </span>
      </label>

      {error && (
        <p
          className="mt-3 flex items-center gap-1 text-[12px]"
          style={{ color: "var(--color-error)" }}
        >
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </Modal>
  );
}
