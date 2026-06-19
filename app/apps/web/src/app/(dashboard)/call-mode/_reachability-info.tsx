"use client";

/**
 * Discreet reachability affordance for a call-list row: a small Info icon
 * that reveals, on hover, the honest facts about this prospect's number,
 * role and coordinate freshness (see lib/calllist/reachability). Read-only
 * by design — it lives INSIDE the row <button>, so the trigger is a <span>
 * (never a nested button) and pointer events are stopped so glancing at the
 * info never selects the call. Actions (find a mobile, verify the role) stay
 * in the pre-call brief, which has room for buttons.
 *
 * The hover panel renders through <Floating> (a body portal): the queue column
 * is a 224px overflow-hidden aside, so an inline popover got clipped at the
 * column edge. The portal escapes the clip; a short hover grace keeps the
 * "Trouver le mobile" action reachable when the pointer crosses into the panel.
 *
 * No emoji — the Lucide Info icon + colored status dots carry the meaning.
 */

import { useRef, useState } from "react";
import { Info } from "lucide-react";
import { Floating } from "@/components/ui/floating";
import {
  computeReachability,
  reachStateLabel,
  type ReachabilityInput,
  type ReachTone,
} from "@/lib/calllist/reachability";
import { requestFindMobile } from "./_find-mobile";

const DOT: Record<ReachTone, string> = {
  good: "var(--color-success)",
  warn: "var(--color-warning)",
  muted: "var(--color-text-muted)",
};

export function ReachabilityInfo(props: ReachabilityInput & { contactId?: string; delay?: number }) {
  const { delay = 120, contactId, ...input } = props;
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState<"idle" | "pending" | "done" | "error">("idle");
  const anchorRef = useRef<HTMLSpanElement>(null);
  const showT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { state, facts } = computeReachability(input);

  async function trouver(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!contactId || find === "pending" || find === "done") return;
    setFind("pending");
    const r = await requestFindMobile([contactId]);
    setFind(r.ok ? "done" : "error");
  }

  // Icon tint hints at the state without shouting: amber when something wants
  // a look, neutral otherwise.
  const tint = state === "a_verifier" ? "var(--color-warning)" : "var(--color-text-muted)";

  // Hover with a short grace so the pointer can travel from the icon into the
  // portaled panel (which is detached in the DOM) without it closing.
  function show() {
    clearTimeout(hideT.current);
    showT.current = setTimeout(() => setOpen(true), delay);
  }
  function scheduleHide() {
    clearTimeout(showT.current);
    hideT.current = setTimeout(() => setOpen(false), 110);
  }
  function keepOpen() {
    clearTimeout(hideT.current);
  }

  return (
    // span, not button: this sits inside the row's <button>. stopPropagation
    // so hovering/clicking the info never triggers the row's onClick (select).
    <span
      ref={anchorRef}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <Info className="h-3.5 w-3.5 shrink-0" style={{ color: tint }} aria-label={`Joignabilité : ${reachStateLabel(state)}`} />
      <Floating
        anchorRef={anchorRef}
        open={open}
        placement="bottom-end"
        onMouseEnter={keepOpen}
        onMouseLeave={scheduleHide}
        className="w-56 rounded-lg border p-2 text-left"
        style={{
          background: "var(--color-bg-card)",
          borderColor: "var(--color-border-default)",
          boxShadow: "var(--shadow-floating)",
        }}
      >
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
          Joignabilité · {reachStateLabel(state)}
        </div>
        <ul className="space-y-1">
          {facts.map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs leading-snug" style={{ color: "var(--color-text-secondary)" }}>
              <span
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: DOT[f.tone] }}
              />
              <span>{f.label}</span>
            </li>
          ))}
        </ul>
        {/* Action only when there's no number to call. A span (role=button),
            not a <button>, because this lives inside the row's <button>. */}
        {contactId && state === "sans_mobile" && (
          <span
            role="button"
            tabIndex={0}
            onClick={trouver}
            className={`mt-2 block w-full rounded-md border px-2 py-1 text-center text-[11px] font-medium transition ${
              find === "idle"
                ? "cursor-pointer hover:bg-[var(--color-bg-hover)]"
                : "border-transparent"
            }`}
            style={{
              borderColor: find === "idle" ? "var(--color-border-default)" : "transparent",
              color: find === "idle" ? "var(--color-text-secondary)" : "var(--color-text-tertiary)",
            }}
          >
            {find === "idle"
              ? "Trouver le mobile"
              : find === "pending"
                ? "Recherche…"
                : find === "done"
                  ? "Demandé · résultat sous peu"
                  : "Échec — réessayer"}
          </span>
        )}
      </Floating>
    </span>
  );
}
