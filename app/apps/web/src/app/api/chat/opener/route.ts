import { getAuthContext } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import {
  accountLists,
  accountListMembers,
  activities,
  chatThreads,
  companies,
  contacts,
  deals,
  icps,
  knowledgeEntries,
  sequenceDrafts,
  sequenceEnrollments,
  sequences,
} from "@/db/schema";
import { and, desc, eq, gte, isNull, ne, notInArray, sql } from "drizzle-orm";
import { GET as getUpNext } from "@/app/api/home/up-next/route";
import {
  buildOpener,
  type OpenerThread,
  type OpenerTodo,
} from "@/lib/chat/opener";
import {
  selectRecipeChips,
  EMPTY_TENANT_SIGNALS,
  type TenantSignals,
} from "@/lib/chat/recipes";

/**
 * `GET /api/chat/opener` — the chat dock's agent-authored first turn.
 *
 * Deterministic (no LLM call): reuses the up-next briefing for the
 * "needs you" lanes (internal GET import — the same pattern up-next
 * itself uses for the dashboard summary), counts sequence drafts
 * pending approval, and picks the user's most recent chat thread for
 * the continuity chip. Each source degrades independently to
 * empty/zero and the route never throws. See _specs/chat-opener/.
 */
export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [upNext, draftsPending, lastThread, signals] = await Promise.all([
    loadUpNext(),
    loadDraftsPending(authCtx.tenantId),
    loadLastThread(authCtx.appUserId),
    loadTenantSignals(authCtx.tenantId),
  ]);
  const todos = upNext.todos;

  // v2 recipe catalog: gate on what the tenant's data can demo, slot-fill
  // with its real counts, and skip recipes a work chip already covers.
  const workKinds = new Set<string>();
  if (todos.some((t) => t.kind === "reply")) workKinds.add("reply");
  if (todos.some((t) => t.kind === "deal_risk")) workKinds.add("deal_risk");
  if (todos.some((t) => t.kind === "meeting")) workKinds.add("meeting");
  if (draftsPending > 0) workKinds.add("drafts");
  const recipes = selectRecipeChips(signals, 3, new Date(), workKinds);

  return Response.json({
    ...buildOpener({ todos, draftsPending, lastThread, recipes }),
    // The /chat page greets by name; up-next already resolved it.
    firstName: upNext.firstName,
    generatedAt: new Date().toISOString(),
  });
}

/**
 * Cheap per-table counts for the recipe gates. Every count fails soft to
 * its zero default — a broken source silently disables its recipes, it
 * never breaks the opener.
 */
async function loadTenantSignals(tenantId: string): Promise<TenantSignals> {
  const s: TenantSignals = { ...EMPTY_TENANT_SIGNALS };
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
  await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        withPhone: sql<number>`count(*) filter (where ${contacts.phone} is not null and ${contacts.phone} <> '')::int`,
      })
      .from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), isNull(contacts.deletedAt)))
      .then(([r]) => {
        s.contactsTotal = r?.total ?? 0;
        s.contactsWithPhone = r?.withPhone ?? 0;
      })
      .catch(() => {}),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(companies)
      .where(
        and(
          eq(companies.tenantId, tenantId),
          isNull(companies.deletedAt),
          isNull(companies.excludedReason),
        ),
      )
      .then(([r]) => {
        s.companiesTotal = r?.n ?? 0;
      })
      .catch(() => {}),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.tenantId, tenantId))
      .then(([r]) => {
        s.knowledgeEntries = r?.n ?? 0;
      })
      .catch(() => {}),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(deals)
      .where(
        and(
          eq(deals.tenantId, tenantId),
          isNull(deals.deletedAt),
          notInArray(deals.stage, ["won", "lost"]),
        ),
      )
      .then(([r]) => {
        s.openDeals = r?.n ?? 0;
      })
      .catch(() => {}),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(icps)
      .where(and(eq(icps.tenantId, tenantId), ne(icps.status, "archived")))
      .then(([r]) => {
        s.icpCount = r?.n ?? 0;
      })
      .catch(() => {}),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(activities)
      .where(
        and(
          eq(activities.tenantId, tenantId),
          isNull(activities.deletedAt),
          eq(activities.activityType, "email_received"),
          gte(activities.occurredAt, sevenDaysAgo),
        ),
      )
      .then(([r]) => {
        s.inbound7d = r?.n ?? 0;
      })
      .catch(() => {}),
    db
      .select({
        id: accountLists.id,
        name: accountLists.name,
        members: sql<number>`count(${accountListMembers.companyId})::int`,
      })
      .from(accountLists)
      .leftJoin(accountListMembers, eq(accountListMembers.listId, accountLists.id))
      .where(eq(accountLists.tenantId, tenantId))
      .groupBy(accountLists.id, accountLists.name)
      .orderBy(desc(sql`count(${accountListMembers.companyId})`))
      .limit(1)
      .then(([r]) => {
        s.biggestList = r ? { id: r.id, name: r.name, members: r.members } : null;
      })
      .catch(() => {}),
    db
      .select({
        // count(*) would count JOIN rows (a 40-enrollment sequence = 40).
        total: sql<number>`count(distinct ${sequences.id})::int`,
        withEnrollments: sql<number>`count(distinct ${sequenceEnrollments.sequenceId})::int`,
      })
      .from(sequences)
      .leftJoin(sequenceEnrollments, eq(sequenceEnrollments.sequenceId, sequences.id))
      .where(eq(sequences.tenantId, tenantId))
      .then(([r]) => {
        s.sequencesTotal = r?.total ?? 0;
        s.sequencesWithEnrollments = r?.withEnrollments ?? 0;
      })
      .catch(() => {}),
  ]);
  return s;
}

/** NeedsYouItem rows + firstName from up-next, projected for the opener. */
async function loadUpNext(): Promise<{ todos: OpenerTodo[]; firstName: string | null }> {
  try {
    const res = await getUpNext();
    if (!res.ok) return { todos: [], firstName: null };
    const data = (await res.json()) as {
      firstName?: string | null;
      todos?: Array<{
        kind: OpenerTodo["kind"];
        title: string;
        subtitle: string | null;
        why: string;
        stakes: string | null;
        toAddress: string | null;
        entityId: string | null;
      }>;
    };
    return {
      firstName: data.firstName ?? null,
      todos: (data.todos ?? []).map((t) => ({
        kind: t.kind,
        title: t.title,
        subtitle: t.subtitle,
        why: t.why,
        stakes: t.stakes,
        toAddress: t.toAddress,
        entityId: t.entityId,
      })),
    };
  } catch {
    return { todos: [], firstName: null };
  }
}

async function loadDraftsPending(tenantId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(sequenceDrafts)
      .where(
        and(
          eq(sequenceDrafts.tenantId, tenantId),
          eq(sequenceDrafts.status, "pending_approval"),
        ),
      );
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

async function loadLastThread(
  appUserId: string | null | undefined,
): Promise<OpenerThread | null> {
  if (!appUserId) return null;
  try {
    const [row] = await db
      .select({
        id: chatThreads.id,
        title: chatThreads.title,
        updatedAt: chatThreads.updatedAt,
      })
      .from(chatThreads)
      .where(eq(chatThreads.userId, appUserId))
      .orderBy(desc(chatThreads.updatedAt))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    };
  } catch {
    return null;
  }
}
