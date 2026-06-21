import { getAuthContext } from "@/lib/auth/auth-utils";
import { toggleSpam } from "@/lib/inbox/spam-store";

/**
 * Flag / unflag a conversation as spam (Upstream is:spam). POST { key, spam? } —
 * omit `spam` to toggle, or pass false for "Not spam". Owner-scoped via the store.
 */
export async function POST(req: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { key?: string; spam?: boolean };
  if (!body.key) return Response.json({ error: "key required" }, { status: 400 });

  const spam = await toggleSpam(authCtx.userId, body.key, body.spam);
  return Response.json({ spam });
}
