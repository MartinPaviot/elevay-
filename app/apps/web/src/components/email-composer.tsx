"use client";

import { useState } from "react";

interface EmailComposerProps {
  to: string;
  subject: string;
  body: string;
  onClose: () => void;
  onSend?: (data: { to: string; subject: string; body: string }) => void;
}

export function EmailComposer({ to, subject, body, onClose, onSend }: EmailComposerProps) {
  const [editTo, setEditTo] = useState(to);
  const [editSubject, setEditSubject] = useState(subject);
  const [editBody, setEditBody] = useState(body);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (!editTo.trim() || !editBody.trim()) return;
    setSending(true);
    try {
      if (onSend) {
        onSend({ to: editTo, subject: editSubject, body: editBody });
      } else {
        // Default: call email API
        const res = await fetch("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: editTo, subject: editSubject, body: editBody }),
        });
        if (!res.ok) throw new Error("Send failed");
      }
      setSent(true);
      setTimeout(onClose, 1500);
    } catch {
      // Show error inline
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col border-l border-[#1e1f2a] bg-[#0a0b0f] shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1e1f2a] px-4 py-3">
        <h3 className="text-sm font-semibold text-[#e8e8ed]">{editSubject || "New Email"}</h3>
        <button
          onClick={onClose}
          className="text-[#5a5a70] hover:text-[#e8e8ed]"
        >
          ✕
        </button>
      </div>

      {/* Fields */}
      <div className="border-b border-[#1e1f2a] px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#5a5a70] w-12">To</span>
          <input
            value={editTo}
            onChange={(e) => setEditTo(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#e8e8ed] outline-none placeholder-[#5a5a70]"
            placeholder="recipient@example.com"
          />
        </div>
      </div>
      <div className="border-b border-[#1e1f2a] px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#5a5a70] w-12">Subject</span>
          <input
            value={editSubject}
            onChange={(e) => setEditSubject(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#e8e8ed] outline-none placeholder-[#5a5a70]"
            placeholder="Subject line"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4">
        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          className="h-full w-full resize-none bg-transparent text-sm text-[#e8e8ed] outline-none placeholder-[#5a5a70] leading-relaxed"
          placeholder="Write your email..."
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[#1e1f2a] px-4 py-3">
        <div className="flex gap-2">
          <button className="text-[#5a5a70] hover:text-[#e8e8ed]" title="Bold">
            <strong>B</strong>
          </button>
          <button className="text-[#5a5a70] hover:text-[#e8e8ed]" title="Italic">
            <em>I</em>
          </button>
        </div>
        {sent ? (
          <span className="text-sm text-emerald-400">Sent ✓</span>
        ) : (
          <button
            onClick={handleSend}
            disabled={sending || !editTo.trim()}
            className="rounded-lg bg-[#6366f1] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5558e6] disabled:opacity-50 flex items-center gap-1.5"
          >
            {sending ? "Sending..." : "Send"}
            {!sending && <span>↑</span>}
          </button>
        )}
      </div>
    </div>
  );
}
