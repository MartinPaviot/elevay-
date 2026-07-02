"use client";

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { injectMeetingLink } from "@/lib/inbox/meeting-link";
import { X, Send, ChevronDown, ChevronUp, Mail, Save, AlertCircle, RefreshCw, Sparkles, Undo2, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ContactCollisionNotice } from "@/components/collision/contact-collision-notice";
import { parseRecipients } from "@/lib/inbox/template-vars";
import { REWRITE_PRESETS } from "@/lib/inbox/rewrite-presets";
import { TRANSLATE_LANGUAGES } from "@/lib/inbox/translate-languages";
import { pickDefaultFrom, mailboxDisplay, type SendableMailbox } from "@/lib/inbox/pick-from-mailbox";
import { applySignature, splitSignature } from "@/lib/inbox/mailbox-signature";
import { useT } from "@/lib/i18n/locale";
import {
  draftStorageKey,
  saveDraftToStorage,
  loadDraftFromStorage,
  clearDraftFromStorage,
} from "@/lib/inbox/draft-storage";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface EmailComposerDraft {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  contactId?: string;
  dealId?: string;
  /** A2: the seeded send-from mailbox (the thread's own box on a reply). */
  mailboxId?: string;
  /** Conversation key/threadId — attaches a DB draft to the thread so it shows
   *  in the Drafts folder + reloads on reopen. */
  threadId?: string;
  /** Existing DB draft id when opened from a prepared/saved draft — so auto-save
   *  UPDATES that row instead of creating a new one. */
  draftId?: string;
}

interface EmailComposerPanelProps {
  draft: EmailComposerDraft;
  onClose: () => void;
  /** Called after a successful send with the messageId */
  onSent?: (messageId: string) => void;
  /** A2: the user's SENDABLE mailboxes for the From selector (empty hides it). */
  mailboxes?: SendableMailbox[];
  /** Render in the document flow (Gmail/Outlook-style reply pinned under the
   *  thread) instead of the right-edge slide-over drawer. The drawer (default)
   *  stays for standalone "new email" compose; the inbox reply passes inline. */
  inline?: boolean;
  /** Extra chips rendered inside the AI toolbar row (e.g. the inbox SnippetBar)
   *  so hosts don't stack another full-width row above the writing box. */
  toolbarExtra?: React.ReactNode;
}

/**
 * Imperative handle for parent-driven body edits. The panel owns the editable
 * body (editBody) as its single source of truth — a parent that mutates the
 * `draft` prop after mount is ignored — so external writers (the meeting-link
 * injection on booking, the tone switcher, snippet insertion) MUST go through
 * this handle to actually reach the textarea. `getBody` lets the parent read
 * the live body (e.g. "save reply as snippet") without per-keystroke re-renders.
 */
export interface EmailComposerHandle {
  /** Smart-insert the sovereign join link into the current body (INBOX-G10). */
  appendMeetingLink: (joinUrl: string) => void;
  /** Replace the body, and optionally the subject (the tone switcher). */
  setBody: (body: string, subject?: string) => void;
  /** Append text below the current body (snippet insertion). */
  appendBody: (text: string) => void;
  /** The live edited body. */
  getBody: () => string;
}

/* ------------------------------------------------------------------ */
/*  Pill-style email tag                                               */
/* ------------------------------------------------------------------ */

function EmailPill({ email, onRemove }: { email: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px]"
      style={{
        background: "var(--color-bg-muted)",
        color: "var(--color-text-primary)",
        border: "1px solid var(--color-border-default)",
      }}
    >
      {email}
      <button
        onClick={onRemove}
        className="ml-0.5 flex items-center"
        style={{ color: "var(--color-text-muted)" }}
      >
        <X size={10} />
      </button>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Editable email field with pill tags                                */
/* ------------------------------------------------------------------ */

function EmailField({
  label,
  emails,
  onChange,
  placeholder,
}: {
  label: string;
  emails: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addEmail(raw: string) {
    // parseRecipients handles "Name <email>", comma/semicolon lists and dedupe,
    // so a pasted "a@b.c, d@e.f" becomes two pills in one go.
    const { valid } = parseRecipients(raw);
    if (valid.length > 0) {
      const merged = [...emails];
      for (const addr of valid) if (!merged.includes(addr)) merged.push(addr);
      onChange(merged);
    }
    setInputValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      e.preventDefault();
      addEmail(inputValue);
    } else if (e.key === "Backspace" && !inputValue && emails.length > 0) {
      onChange(emails.slice(0, -1));
    }
  }

  return (
    <div
      className="flex items-start gap-2 px-4 py-2"
      style={{ borderBottom: "1px solid var(--color-border-default)" }}
      onClick={() => inputRef.current?.focus()}
    >
      <span
        className="mt-0.5 w-12 shrink-0 text-[12px] font-medium"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-1">
        {emails.map((email, i) => (
          <EmailPill
            key={i}
            email={email}
            onRemove={() => onChange(emails.filter((_, idx) => idx !== i))}
          />
        ))}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputValue.trim()) addEmail(inputValue);
          }}
          className="min-w-[120px] flex-1 bg-transparent text-[13px] outline-none"
          style={{ color: "var(--color-text-primary)" }}
          placeholder={emails.length === 0 ? (placeholder || "email@example.com") : ""}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Draft persistence helpers (localStorage)                           */
/* ------------------------------------------------------------------ */

// Draft auto-save persistence lives in a pure, testable module.

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export const EmailComposerPanel = forwardRef<EmailComposerHandle, EmailComposerPanelProps>(function EmailComposerPanel(
  { draft, onClose, onSent, mailboxes = [], inline = false, toolbarExtra },
  ref,
) {
  const { toast } = useToast();
  const t = useT();
  const [mounted, setMounted] = useState(false);

  // A2: send-from selector. Seeded to the thread's box when still sendable, else
  // the primary. Server re-resolves + refuses a non-owned/inactive box (403).
  const [fromMailboxId, setFromMailboxId] = useState<string | undefined>(() => pickDefaultFrom(draft.mailboxId, mailboxes));
  const [fromOpen, setFromOpen] = useState(false);

  // Form state — parseRecipients keeps "Name <email>" and lists tidy.
  const [toEmails, setToEmails] = useState<string[]>(parseRecipients(draft.to || "").valid);
  const [ccEmails, setCcEmails] = useState<string[]>(parseRecipients(draft.cc || "").valid);
  const [bccEmails, setBccEmails] = useState<string[]>(parseRecipients(draft.bcc || "").valid);
  const [showCc, setShowCc] = useState(Boolean(draft.cc));
  const [showBcc, setShowBcc] = useState(Boolean(draft.bcc));
  const [editSubject, setEditSubject] = useState(draft.subject);
  const [editBody, setEditBody] = useState(draft.body);
  // Inline replies fold From/To/Cc/Subject into one summary line (they are all
  // pre-known); a click expands the full field set. Auto-expands when there is
  // nothing to summarize (no recipient yet) or when Cc/Bcc came pre-filled.
  const [fieldsExpanded, setFieldsExpanded] = useState(Boolean(draft.cc || draft.bcc));
  const collapseFields = inline && Boolean(draft.threadId) && !fieldsExpanded && toEmails.length > 0;

  // Auto-save (per-context localStorage). storageKey is frozen for the panel's
  // life from the OPENING draft, so editing recipients doesn't move the slot.
  const storageKeyRef = useRef(draftStorageKey(draft));
  const storageKey = storageKeyRef.current;
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const restoredRef = useRef(false);
  // DB-backed draft (Drafts folder, cross-device). Only when there's a contact
  // to scope by — a blank/contact-less compose stays localStorage-only. Seeded
  // from a reopened prepared/saved draft so auto-save UPDATES that row.
  const serverDraftIdRef = useRef<string | null>(draft.draftId ?? null);
  // True once the USER actually edits (not the AI suggestion / signature /
  // restore). Gates the DB upsert so the Drafts folder isn't flooded with
  // untouched auto-suggested replies. A reopened existing draft counts as edited.
  const userEditedRef = useRef(Boolean(draft.draftId));
  const markEdited = useCallback(() => {
    userEditedRef.current = true;
  }, []);

  // editBody is the panel's source of truth; mirror it to a ref so the handle's
  // getBody() returns the LIVE value without forcing a parent re-render.
  const editBodyRef = useRef(editBody);
  editBodyRef.current = editBody;
  // Parent-driven edits (book→link injection, tone switch, snippet insert) reach
  // the textarea ONLY through this handle — the panel seeds editBody from
  // draft.body ONCE, so a parent that later mutates the draft prop is ignored.
  // Every path marks the draft edited so the change persists + sends.
  useImperativeHandle(
    ref,
    () => ({
      appendMeetingLink(joinUrl: string) {
        // Insert the link into the MESSAGE part, above any trailing signature —
        // else a later From-mailbox swap (strip-to-end + re-append signature)
        // silently wipes the link, the exact payload this exists to deliver.
        setEditBody((b) => {
          const [msg, sig] = splitSignature(b);
          return `${injectMeetingLink(msg, joinUrl)}${sig}`;
        });
        markEdited();
      },
      setBody(body: string, subject?: string) {
        setEditBody(body);
        if (subject != null) setEditSubject(subject);
        markEdited();
      },
      appendBody(text: string) {
        // Append above the signature too (same swap-safety as the meeting link).
        setEditBody((b) => {
          const [msg, sig] = splitSignature(b);
          const trimmed = msg.replace(/\s+$/, "");
          return `${trimmed ? `${trimmed}\n\n${text}` : text}${sig}`;
        });
        markEdited();
      },
      getBody: () => editBodyRef.current,
    }),
    [markEdited],
  );

  // Send state
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Compose-AI (INBOX-C04/C07/C08): rewrite / translate / draft-from-bullets.
  // All keep the prior body in rewriteUndo for a one-tap Undo.
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [rewriteUndo, setRewriteUndo] = useState<string | null>(null);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [drafting, setDrafting] = useState(false);

  // Refs
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // B1: the always-visible "edit with AI" instruction field (Cmd/Ctrl+J target).
  const aiInstructionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Restore a previously auto-saved draft for this context (run once, client
  // only — avoids an SSR/hydration mismatch by restoring AFTER the first paint).
  // A parent-supplied BODY (a fresh AI generation, a prepared agent draft) wins
  // over the cache: restoring here used to silently replace a draft the user
  // just generated with the stale cached one (audit 2026-07-02). The cache only
  // fills fields the incoming draft left empty.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if ((draft.body ?? "").trim()) return;
    const saved = loadDraftFromStorage(storageKey);
    if (!saved) return;
    if (saved.body != null) setEditBody(saved.body);
    // The incoming subject (the thread's Re: subject) beats a cached AI one.
    if (saved.subject != null && !(draft.subject ?? "").trim()) setEditSubject(saved.subject);
    if (saved.to?.length) setToEmails(saved.to);
    if (saved.cc?.length) {
      setCcEmails(saved.cc);
      setShowCc(true);
    }
    if (saved.bcc?.length) {
      setBccEmails(saved.bcc);
      setShowBcc(true);
    }
    if (saved.savedAt) setDraftSavedAt(saved.savedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Debounced auto-save: persist the in-progress draft ~0.8s after the last
  // edit so a refresh / navigate-away / the inbox's periodic re-render never
  // loses typed text. An emptied draft clears its slot. Cleared on send.
  useEffect(() => {
    if (sent) return;
    const hasContent = Boolean(editBody.trim() || editSubject.trim() || toEmails.length);
    setDraftSaving(true);
    const timer = setTimeout(() => {
      if (hasContent) {
        saveDraftToStorage(storageKey, {
          to: toEmails,
          cc: ccEmails,
          bcc: bccEmails,
          subject: editSubject,
          body: editBody,
          contactId: draft.contactId,
          dealId: draft.dealId,
        });
        setDraftSavedAt(new Date().toISOString());
        // Mirror to the DB so the draft lands in the Drafts folder + survives
        // across devices — but only once the user actually edited (not a raw AI
        // suggestion), and only with a contact to scope by. localStorage above
        // is the instant cache for the contact-less / untouched cases.
        if (draft.contactId && userEditedRef.current) {
          void fetch("/api/inbox/drafts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: serverDraftIdRef.current,
              contactId: draft.contactId,
              threadId: draft.threadId ?? null,
              to: toEmails.join(", "),
              subject: editSubject,
              bodyHtml: editBody,
              bodyText: editBody,
              mailboxId: fromMailboxId ?? null,
            }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((d: { id?: string } | null) => {
              if (d?.id) serverDraftIdRef.current = d.id;
            })
            .catch(() => {});
        }
      } else {
        clearDraftFromStorage(storageKey);
        setDraftSavedAt(null);
        // Emptied → discard the DB draft too.
        if (serverDraftIdRef.current) {
          const id = serverDraftIdRef.current;
          serverDraftIdRef.current = null;
          void fetch(`/api/inbox/drafts/${id}`, { method: "DELETE" }).catch(() => {});
        }
      }
      setDraftSaving(false);
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toEmails, ccEmails, bccEmails, editSubject, editBody, sent, storageKey, fromMailboxId]);

  // Flush-on-unmount: the auto-save above is debounced 800ms and its cleanup just
  // clears the timer, so closing the composer right after typing (e.g. clicking
  // another thread, which unmounts it) would drop the last keystrokes. Keep a ref
  // to the current draft and persist it synchronously on unmount. localStorage is
  // the source the restore-on-open reads, so this alone preserves the text.
  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    if (sent) return;
    const hasContent = Boolean(editBody.trim() || editSubject.trim() || toEmails.length);
    if (!hasContent) return;
    saveDraftToStorage(storageKey, {
      to: toEmails,
      cc: ccEmails,
      bcc: bccEmails,
      subject: editSubject,
      body: editBody,
      contactId: draft.contactId,
      dealId: draft.dealId,
    });
  };
  useEffect(() => () => flushRef.current(), []);

  // Focus body on mount
  useEffect(() => {
    if (mounted) {
      setTimeout(() => bodyRef.current?.focus(), 100);
    }
  }, [mounted]);

  // Escape to close. When the chat dock is open ON TOP of the composer, Escape
  // belongs to the dock — one press must close the topmost layer only, not
  // throw away the editing session underneath (audit 2026-07-02, F6). The dock
  // is a sibling tree, so presence is read from its DOM marker.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (document.querySelector("[data-chat-dock-open]")) return;
      onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // A3: apply the From mailbox's signature on open + on From change. Idempotent
  // (strip the prior "-- " block, append the new one once) so it is never
  // duplicated and swaps cleanly when the From box changes.
  useEffect(() => {
    const sig = mailboxes.find((m) => m.id === fromMailboxId)?.signature;
    setEditBody((b) => applySignature(b, sig));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromMailboxId, mailboxes]);

  // B1 Cmd/Ctrl+J inside the composer = edit-with-AI (R2.1). With an instruction
  // typed (and a body to act on), submit it through the EXISTING handleRewrite;
  // otherwise open the Rewrite menu with its instruction input focused. The
  // always-visible instruction field is gone — it burned half the toolbar for a
  // power feature (founder 2026-07-02: "le hit cmd to draft with ai ne sert à
  // rien"); the shortcut still works through the menu.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        if (rewriteInstruction.trim() && editBody.trim() && !rewriting) {
          void handleRewrite(rewriteInstruction);
        } else {
          setRewriteOpen(true);
          setTimeout(() => aiInstructionRef.current?.focus(), 50);
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewriteInstruction, editBody, rewriting]);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const ta = bodyRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [editBody, autoResize]);

  /* ── Save draft ─────────────────────────────────────────────── */
  // Drafts now auto-save (debounced, per-context localStorage above); the
  // explicit button is replaced by a passive "Draft saved" status. A manual
  // flush stays available for the keyboard path / immediate feedback.

  function handleSaveDraft() {
    saveDraftToStorage(storageKey, {
      to: toEmails,
      cc: ccEmails,
      bcc: bccEmails,
      subject: editSubject,
      body: editBody,
      contactId: draft.contactId,
      dealId: draft.dealId,
    });
    setDraftSavedAt(new Date().toISOString());
  }

  /* ── Rewrite (INBOX-C04) ─────────────────────────────────────── */

  async function handleRewrite(instruction: string) {
    if (!editBody.trim() || !instruction.trim() || rewriting) return;
    setRewriting(true);
    setRewriteOpen(false);
    try {
      const res = await fetch("/api/inbox/compose/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody, instruction }),
      });
      const data = res.ok ? ((await res.json()) as { text?: string }) : {};
      if (data.text && data.text.trim()) {
        setRewriteUndo(editBody); // keep the original for one-tap undo
        setEditBody(data.text.trim());
        setRewriteInstruction("");
        toast(t("inbox.compose.rewrittenToast"), "success");
      } else {
        toast(t("inbox.compose.rewriteFailedToast"), "warning");
      }
    } catch {
      toast(t("inbox.compose.rewriteFailedToast"), "warning");
    } finally {
      setRewriting(false);
    }
  }

  async function handleTranslate(lang: string) {
    if (!editBody.trim() || translating) return;
    setTranslating(true);
    setTranslateOpen(false);
    try {
      const res = await fetch("/api/inbox/compose/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody, targetLang: lang }),
      });
      const data = res.ok ? ((await res.json()) as { text?: string }) : {};
      if (data.text && data.text.trim()) {
        setRewriteUndo(editBody);
        setEditBody(data.text.trim());
        toast(t("inbox.compose.translatedToast", { lang }), "success");
      } else {
        toast(t("inbox.compose.translateFailedToast"), "warning");
      }
    } catch {
      toast(t("inbox.compose.translateFailedToast"), "warning");
    } finally {
      setTranslating(false);
    }
  }

  // ONE Draft button (founder 2026-07-02: "mets juste draft — si la personne a
  // écrit du texte tu peux t'en servir de base"). Body already has text → it IS
  // the brief: expand it through the bullets endpoint. Empty body on a reply →
  // the voice-matched thread draft (same endpoint as the pane's Generate
  // draft). Undo restores whatever was there before.
  async function handleDraft() {
    if (drafting) return;
    const base = editBody.trim();
    if (!base && !draft.threadId) return; // blank new email: nothing to draft from
    setDrafting(true);
    try {
      const res = base
        ? await fetch("/api/inbox/compose/draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Recipient context so the expansion greets the right person —
            // without it a reply drafted from typed notes opened "Hi,".
            body: JSON.stringify({
              bullets: base,
              context: toEmails.length > 0 ? `This email goes to ${toEmails.join(", ")}.` : undefined,
            }),
          })
        : await fetch("/api/inbox/compose/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: draft.threadId }),
          });
      const data = res.ok ? ((await res.json()) as { subject?: string; text?: string }) : {};
      if (data.text && data.text.trim()) {
        setRewriteUndo(editBody);
        // Fill the subject only when it's still empty — never clobber a "Re:".
        if (data.subject && data.subject.trim() && !editSubject.trim()) setEditSubject(data.subject.trim());
        setEditBody(data.text.trim());
        toast(t("inbox.compose.draftedToast"), "success");
      } else {
        toast(t("inbox.compose.draftFailedDetailToast"), "warning");
      }
    } catch {
      toast(t("inbox.compose.draftFailedRetryToast"), "warning");
    } finally {
      setDrafting(false);
    }
  }

  /* ── Send ───────────────────────────────────────────────────── */

  async function handleSend() {
    if (toEmails.length === 0) {
      toast(t("inbox.compose.needRecipientToast"), "warning");
      return;
    }
    if (!editSubject.trim()) {
      toast(t("inbox.compose.subjectEmptyToast"), "warning");
      return;
    }
    if (!editBody.trim()) {
      toast(t("inbox.compose.bodyEmptyToast"), "warning");
      return;
    }

    setSending(true);
    setSendError(null);

    try {
      // M13-R8 (T4) — manual sends pass G2 (factual) + G5 (deliverability
      // content) BEFORE the wire; a failing check is explained inline so the
      // founder edits instead of discovering a blocked send. FAIL-CLOSED: a
      // pregate outage blocks the send (the transport gate would block it
      // anyway — this only surfaces the reason earlier).
      const pregateRes = await fetch("/api/send/pregate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toEmails[0],
          subject: editSubject,
          body: editBody,
          contactId: draft.contactId || undefined,
        }),
      });
      if (!pregateRes.ok) {
        setSendError(t("inbox.compose.pregateUnavailable"));
        setSending(false);
        return;
      }
      const pregate = (await pregateRes.json()) as {
        allowed: boolean;
        failures?: Array<{ gate: number; detail: string }>;
      };
      if (!pregate.allowed) {
        setSendError(
          `${t("inbox.compose.pregateBlockedPrefix")} ${(pregate.failures ?? [])
            .map((f) => f.detail)
            .join(" · ")}`,
        );
        setSending(false);
        return;
      }

      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toEmails[0],
          cc: ccEmails.length > 0 ? ccEmails : undefined,
          bcc: bccEmails.length > 0 ? bccEmails : undefined,
          subject: editSubject,
          body: editBody,
          contactId: draft.contactId || undefined,
          dealId: draft.dealId || undefined,
          mailboxId: fromMailboxId || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error || t("inbox.compose.sendFailedStatus", { status: res.status })
        );
      }

      const data = await res.json();
      const messageId = (data as { messageId?: string }).messageId || "";

      clearDraftFromStorage(storageKey);
      // Consume the DB draft so it leaves the Drafts folder (the send wrote its
      // own 'sent' row). Idempotent + best-effort.
      if (serverDraftIdRef.current) {
        const id = serverDraftIdRef.current;
        serverDraftIdRef.current = null;
        void fetch(`/api/inbox/drafts/${id}/consume`, { method: "POST" }).catch(() => {});
      }
      setSent(true);
      toast(t("inbox.compose.sentToast"), "success");
      onSent?.(messageId);

      // Auto-close after brief confirmation
      setTimeout(onClose, 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("inbox.compose.sendFailedGeneric");
      setSendError(msg);
    } finally {
      setSending(false);
    }
  }

  if (!mounted) return null;

  // Inline (Gmail/Outlook reply): an in-flow CARD inside the pane's single
  // scroll container — the draft and the thread it answers share ONE scroll, so
  // reading flows straight from the reply into the received mail with no seam
  // (founder, UI pass 2026-07-02: "pourquoi une coupure entre le mail reçu et
  // le mail qu'on s'apprête à écrire"). The card sizes to its content; a long
  // draft grows the card and the PANE scrolls — no nested scrollbar fighting
  // the thread's. Drawer (default): the right-edge slide-over for standalone
  // compose.
  const panel = (
      <div
        className={inline
          ? "flex flex-col rounded-lg border"
          : "slide-in-right fixed right-0 top-0 z-50 flex h-full flex-col"}
        style={inline
          ? {
              background: "var(--color-bg-card)",
              borderColor: "var(--color-border-default)",
            }
          : {
              width: "min(var(--detail-panel-width, 400px), 100vw)",
              background: "var(--color-bg-card)",
              borderLeft: "1px solid var(--color-border-default)",
              borderTopLeftRadius: "10px",
              borderBottomLeftRadius: "10px",
              boxShadow: "var(--shadow-panel)",
            }}
      >
        {/* Header. An inline reply gets ONE thin row carrying everything the
            writer needs to glance at: the "Reply" label AND the collapsed
            To/Subject summary (click to expand the full field set). They were
            two stacked rows — pure chrome between the user and the textarea
            (founder, UI pass 2026-07-02: "encore beaucoup trop haut"). */}
        <div
          className={`flex items-center gap-2 px-4 ${inline && draft.threadId ? "py-1.5" : "py-3"}`}
          style={{ borderBottom: "1px solid var(--color-border-default)" }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Mail size={inline && draft.threadId ? 13 : 15} className="shrink-0" style={{ color: "var(--color-accent)" }} />
            {inline && draft.threadId ? (
              <>
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--color-text-tertiary)" }}>
                  {t("inbox.compose.replyLabel")}
                </span>
                {collapseFields && (
                  <button
                    type="button"
                    onClick={() => setFieldsExpanded(true)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    title={`${t("inbox.compose.to")}: ${toEmails.join(", ")} — ${editSubject}`}
                  >
                    <span className="shrink-0 text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                      {t("inbox.compose.to")}:
                    </span>
                    <span className="shrink-0 text-[12px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {toEmails[0]}{toEmails.length > 1 ? ` +${toEmails.length - 1}` : ""}
                    </span>
                    <span className="min-w-0 truncate text-[12px]" style={{ color: "var(--color-text-muted)" }}>
                      · {editSubject}
                    </span>
                    <ChevronDown size={12} className="shrink-0" style={{ color: "var(--color-text-tertiary)" }} />
                  </button>
                )}
              </>
            ) : (
              <h3
                className="truncate text-[14px] font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                {editSubject || t("inbox.compose.newEmail")}
              </h3>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-bg-hover)]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Collision heads-up: a teammate already emailed/called this contact
            recently (soft, non-blocking — informs, never gates Send). */}
        {draft.contactId && (
          <div className="px-4 pt-3">
            <ContactCollisionNotice contactId={draft.contactId} />
          </div>
        )}

        {/* Email fields. On an inline REPLY they are all pre-known (To = the
            sender, Subject = the thread's Re:) and rarely touched — collapsed
            into the header row above (founder: "quand on clique sur reply,
            écrire doit être l'élément de base", UI pass 2026-07-02). Click the
            summary to expand the full field set below. */}
        {!collapseFields && (<>
        {/* A2: From selector — which connected mailbox this leaves from. Default
            = the thread's own box. One box → static label; many → a menu. */}
        {mailboxes.length > 0 && (() => {
          const selected = mailboxes.find((m) => m.id === fromMailboxId) ?? mailboxes[0];
          return (
            <div
              className="flex items-center gap-2 px-4 py-2"
              style={{ borderBottom: "1px solid var(--color-border-default)" }}
            >
              <span className="w-12 shrink-0 text-[12px] font-medium" style={{ color: "var(--color-text-tertiary)" }}>
                {t("inbox.compose.from")}
              </span>
              {mailboxes.length === 1 ? (
                <span className="text-[13px]" style={{ color: "var(--color-text-primary)" }}>
                  {mailboxDisplay(selected)}
                </span>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setFromOpen((v) => !v)}
                    className="flex items-center gap-1 text-[13px]"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {mailboxDisplay(selected)}
                    <ChevronDown size={12} style={{ color: "var(--color-text-tertiary)" }} />
                  </button>
                  {fromOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setFromOpen(false)} />
                      <div
                        className="absolute left-0 top-full z-20 mt-1 min-w-[220px] rounded-lg border p-1"
                        style={{ borderColor: "var(--color-border-default)", background: "var(--color-bg-card)", boxShadow: "var(--shadow-floating)" }}
                      >
                        {mailboxes.map((m) => {
                          const active = m.id === selected.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => { setFromMailboxId(m.id); setFromOpen(false); }}
                              className="block w-full rounded px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-[var(--color-bg-hover)]"
                              style={{ color: active ? "var(--color-accent)" : "var(--color-text-primary)" }}
                            >
                              {m.label && m.label !== m.address ? `${m.label} <${m.address}>` : m.address}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        <EmailField
          label={t("inbox.compose.to")}
          emails={toEmails}
          onChange={(v) => { markEdited(); setToEmails(v); }}
          placeholder={t("inbox.compose.recipientPlaceholder")}
        />

        {/* Cc / Bcc — fields when open, compact toggles otherwise */}
        {showCc && <EmailField label="Cc" emails={ccEmails} onChange={(v) => { markEdited(); setCcEmails(v); }} />}
        {showBcc && <EmailField label={t("inbox.compose.bcc")} emails={bccEmails} onChange={(v) => { markEdited(); setBccEmails(v); }} />}
        <div
          className="flex items-center gap-3 px-4 py-1.5"
          style={{ borderBottom: "1px solid var(--color-border-default)" }}
        >
          <button
            onClick={() => setShowCc((v) => !v)}
            className="flex items-center gap-1 text-[11px]"
            style={{ color: "var(--color-text-muted)", cursor: "pointer" }}
          >
            {showCc ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {showCc ? t("inbox.compose.hideCc") : "Cc"}
          </button>
          <button
            onClick={() => setShowBcc((v) => !v)}
            className="flex items-center gap-1 text-[11px]"
            style={{ color: "var(--color-text-muted)", cursor: "pointer" }}
          >
            {showBcc ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {showBcc ? t("inbox.compose.hideBcc") : t("inbox.compose.bcc")}
          </button>
        </div>

        {/* Subject */}
        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{ borderBottom: "1px solid var(--color-border-default)" }}
        >
          <span
            className="w-12 shrink-0 text-[12px] font-medium"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {t("inbox.compose.subject")}
          </span>
          <input
            value={editSubject}
            onChange={(e) => { markEdited(); setEditSubject(e.target.value); }}
            className="flex-1 bg-transparent text-[13px] outline-none"
            style={{ color: "var(--color-text-primary)" }}
            placeholder={t("inbox.compose.subjectPlaceholder")}
          />
        </div>
        </>)}

        {/* Body — plain textarea, keeps markdown formatting */}
        <div className={inline ? "px-4 pb-3 pt-2" : "flex-1 overflow-auto p-4"}>
          {/* Rewrite toolbar (INBOX-C04): GTM presets + free-form, with undo.
              One row WITH the edit-with-AI field (flex-1 tail) — stacked they
              cost ~80px of the inline composer's height (UI pass 2026-07-02). */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRewriteOpen((v) => !v)}
                disabled={rewriting || !editBody.trim()}
                className="gap-1.5"
              >
                {rewriting ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {t("inbox.compose.rewrite")}
              </Button>
              {rewriteOpen && (
                <div
                  className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border p-1"
                  style={{ borderColor: "var(--color-border-default)", background: "var(--color-bg-card)", boxShadow: "var(--shadow-floating)" }}
                >
                  {REWRITE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => void handleRewrite(p.instruction)}
                      className="block w-full rounded px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-[var(--color-bg-hover)]"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {t(p.labelKey)}
                    </button>
                  ))}
                  <div className="my-1 border-t" style={{ borderColor: "var(--color-border-default)" }} />
                  <div className="flex items-center gap-1 p-1">
                    <input
                      ref={aiInstructionRef}
                      value={rewriteInstruction}
                      onChange={(e) => setRewriteInstruction(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && rewriteInstruction.trim()) {
                          e.preventDefault();
                          void handleRewrite(rewriteInstruction);
                        }
                      }}
                      placeholder={t("inbox.compose.rewriteInstructionPlaceholder")}
                      className="min-w-0 flex-1 rounded border px-2 py-1 text-[12px] outline-none"
                      style={{
                        borderColor: "var(--color-border-default)",
                        background: "var(--color-bg-page)",
                        color: "var(--color-text-primary)",
                      }}
                    />
                    <Button size="sm" onClick={() => void handleRewrite(rewriteInstruction)} disabled={!rewriteInstruction.trim()}>
                      {t("inbox.compose.go")}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Translate (INBOX-C08) */}
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTranslateOpen((v) => !v)}
                disabled={translating || !editBody.trim()}
                className="gap-1.5"
              >
                {translating ? <RefreshCw size={12} className="animate-spin" /> : <Languages size={12} />}
                {t("inbox.compose.translate")}
              </Button>
              {translateOpen && (
                <div
                  className="absolute left-0 top-full z-20 mt-1 w-40 rounded-lg border p-1"
                  style={{ borderColor: "var(--color-border-default)", background: "var(--color-bg-card)", boxShadow: "var(--shadow-floating)" }}
                >
                  {TRANSLATE_LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => void handleTranslate(l.label)}
                      className="block w-full rounded px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-[var(--color-bg-hover)]"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {t(`inbox.compose.lang.${l.code}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ONE Draft button (INBOX-C07 folded in): typed text = the brief
                it expands from; empty reply = the voice-matched thread draft.
                No bullets popover — the body IS the input. */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleDraft()}
              disabled={drafting || (!editBody.trim() && !draft.threadId)}
              className="gap-1.5"
            >
              {drafting ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {t("inbox.compose.draftAction")}
            </Button>

            {rewriteUndo != null && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditBody(rewriteUndo);
                  setRewriteUndo(null);
                }}
                className="gap-1"
              >
                <Undo2 size={12} /> {t("inbox.compose.undo")}
              </Button>
            )}
            {/* Host extras (inbox SnippetBar chips) join THIS row instead of
                stacking their own full-width row above the textarea. */}
            {toolbarExtra}
          </div>
          <textarea
            ref={bodyRef}
            value={editBody}
            onChange={(e) => { markEdited(); setEditBody(e.target.value); }}
            onInput={autoResize}
            className="h-full w-full resize-none bg-transparent text-[13px] leading-relaxed outline-none"
            style={{
              color: "var(--color-text-primary)",
              fontWeight: 400,
              // The inline reply is the FIRST card of the pane's single scroll,
              // so give the writing box a generous floor that scales with the
              // viewport — not the old cramped 88px. autoResize grows it with
              // the draft; overflow past the viewport just scrolls the pane.
              minHeight: inline ? "clamp(160px, 30vh, 380px)" : "200px",
              whiteSpace: "pre-wrap",
            }}
            placeholder={t(draft.threadId ? "inbox.compose.bodyPlaceholder" : "inbox.compose.bodyPlaceholderNew")}
          />
        </div>

        {/* Error banner */}
        {sendError && (
          <div
            className="mx-4 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px]"
            style={{
              background: "var(--color-error-soft)",
              border: "1px solid var(--color-error)",
              color: "var(--color-error)",
            }}
          >
            <AlertCircle size={14} className="shrink-0" />
            <span className="flex-1">{sendError}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSend}
              className="gap-1"
              style={{ background: "var(--color-bg-card)", color: "var(--color-error)", borderColor: "var(--color-error)" }}
            >
              <RefreshCw size={12} />
              {t("common.retry")}
            </Button>
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: "1px solid var(--color-border-default)" }}
        >
          <div className="flex items-center gap-2">
            {/* Recipient guard only — the header row already shows To once
                (founder 2026-07-02: "ça sert à rien de re-répéter ça, j'aime
                bien la vue unique de To:"). The footer speaks up only when
                Send would fail. */}
            {toEmails.length === 0 && (
              <span className="text-[11px]" style={{ color: "var(--color-warning)" }}>
                {t("inbox.compose.noRecipients")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Auto-save status (drafts persist automatically; click = save now) */}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={sending || sent}
              title={t("inbox.compose.draftAutoSaveTitle")}
              className="flex items-center gap-1 text-[11px] disabled:opacity-50"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Save size={12} />
              {draftSaving ? t("inbox.compose.draftSaving") : draftSavedAt ? t("inbox.compose.draftSaved") : t("inbox.compose.draft")}
            </button>
            {/* Send */}
            {sent ? (
              <span
                className="flex items-center gap-1 text-[13px] font-medium"
                style={{ color: "var(--color-success)" }}
              >
                <Send size={13} />
                {t("inbox.compose.sent")}
              </span>
            ) : (
              <Button
                variant="gradient"
                size="md"
                onClick={handleSend}
                disabled={sending || toEmails.length === 0}
                loading={sending}
                icon={!sending ? <Send size={13} /> : undefined}
              >
                {t("inbox.compose.send")}
              </Button>
            )}
          </div>
        </div>
      </div>
  );

  // Inline: render in place, no portal, no page-dimming backdrop (the thread
  // stays interactive behind the reply, like Gmail/Outlook).
  if (inline) return panel;

  // Drawer: a dimming backdrop + the slide-over, portalled to <body>.
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40"
        style={{
          background: "var(--color-bg-modal-overlay)",
          animation: "overlay-fade-in 200ms ease-out",
        }}
        onClick={onClose}
      />
      {panel}
    </>,
    document.body,
  );
});

/* ------------------------------------------------------------------ */
/*  Convenience hook to manage composer open/close + draft state       */
/* ------------------------------------------------------------------ */

export function useEmailComposer() {
  const [composerDraft, setComposerDraft] = useState<EmailComposerDraft | null>(null);

  const openComposer = useCallback((draft: EmailComposerDraft) => {
    setComposerDraft(draft);
  }, []);

  const closeComposer = useCallback(() => {
    setComposerDraft(null);
  }, []);

  return { composerDraft, openComposer, closeComposer };
}
