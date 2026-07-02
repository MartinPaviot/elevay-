import { getAuthContext } from "@/lib/auth/auth-utils";
import { db } from "@/db";
import { chatThreads, sequenceDrafts } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { GET as getUpNext } from "@/app/api/home/up-next/route";
import {
  buildOpener,
  type OpenerThread,
  type OpenerTodo,
} from "@/lib/chat/opener";

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

  const [todos, draftsPending, lastThread] = await Promise.all([
    loadTodos(),
    loadDraftsPending(authCtx.tenantId),
    loadLastThread(authCtx.appUserId),
  ]);

  return Response.json({
    ...buildOpener({ todos, draftsPending, lastThread }),
    generatedAt: new Date().toISOString(),
  });
}

/** NeedsYouItem rows from up-next, projected to what the opener uses. */
async function loadTodos(): Promise<OpenerTodo[]> {
  try {
    const res = await getUpNext();
    if (!res.ok) return [];
    const data = (await res.json()) as {
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
    return (data.todos ?? []).map((t) => ({
      kind: t.kind,
      title: t.title,
      subtitle: t.subtitle,
      why: t.why,
      stakes: t.stakes,
      toAddress: t.toAddress,
      entityId: t.entityId,
    }));
  } catch {
    return [];
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
