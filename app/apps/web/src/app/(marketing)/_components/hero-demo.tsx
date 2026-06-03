"use client";

/**
 * HeroDemo — the animated, self-playing product demo that sits in the
 * hero. A persistent app shell (faithful sidebar + Ask-Elevay chat bar)
 * whose main panel plays a real sequence with micro-animations:
 *
 *   1. Build your TAM  — accounts stream in, count ticks up
 *   2. Prioritize      — priority cards reveal, a live signal slides in
 *   3. Reach out       — an email types itself, then sends
 *   4. Ask Elevay      — a question types into the bar, the answer streams
 *
 * Auto-advances (per-phase timing), pauses on hover, runs only in view,
 * and under prefers-reduced-motion it renders a single static frame with
 * no motion.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion, useInView } from "framer-motion";
import {
  Building2, Users, CircleDot, Inbox, Phone, Clock, BookOpen, Wand2,
  Zap, Calendar, FileText, CheckSquare, BarChart3, Send, Compass, Bell,
  Reply, Eye, Check, type LucideIcon,
} from "lucide-react";
import { AppFrame, Avatar, Logo, PHOTO, clogo } from "./product-mockups";

const BRAND = "linear-gradient(90deg,#17C3B2,#2C6BED,#FF7A3D)";
const C = { green: "#4E9E86", greenSoft: "rgba(78,158,134,0.13)", red: "#D17B76", redSoft: "rgba(209,123,118,0.13)", amber: "#CDA25C", amberSoft: "rgba(205,162,92,0.15)", blue: "#2C6BED", blueSoft: "rgba(44,107,237,0.10)" };

const PHASE_MS = [4600, 4600, 6600, 6800];

/* ── helpers ─────────────────────────────────────────────────────── */

function CountUp({ to, start, duration = 1200 }: { to: number; start: boolean; duration?: number }) {
  const [n, setN] = useState(start ? 0 : to);
  useEffect(() => {
    if (!start) { setN(to); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, start, duration]);
  return <>{n.toLocaleString()}</>;
}

function Typewriter({ text, start, speed = 26, delay = 0, caret = false }: { text: string; start: boolean; speed?: number; delay?: number; caret?: boolean }) {
  const [count, setCount] = useState(start ? 0 : text.length);
  useEffect(() => {
    if (!start) { setCount(text.length); return; }
    setCount(0);
    let id: ReturnType<typeof setInterval> | undefined;
    const begin = setTimeout(() => {
      let i = 0;
      id = setInterval(() => {
        i += 1; setCount(i);
        if (i >= text.length && id) clearInterval(id);
      }, speed);
    }, delay);
    return () => { clearTimeout(begin); if (id) clearInterval(id); };
  }, [text, start, speed, delay]);
  return (
    <span>
      {text.slice(0, count)}
      {caret && count < text.length && <span className="ml-[1px] inline-block h-[1em] w-[1.5px] translate-y-[2px] animate-pulse" style={{ background: "#2C6BED" }} />}
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  const t = score >= 90 ? { c: C.green, b: C.greenSoft } : score >= 80 ? { c: C.blue, b: C.blueSoft } : { c: C.amber, b: C.amberSoft };
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums" style={{ color: t.c, background: t.b }}><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: t.c }} />{score}</span>;
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: C.blue }}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: C.blue }} />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: C.blue }} />
      </span>
      {children}
    </div>
  );
}

const listV = { hidden: {}, show: { transition: { staggerChildren: 0.13, delayChildren: 0.25 } } };
const itemV = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

/* ── sidebar (mirrors the real app) ─────────────────────────────── */

const navSections: { label?: string; items: { icon: LucideIcon; label: string }[] }[] = [
  { items: [{ icon: Clock, label: "Up next" }] },
  { label: "AI", items: [{ icon: BookOpen, label: "Knowledge" }, { icon: Wand2, label: "Skills" }] },
  { label: "CRM", items: [{ icon: Building2, label: "Accounts" }, { icon: Users, label: "Contacts" }, { icon: CircleDot, label: "Opportunities" }] },
  { label: "Engage", items: [{ icon: Inbox, label: "Inbox" }, { icon: Phone, label: "Call Mode" }, { icon: Zap, label: "Campaigns" }] },
  { label: "Activity", items: [{ icon: Calendar, label: "Meetings" }, { icon: FileText, label: "Notes" }, { icon: CheckSquare, label: "Tasks" }, { icon: BarChart3, label: "Insights" }] },
];

function Sidebar({ active }: { active: string }) {
  return (
    <aside className="hidden w-[164px] shrink-0 flex-col border-r border-[#EFEFF5] bg-white sm:flex">
      <div className="flex h-[42px] shrink-0 items-center gap-1.5 border-b border-[#EFEFF5] px-3">
        <img src="/logo-Elevay.svg" alt="" className="h-5 w-5" />
        <span className="text-[13px] font-bold" style={{ background: BRAND, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Elevay</span>
      </div>
      <div className="min-h-0 flex-1 px-2 py-2">
        {navSections.map((section, si) => (
          <div key={section.label || si} className={si > 0 ? "mt-2" : ""}>
            {section.label && <div className="mb-0.5 px-2 text-[8.5px] font-semibold uppercase tracking-wider text-[#B4B8C4]">{section.label}</div>}
            <div className="space-y-px">
              {section.items.map((n) => {
                const Icon = n.icon; const on = n.label === active;
                return (
                  <div key={n.label} className="flex h-[22px] items-center gap-2 rounded-md px-2 text-[10.5px] font-medium transition-colors" style={{ color: on ? "#1A1A2E" : "#64648C", background: on ? "rgba(44,107,237,0.08)" : "transparent", boxShadow: on ? "inset 2px 0 0 0 #2C6BED" : undefined }}>
                    <Icon size={12} style={{ color: on ? "#2C6BED" : "#9CA3AF" }} />{n.label}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-[#EFEFF5] px-3 py-2">
        <Avatar src={PHOTO.martin} size={20} /><span className="text-[11px] font-medium text-[#1A1A2E]">Martin</span>
      </div>
    </aside>
  );
}

/* ── phases ─────────────────────────────────────────────────────── */

function BuildPhase({ reduced }: { reduced: boolean }) {
  const rows = [
    { dom: "linear.app", n: "Linear", t: "Dev SaaS · Berlin", s: 94 },
    { dom: "notion.so", n: "Notion", t: "Productivity · London", s: 89 },
    { dom: "webflow.com", n: "Webflow", t: "MarTech · Paris", s: 85 },
    { dom: "airtable.com", n: "Airtable", t: "No-code · Amsterdam", s: 78 },
  ];
  return (
    <div>
      <Caption>Building your target market</Caption>
      <div className="mt-2 text-[15px] font-bold text-[#1A1A2E]"><CountUp to={544} start={!reduced} /> accounts matched</div>
      <div className="text-[11px] text-[#9CA3AF]">Scanning live B2B databases against ICP-1…</div>
      <motion.div className="mt-3 space-y-1.5" variants={listV} initial={reduced ? false : "hidden"} animate="show">
        {rows.map((r) => (
          <motion.div key={r.n} variants={reduced ? undefined : itemV} className="flex items-center gap-2.5 rounded-lg border border-[#E8E8F0] bg-white px-3 py-2">
            <Logo src={clogo(r.dom)} size={22} />
            <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-medium text-[#1A1A2E]">{r.n}</div><div className="truncate text-[10px] text-[#9CA3AF]">{r.t}</div></div>
            <ScorePill score={r.s} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function PrioritizePhase({ reduced }: { reduced: boolean }) {
  const rows = [
    { icon: Bell, tint: C.red, t: "Re-engage Linear · 12 days silent", b: { l: "Stalled", c: C.red, bg: C.redSoft } },
    { icon: Reply, tint: C.blue, t: "Reply to Julien about pricing", b: { l: "high", c: C.amber, bg: C.amberSoft } },
    { icon: Send, tint: C.green, t: "Send sequence to 18 new ICP-1 accounts", b: { l: "ready", c: C.green, bg: C.greenSoft } },
  ];
  return (
    <div className="relative">
      <Caption>Prioritizing your day</Caption>
      <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Your priorities today</div>
      <motion.div className="mt-2 space-y-1.5" variants={listV} initial={reduced ? false : "hidden"} animate="show">
        {rows.map((r) => { const Icon = r.icon; return (
          <motion.div key={r.t} variants={reduced ? undefined : itemV} className="flex items-center justify-between gap-2 rounded-lg border border-[#E8E8F0] bg-white px-3 py-2">
            <span className="flex min-w-0 items-center gap-2"><Icon size={13} style={{ color: r.tint }} className="shrink-0" /><span className="truncate text-[11.5px] font-medium text-[#1A1A2E]">{r.t}</span></span>
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: r.b.c, background: r.b.bg }}>{r.b.l}</span>
          </motion.div>
        ); })}
      </motion.div>
      <motion.div
        className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-medium text-[#1A1A2E]"
        style={{ borderColor: "rgba(44,107,237,0.22)", background: C.blueSoft }}
        initial={reduced ? false : { opacity: 0, x: 26 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduced ? 0 : 1.3, duration: 0.4 }}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-md" style={{ background: C.blueSoft }}><Eye size={12} style={{ color: C.blue }} /></span>
        Linear just viewed your pricing page <span className="text-[#9CA3AF]">· now</span>
      </motion.div>
    </div>
  );
}

function ReachPhase({ reduced }: { reduced: boolean }) {
  const [sent, setSent] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setSent(true), 4400);
    return () => clearTimeout(t);
  }, [reduced]);
  return (
    <div>
      <Caption>Drafting your outreach</Caption>
      <div className="mt-2 overflow-hidden rounded-xl border border-[#E8E8F0] bg-white">
        <div className="flex items-center justify-between border-b border-[#EFEFF5] px-3.5 py-2">
          <span className="flex items-center gap-2 text-[12px] font-semibold text-[#1A1A2E]"><Send size={13} style={{ color: C.blue }} /> Sequence · Step 2 · Email</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: "#64648C", background: "#F3F3F8" }}>Draft</span>
        </div>
        <div className="px-3.5 py-3 text-[11.5px]">
          <div className="flex items-center gap-2 text-[#64648C]"><span className="text-[#9CA3AF]">To</span><span className="flex items-center gap-1.5 rounded-full bg-[#FAFAFA] px-2 py-0.5 text-[#1A1A2E]"><Logo src={clogo("webflow.com")} size={14} bordered={false} /> tom@webflow.com</span></div>
          <div className="mt-2 min-h-[16px] font-semibold text-[#1A1A2E]"><Typewriter text="Re: the manual prospecting problem you mentioned" start={!reduced} delay={400} caret /></div>
          <div className="mt-1.5 min-h-[32px] text-[#64648C]"><Typewriter text="Hi Tom, you said your team loses ~6 hours a week stitching lists together. That's exactly the gap we close." start={!reduced} delay={1700} speed={18} caret /></div>
          <motion.div className="mt-2.5 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10.5px]" style={{ background: C.blueSoft, color: C.blue }} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 3.8 }}>
            <FileText size={11} /> Drafted from your Apr 28 call with Webflow
          </motion.div>
        </div>
        <div className="flex items-center gap-2 border-t border-[#EFEFF5] px-3.5 py-2.5">
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div key="sent" initial={reduced ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold" style={{ background: C.greenSoft, color: C.green }}>
                <Check size={13} /> Sent
              </motion.div>
            ) : (
              <motion.div key="approve" exit={reduced ? undefined : { opacity: 0 }} className="rounded-md px-3 py-1.5 text-[11px] font-semibold text-white" style={{ background: BRAND }}>Approve &amp; send</motion.div>
            )}
          </AnimatePresence>
          {!sent && <div className="rounded-md border border-[#E8E8F0] px-3 py-1.5 text-[11px] font-medium text-[#64648C]">Edit</div>}
        </div>
      </div>
    </div>
  );
}

function AskPhase({ reduced }: { reduced: boolean }) {
  const [showA, setShowA] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setShowA(true), 2400);
    return () => clearTimeout(t);
  }, [reduced]);
  return (
    <div>
      <Caption>Ask anything about your pipeline</Caption>
      <div className="mt-3 space-y-2.5">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2 text-[11.5px] text-white" style={{ background: C.blue }}>
            <Typewriter text="What did Sarah say about budget last Thursday?" start={!reduced} speed={24} />
          </div>
        </div>
        {showA && (
          <motion.div className="flex justify-start" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-[#E8E8F0] bg-white px-3 py-2.5">
              <p className="text-[11.5px] leading-relaxed text-[#1A1A2E]"><Typewriter text="Sarah said budget approval needs CFO sign-off, but she expects ~$40K is feasible this quarter." start={!reduced} speed={14} /></p>
              <motion.div className="mt-2 flex flex-wrap gap-1.5" initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 1.8 }}>
                {[{ i: Phone, t: "Call · Notion demo · May 28" }, { i: Inbox, t: "Email · Re: pricing · May 30" }].map((c) => { const Icon = c.i; return (
                  <span key={c.t} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ border: "1px solid rgba(44,107,237,0.25)", background: C.blueSoft, color: C.blue }}><Icon size={9} /> {c.t}</span>
                ); })}
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

const phases = [
  { nav: "Accounts", el: BuildPhase },
  { nav: "Up next", el: PrioritizePhase },
  { nav: "Campaigns", el: ReachPhase },
  { nav: "Up next", el: AskPhase },
];

/* ── chat bar (types the query during the Ask phase) ────────────── */

function ChatBar({ phase, reduced }: { phase: number; reduced: boolean }) {
  const asking = phase === 3;
  return (
    <div className="border-t border-[#EFEFF5] px-4 pb-3 pt-2.5">
      <div className="relative mx-auto max-w-md">
        <Compass size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
        <div className="w-full truncate rounded-xl border bg-white py-2 pl-9 pr-9 text-[11px]" style={{ borderColor: asking ? "rgba(44,107,237,0.4)" : "#E8E8F0", color: asking ? "#1A1A2E" : "#9CA3AF", boxShadow: "0 1px 2px rgba(26,26,46,0.05)" }}>
          {asking ? <Typewriter key={phase} text="What did Sarah say about budget last Thursday?" start={!reduced} speed={24} caret /> : "Show my best prospects, pipeline health, draft email…"}
        </div>
        <div className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-white" style={{ background: "#2C6BED" }}><Send size={11} /></div>
      </div>
    </div>
  );
}

/* ── orchestrator ───────────────────────────────────────────────── */

export function HeroDemo() {
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-100px 0px" });

  useEffect(() => {
    if (reduced || paused || !inView) return;
    const t = setTimeout(() => setPhase((p) => (p + 1) % phases.length), PHASE_MS[phase]);
    return () => clearTimeout(t);
  }, [phase, paused, inView, reduced]);

  const PhaseEl = phases[phase].el;

  return (
    <div ref={ref} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <AppFrame>
        <div className="flex" style={{ height: 444 }}>
          <Sidebar active={phases[phase].nav} />
          <div className="flex min-w-0 flex-1 flex-col bg-[#FAFAFA]">
            {/* phase progress dots */}
            <div className="flex items-center gap-1.5 px-4 pt-3">
              {phases.map((_, i) => (
                <button key={i} type="button" aria-label={`Step ${i + 1}`} onClick={() => setPhase(i)} className="h-1.5 cursor-pointer rounded-full transition-all" style={{ width: i === phase ? 20 : 6, background: i === phase ? "#2C6BED" : "#D9DCE4" }} />
              ))}
              <span className="ml-1 text-[10px] text-[#9CA3AF]">app.elevay.com</span>
            </div>
            <div className="relative flex-1 overflow-hidden px-4 py-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={phase}
                  initial={reduced ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
                  transition={{ duration: reduced ? 0 : 0.3, ease: "easeOut" }}
                >
                  <PhaseEl reduced={reduced} />
                </motion.div>
              </AnimatePresence>
            </div>
            <ChatBar phase={phase} reduced={reduced} />
          </div>
        </div>
      </AppFrame>
    </div>
  );
}
