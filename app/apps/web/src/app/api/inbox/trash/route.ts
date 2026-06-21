import { getAuthContext } from "@/lib/auth/auth-utils";
import { toggleTrashed } from "@/lib/inbox/trash-store";

/**
 * Trash / restore a conversation (Upstream is:trash). POST { key, trashed? } —
 * omit `trashed` to toggle, or pass false to restore. Owner-scoped via the store.
 */
export async function POST(req: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { key?: string; trashed?: boolean };
  if (!body.key) return Response.json({ error: "key required" }, { status: 400 });

  const trashed = await toggleTrashed(authCtx.userId, body.key, body.trashed);
  return Response.json({ trashed });
}
