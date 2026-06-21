import { getAuthContext } from "@/lib/auth/auth-utils";
import {
  getWritingStyle,
  saveWritingStyle,
  DEFAULT_PROMPT,
  type WritingStyle,
} from "@/lib/inbox/writing-style";

/**
 * GET / PUT /api/inbox/writing-style  (B2)
 *
 * The viewer's transparent, editable Writing Style record (about-me, role,
 * scheduling link, sign-off, the literal style prompt, per-audience variants),
 * owner-scoped in user_preferences JSONB (resource "inbox", key "writing_style";
 * no migration). The draft engine prepends buildWritingStylePrompt(style). Values
 * are clamped + the scheduling link validated on save. GET also returns the
 * verbatim default prompt so the UI can offer "Reset to default" (R2.3).
 */
export async function GET() {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const style = await getWritingStyle(authCtx.userId);
  return Response.json({ style, defaultPrompt: DEFAULT_PROMPT });
}

export async function PUT(req: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Partial<WritingStyle>;
  try {
    body = (await req.json()) as Partial<WritingStyle>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const style = await saveWritingStyle(authCtx.userId, body);
  return Response.json({ style, defaultPrompt: DEFAULT_PROMPT });
}
