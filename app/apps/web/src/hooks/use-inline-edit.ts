"use client";

import { useCallback, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";

export interface UseInlineEditConfig<T> {
  /** Value currently displayed (from parent state / row data). */
  initialValue: T;
  /** Persist the new value. Resolves on success, rejects on failure. */
  onSave: (next: T) => Promise<void>;
  /** Persist a revert. Defaults to calling `onSave(initialValue)`. */
  onUndo?: (previous: T) => Promise<void>;
  /** Undo toast lifetime. 0 / Infinity → no undo toast. Default 10s. */
  undoDurationMs?: number;
  /** Optional human-readable label baked into the toast copy. */
  label?: string;
}

export interface UseInlineEditReturn<T> {
  value: T;
  /** Update local value without committing to the server. */
  setValue: (next: T) => void;
  /** True while onSave is pending. */
  saving: boolean;
  /** True when the user is actively editing. */
  isEditing: boolean;
  startEdit: () => void;
  cancel: () => void;
  /** Commit current `value` via `onSave`, then show an Undo toast. */
  save: () => Promise<void>;
  error: unknown | null;
}

/**
 * Inline-edit + undo toast. Typical usage:
 *
 *   const edit = useInlineEdit({
 *     initialValue: row.name,
 *     onSave: (next) => fetch(`/api/accounts/${row.id}`, {
 *       method: "PATCH", body: JSON.stringify({ name: next }),
 *     }),
 *   });
 *
 *   <input
 *     value={edit.value}
 *     onChange={(e) => edit.setValue(e.target.value)}
 *     onBlur={edit.save}
 *     onFocus={edit.startEdit}
 *   />
 *
 * Behavior:
 * - `save()` persists, then shows a 10-second "Saved. Undo" toast.
 *   Clicking Undo invokes `onUndo(previous)` (or `onSave(previous)` if
 *   no separate onUndo is provided). After the toast auto-dismisses,
 *   the undo window is closed.
 * - A `save()` while a previous undo toast is still alive dismisses
 *   that toast first — only the most recent change can be undone.
 */
export function useInlineEdit<T>(config: UseInlineEditConfig<T>): UseInlineEditReturn<T> {
  const { initialValue, onSave, onUndo, undoDurationMs = 10_000, label } = config;
  const { toast, dismiss } = useToast();

  const [value, setValueState] = useState<T>(initialValue);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<unknown | null>(null);

  // The baseline we'd revert to on Undo. Updated at the start of every
  // save so rapid edits don't stack undos.
  const baselineRef = useRef<T>(initialValue);
  // Track the currently-alive undo toast so a new save can dismiss it.
  const pendingUndoIdRef = useRef<string | null>(null);

  const setValue = useCallback((next: T) => {
    setValueState(next);
  }, []);

  const startEdit = useCallback(() => {
    baselineRef.current = value;
    setIsEditing(true);
    setError(null);
  }, [value]);

  const cancel = useCallback(() => {
    setValueState(baselineRef.current);
    setIsEditing(false);
  }, []);

  const save = useCallback(async () => {
    setIsEditing(false);
    // Nothing to commit.
    if (Object.is(value, baselineRef.current)) return;

    const previous = baselineRef.current;

    // Collapse any outstanding undo — only the most recent save is
    // undoable.
    if (pendingUndoIdRef.current) {
      dismiss(pendingUndoIdRef.current);
      pendingUndoIdRef.current = null;
    }

    setSaving(true);
    try {
      await onSave(value);
      setError(null);
      baselineRef.current = value;

      if (undoDurationMs > 0 && Number.isFinite(undoDurationMs)) {
        const toastId = toast(
          label ? `${label} updated.` : "Saved.",
          "success",
          {
            durationMs: undoDurationMs,
            action: {
              label: "Undo",
              onClick: async () => {
                try {
                  if (onUndo) {
                    await onUndo(previous);
                  } else {
                    await onSave(previous);
                  }
                  setValueState(previous);
                  baselineRef.current = previous;
                } catch (err) {
                  setError(err);
                  toast("Couldn't undo. Try again.", "error");
                }
              },
            },
          }
        );
        pendingUndoIdRef.current = toastId;
      }
    } catch (err) {
      setError(err);
      // Revert local state — optimistic update was committed to local
      // state-by the user typing; rolling back keeps UI consistent with
      // the server.
      setValueState(previous);
      toast(label ? `Couldn't save ${label}.` : "Couldn't save.", "error");
    } finally {
      setSaving(false);
    }
  }, [dismiss, label, onSave, onUndo, toast, undoDurationMs, value]);

  return {
    value,
    setValue,
    saving,
    isEditing,
    startEdit,
    cancel,
    save,
    error,
  };
}
