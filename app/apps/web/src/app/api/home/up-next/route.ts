import { withAuthRLS } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { agentActions, agentReactions, companies, contacts, deals } from "@/db/schema";
import { and, eq, isNull, desc, inArray } from "drizzle-orm";
import { GET as getSummary } from "@/app/api/dashboard/summary/route";
import {
  buildNeedsYou,
  buildLedger,
  buildEngineLine,
  type ReplyInput,
  type ApprovalInput,
  type DealRiskInput,
  type MeetingInput,
  type TaskInput,
  type ReactionInput,
  type EngineMetrics,
} from "@/lib/home/up-next";

/**
 * `/api/home/up-next` — the founder's morning briefing in one read.
 *
 * Merges LIVE sources only (inbox replies, scheduled agent actions, live at-risk
 * deals, today's meetings, due tasks) into a single ranked "Needs you" queue,
 * plus a synthesised autonomy ledger and one honest engine-health line. Each lane
 * degrades to empty independently and the route never throws (mirrors
 * /api/home/hydrate). See _specs/up-next-redesign/.
 */
export async function GET() {
  return withAuthRLS(async (authCtx) => {
    const [replies, approvals, summary, reactions] = await Promise.all([
      loadReplies(authCtx.tenantId),
      loadApprovals(authCtx.tenantId),
      loadSummary(),
      loadReactions(authCtx.tenantId),
    ]);

    const dealsAtRisk: DealRiskInput[] = (summary?.founderMetrics?.dealsAtRisk ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      stage: d.stage ?? null,
      value: d.value ?? null,
      daysSilent: d.daysSilent ?? 0,
    }));
    const meetings: MeetingInput[] = (summary?.todayMeetings ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      time: m.time,
    }));
    const tasks: TaskInput[] = (summary?.todayTasks ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      overdue: !!t.overdue,
      account: t.account ?? null,
      entityType: null,
      entityId: null,
    }));

    const items = buildNeedsYou({ replies, approvals, dealsAtRisk, meetings, tasks });
    const ledger = buildLedger(reactions);

    const fm = summary?.founderMetrics;
    const metrics: EngineMetrics = {
      totalAccounts: fm?.totalAccounts ?? 0,
      activeDeals: fm?.activeDeals ?? 0,
      totalContacts: fm?.totalContacts ?? 0,
      emailsSent7d: fm?.emailsSent7d ?? 0,
      pipelineValue: fm?.pipelineValue ?? 0,
      winRate: fm?.winRate ?? null,
    };
    const engine = buildEngineLine(metrics);

    return Response.json({
      hero: items[0] ?? null,
      items,
      ledger,
      engine,
      greeting: summary?.greeting ?? "Welcome back",
      firstName: summary?.firstName ?? null,
      generatedAt: new Date().toISOString(),
    });
  });
}

// ── Lane loaders (each degrades to [] on failure) ───────────────────

async function loadReplies(tenantId: string): Promise<ReplyInput[]> {
  try {
    const [{ loadConversationRows }, { buildConversations }] = await Promise.all([
      import("@/lib/inbox/load"),
      import("@/lib/inbox/conversations"),
    ]);
    const { inbound, outbound, triage } = await loadConversationRows(tenantId);
    const conversations = buildConversations({ inbound, outbound, triage });
    return conversations
      .filter((c) => c.lane === "attention")
      .slice(0, 25)
      .map((c) => ({
        conversationKey: c.key,
        contactId: c.contactId,
        subject: c.subject,
        fromAddress: c.fromAddress,
        reason: c.reason,
        priority: c.priority,
        lastInboundAt: c.lastInboundAt,
      }));
  } catch {
    return [];
  }
}

async function loadApprovals(tenantId: string): Promise<ApprovalInput[]> {
  try {
    const rows = await db
      .select({
        id: agentActions.id,
        actionType: agentActions.actionType,
        payload: agentActions.payload,
        createdAt: agentActions.createdAt,
      })
      .from(agentActions)
      .where(
        and(
          eq(agentActions.tenantId, tenantId),
          eq(agentActions.status, "scheduled"),
          isNull(agentActions.reversedAt),
        ),
      )
      .orderBy(desc(agentActions.createdAt))
      .limit(25);

    const base = rows.map((r) => {
      const p = (r.payload ?? {}) as Record<string, unknown>;
      const amount = num(p.amount) ?? num(p.value) ?? num(p.dealValue) ?? null;
      const explicitLabel =
        str(p.entityLabel) ?? str(p.contactName) ?? str(p.companyName) ?? str(p.dealName) ?? null;
      return {
        id: r.id,
        actionType: r.actionType,
        reasoning: str(p.reasoning),
        entityType: str(p.entityType),
        entityId: str(p.entityId),
        explicitLabel,
        confidence: num(p.confidence),
        amount,
        createdAt: r.createdAt ? new Date(r.createdAt as unknown as string).toISOString() : null,
      };
    });

    // Resolve each approval's target entity to (a) name it and (b) verify it is
    // still LIVE. The agent defers a decision, then the founder often deletes or
    // excludes the company before approving — surfacing "Create deal for <deleted
    // company>" is noise (and the executor would fail). So we drop any approval
    // whose CRM target is deleted, excluded, or missing. A `live` set gates the
    // filter; `nameMap` drives display. Both cover company/contact/deal.
    const idsOf = (type: string) => [
      ...new Set(base.filter((b) => b.entityType === type && b.entityId).map((b) => b.entityId as string)),
    ];
    const companyIds = idsOf("company");
    const contactIds = idsOf("contact");
    const dealIds = idsOf("deal");
    const live = new Set<string>();
    const nameMap = new Map<string, string>();
    await Promise.all([
      companyIds.length
        ? db
            .select({ id: companies.id, name: companies.name, deletedAt: companies.deletedAt, excludedReason: companies.excludedReason })
            .from(companies)
            .where(and(eq(companies.tenantId, tenantId), inArray(companies.id, companyIds)))
            .then((rs) =>
              rs.forEach((c) => {
                if (c.deletedAt || c.excludedReason) return; // dead/not-a-fit → not live
                live.add(`company:${c.id}`);
                if (c.name) nameMap.set(`company:${c.id}`, c.name);
              }),
            )
        : Promise.resolve(),
      contactIds.length
        ? db
            .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName, email: contacts.email, deletedAt: contacts.deletedAt })
            .from(contacts)
            .where(and(eq(contacts.tenantId, tenantId), inArray(contacts.id, contactIds)))
            .then((rs) =>
              rs.forEach((c) => {
                if (c.deletedAt) return;
                live.add(`contact:${c.id}`);
                const n = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;
                if (n) nameMap.set(`contact:${c.id}`, n);
              }),
            )
        : Promise.resolve(),
      dealIds.length
        ? db
            .select({ id: deals.id, name: deals.name, deletedAt: deals.deletedAt })
            .from(deals)
            .where(and(eq(deals.tenantId, tenantId), inArray(deals.id, dealIds)))
            .then((rs) =>
              rs.forEach((d) => {
                if (d.deletedAt) return;
                live.add(`deal:${d.id}`);
                if (d.name) nameMap.set(`deal:${d.id}`, d.name);
              }),
            )
        : Promise.resolve(),
    ]);

    const KNOWN = new Set(["company", "contact", "deal"]);
    return base
      // Drop approvals whose CRM target is dead/excluded/missing. Items with no
      // CRM entity ref (or an unknown type) can't be verified — keep them.
      .filter((b) => !(b.entityType && b.entityId && KNOWN.has(b.entityType)) || live.has(`${b.entityType}:${b.entityId}`))
      .map((b) => ({
        id: b.id,
        actionType: b.actionType,
        reasoning: b.reasoning,
        entityType: b.entityType,
        entityId: b.entityId,
        entityLabel:
          b.explicitLabel ??
          (b.entityType && b.entityId ? nameMap.get(`${b.entityType}:${b.entityId}`) ?? null : null),
        confidence: b.confidence,
        amount: b.amount,
        createdAt: b.createdAt,
      }));
  } catch {
    return [];
  }
}

async function loadReactions(tenantId: string): Promise<ReactionInput[]> {
  try {
    const rows = await db
      .select({
        trigger: agentReactions.trigger,
        contextSnapshot: agentReactions.contextSnapshot,
        actionsTaken: agentReactions.actionsTaken,
        actionsDeferred: agentReactions.actionsDeferred,
      })
      .from(agentReactions)
      .where(eq(agentReactions.tenantId, tenantId))
      .orderBy(desc(agentReactions.createdAt))
      .limit(40);
    return rows.map((r) => ({
      trigger: r.trigger,
      entityLabel: str((r.contextSnapshot as Record<string, unknown> | null)?.entityLabel) ?? null,
      actionsTaken: r.actionsTaken ?? 0,
      actionsDeferred: r.actionsDeferred ?? 0,
    }));
  } catch {
    return [];
  }
}

interface SummaryShape {
  greeting?: string;
  firstName?: string;
  founderMetrics?: {
    pipelineValue?: number;
    activeDeals?: number;
    totalContacts?: number;
    totalAccounts?: number;
    emailsSent7d?: number;
    winRate?: number | null;
    dealsAtRisk?: Array<{ id: string; name: string; stage: string | null; value: number | null; daysSilent: number }>;
  };
  todayMeetings?: Array<{ id: string; title: string; time: string }>;
  todayTasks?: Array<{ id: string; title: string; account: string | null; overdue: boolean }>;
}

async function loadSummary(): Promise<SummaryShape | null> {
  try {
    const res = await getSummary();
    if (!res.ok) return null;
    return (await res.json()) as SummaryShape;
  } catch {
    return null;
  }
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
