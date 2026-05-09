"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ChevronDown, ArrowLeft } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { DetailPageSkeleton } from "@/components/ui/skeleton";

/**
 * Phase 3c — Company Brain UI surface.
 *
 * Consumes GET /api/brain/[companyId] and renders the unified
 * account view in collapsible sections. Multi-tenant scope is
 * enforced server-side by the API route (which derives tenantId
 * from getAuthContext) — no tenant logic in the client.
 */

// Types mirror lib/company-brain/types.ts but with ISO strings on
// the wire (Date instances are serialised by Next).
interface BrainCompany {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  sizeBand: string | null;
  score: number | null;
  createdAt: string;
}

interface BrainContact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  title: string | null;
  isChampion: boolean;
  intentScore: number | null;
  intentTrend: "heating" | "stable" | "cooling" | null;
  lastTouchAt: string | null;
}

interface DealPropertyMetadata {
  value: unknown;
  source: string;
  date: string | null;
  manual: boolean;
  confidence: number | null;
}

interface BrainDeal {
  id: string;
  name: string;
  stage: string;
  value: number | null;
  expectedCloseDate: string | null;
  properties: Record<string, DealPropertyMetadata>;
  riskLevel: "low" | "medium" | "high" | "none" | null;
  riskReasons: string[];
  stallProbability: number | null;
  stallIndicators: Array<{ type: string; severity: string; detail: string }>;
}

interface BrainActivity {
  id: string;
  type: string;
  direction: string | null;
  occurredAt: string;
  summary: string | null;
}

interface BrainMeeting {
  id: string;
  title: string;
  occurredAt: string;
  transcriptChunkCount: number;
}

interface BrainKnowledge {
  id: string;
  title: string;
  body: string;
  scope: string;
}

interface BrainEdge {
  sourceId: string;
  targetId: string;
  relationType: string;
  fact: string;
  confidence: number | null;
}

interface BrainMemory {
  id: string;
  scope: string;
  content: string;
  createdAt: string;
}

interface CompanyBrainView {
  company: BrainCompany;
  contacts: BrainContact[];
  deals: BrainDeal[];
  activities: BrainActivity[];
  meetings: BrainMeeting[];
  knowledgeEntries: BrainKnowledge[];
  contextGraphEdges: BrainEdge[];
  memories: BrainMemory[];
  freshness: Record<string, string | null>;
  truncated: { activities: boolean; contacts: boolean; memories: boolean };
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().split("T")[0]!;
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "never";
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function riskColor(level: BrainDeal["riskLevel"]): string {
  switch (level) {
    case "high":
      return "var(--color-danger, #dc2626)";
    case "medium":
      return "var(--color-warning, #d97706)";
    case "low":
      return "var(--color-text-tertiary)";
    default:
      return "var(--color-text-tertiary)";
  }
}

function Section({
  title,
  count,
  freshness,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  freshness?: string | null;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--color-bg-hover)] transition-colors"
        style={{ borderBottom: open ? "1px solid var(--color-border-default)" : "none" }}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="font-medium text-sm">{title}</span>
          {count !== undefined && (
            <Badge variant="neutral">{count}</Badge>
          )}
        </div>
        {freshness && (
          <span
            className="text-[11px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            updated {formatRelative(freshness)}
          </span>
        )}
      </button>
      {open && <CardBody>{children}</CardBody>}
    </Card>
  );
}

export default function AccountBrainPage() {
  const params = useParams();
  const accountId = params.id as string;
  const [brain, setBrain] = useState<CompanyBrainView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/brain/${accountId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled)
            setError(body?.error ?? `Failed to load brain (${res.status})`);
          return;
        }
        const data = (await res.json()) as CompanyBrainView;
        if (!cancelled) setBrain(data);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (loading) return <DetailPageSkeleton />;

  if (error) {
    return (
      <div className="p-6">
        <p style={{ color: "var(--color-text-tertiary)" }}>{error}</p>
        <Link
          href={`/accounts/${accountId}`}
          className="inline-flex items-center gap-1 mt-4 text-sm hover:underline"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <ArrowLeft size={14} /> Back to account
        </Link>
      </div>
    );
  }

  if (!brain) return null;

  const { company, contacts, deals, activities, meetings, knowledgeEntries, contextGraphEdges, memories, freshness, truncated } = brain;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Breadcrumbs
        items={[
          { label: "Accounts", href: "/accounts" },
          { label: company.name, href: `/accounts/${accountId}` },
          { label: "Brain" },
        ]}
      />

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold">{company.name} — Brain</h1>
        <p
          className="text-sm mt-1"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Unified read of every artifact and derived signal we have on this account.
        </p>
      </div>

      {/* Overview */}
      <Card className="mb-3">
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Domain</p>
              <p>{company.domain ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Industry</p>
              <p>{company.industry ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Size</p>
              <p>{company.sizeBand ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>Score</p>
              <p>{company.score ?? "—"}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Section
        title="Contacts"
        count={contacts.length}
        freshness={freshness.contacts}
      >
        {contacts.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>No contacts.</p>
        ) : (
          <ul className="space-y-2">
            {contacts.map((c) => {
              const fullName = [c.firstName, c.lastName].filter(Boolean).join(" ");
              return (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{fullName || c.email || c.id}</span>
                    {c.title && (
                      <span style={{ color: "var(--color-text-tertiary)" }}> — {c.title}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {c.isChampion && <Badge variant="success">champion</Badge>}
                    {c.intentScore !== null && (
                      <Badge variant="neutral">
                        intent {c.intentScore}
                        {c.intentTrend ? `/${c.intentTrend}` : ""}
                      </Badge>
                    )}
                    <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                      {formatRelative(c.lastTouchAt)}
                    </span>
                  </div>
                </li>
              );
            })}
            {truncated.contacts && (
              <li className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                List truncated — query with ?contacts=N to see more.
              </li>
            )}
          </ul>
        )}
      </Section>

      <Section
        title="Open deals"
        count={deals.length}
        freshness={freshness.deals}
      >
        {deals.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>No deals.</p>
        ) : (
          <ul className="space-y-3">
            {deals.map((d) => (
              <li key={d.id} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{d.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">{d.stage}</Badge>
                    {d.value !== null && (
                      <span style={{ color: "var(--color-text-tertiary)" }}>${d.value.toLocaleString()}</span>
                    )}
                    {d.riskLevel && d.riskLevel !== "none" && (
                      <span
                        className="text-[11px] font-medium uppercase"
                        style={{ color: riskColor(d.riskLevel) }}
                      >
                        {d.riskLevel}
                      </span>
                    )}
                    {d.stallProbability !== null && (
                      <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                        stall {Math.round(d.stallProbability * 100)}%
                      </span>
                    )}
                  </div>
                </div>
                {d.riskReasons.length > 0 && (
                  <ul className="mt-1 ml-4 list-disc text-[12px]" style={{ color: "var(--color-text-tertiary)" }}>
                    {d.riskReasons.slice(0, 3).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
                {Object.keys(d.properties).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                    {Object.entries(d.properties).slice(0, 6).map(([k, m]) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 rounded"
                        style={{
                          background: "var(--color-bg-hover)",
                          color: "var(--color-text-secondary)",
                        }}
                        title={`source: ${m.source}${m.confidence !== null ? `, conf ${m.confidence}` : ""}`}
                      >
                        {k}: {String(m.value).slice(0, 30)}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Recent activities"
        count={activities.length}
        freshness={freshness.activities}
      >
        {activities.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>No activities.</p>
        ) : (
          <ul className="space-y-1.5">
            {activities.map((a) => (
              <li key={a.id} className="flex items-baseline gap-2 text-sm">
                <span className="text-[11px] tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>
                  {formatDate(a.occurredAt)}
                </span>
                <span className="font-medium">{a.type}</span>
                {a.direction && (
                  <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                    {a.direction}
                  </span>
                )}
                {a.summary && (
                  <span style={{ color: "var(--color-text-secondary)" }}>{a.summary.slice(0, 200)}</span>
                )}
              </li>
            ))}
            {truncated.activities && (
              <li className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                List truncated — query with ?recentActivities=N to see more.
              </li>
            )}
          </ul>
        )}
      </Section>

      <Section
        title="Meetings"
        count={meetings.length}
        freshness={freshness.meetings}
        defaultOpen={false}
      >
        {meetings.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>No meetings.</p>
        ) : (
          <ul className="space-y-1.5">
            {meetings.map((m) => (
              <li key={m.id} className="flex items-baseline gap-2 text-sm">
                <span className="text-[11px] tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>
                  {formatDate(m.occurredAt)}
                </span>
                <span className="font-medium">{m.title}</span>
                {m.transcriptChunkCount > 0 && (
                  <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                    {m.transcriptChunkCount} transcript chunks
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Knowledge"
        count={knowledgeEntries.length}
        freshness={freshness.knowledgeEntries}
        defaultOpen={false}
      >
        {knowledgeEntries.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>No knowledge entries.</p>
        ) : (
          <ul className="space-y-2">
            {knowledgeEntries.map((k) => (
              <li key={k.id} className="text-sm">
                <p className="font-medium">{k.title}</p>
                <p className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
                  {k.body.slice(0, 300)}
                  {k.body.length > 300 ? "…" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Graph facts"
        count={contextGraphEdges.length}
        freshness={freshness.contextGraphEdges}
        defaultOpen={false}
      >
        {contextGraphEdges.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>No graph edges.</p>
        ) : (
          <ul className="space-y-1.5">
            {contextGraphEdges.map((e, i) => (
              <li key={i} className="text-sm">
                <Badge variant="neutral">{e.relationType}</Badge>
                <span className="ml-2" style={{ color: "var(--color-text-secondary)" }}>{e.fact}</span>
                {e.confidence !== null && (
                  <span className="ml-2 text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                    {Math.round(e.confidence * 100)}%
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Memories"
        count={memories.length}
        freshness={freshness.memories}
        defaultOpen={false}
      >
        {memories.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>No memories.</p>
        ) : (
          <ul className="space-y-2">
            {memories.map((m) => (
              <li key={m.id} className="text-sm">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant="neutral">{m.scope}</Badge>
                  <span className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                    {formatRelative(m.createdAt)}
                  </span>
                </div>
                <p style={{ color: "var(--color-text-secondary)" }}>{m.content}</p>
              </li>
            ))}
            {truncated.memories && (
              <li className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                List truncated — query with ?memories=N to see more.
              </li>
            )}
          </ul>
        )}
      </Section>

      <div className="mt-6">
        <Link
          href={`/accounts/${accountId}`}
          className="inline-flex items-center gap-1 text-sm hover:underline"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <ArrowLeft size={14} /> Back to account
        </Link>
      </div>
    </div>
  );
}
