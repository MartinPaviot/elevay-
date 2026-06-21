import { getAuthContext } from "@/lib/auth/auth-utils";
import { getNoiseOverrides, saveNoiseOverrides, type NoiseOverride } from "@/lib/inbox/noise-override-store";
import { persistNoiseFilter } from "@/lib/integrations/gmail-filters";
import { z } from "zod";

/**
 * POST / DELETE /api/inbox/noise  (B4 R3/R6)
 *
 * POST  { sender, threadKey?, persistGmail? } — mark a sender (or one thread)
 *       as NOT noise. Adds an owner-scoped override that wins over every
 *       classification signal, so the thread re-promotes on the next read.
 *       Optionally attempts a best-effort Gmail filter (scope-gated; never blocks).
 * DELETE ?sender= | ?threadKey= — undo the override.
 *
 * The in-app override is the source of truth; the Gmail write is best-effort and
 * its result is reported, never fatal.
 */
const markSchema = z.object({
  sender: z.string().trim().min(1).optional(),
  threadKey: z.string().trim().min(1).optional(),
  persistGmail: z.boolean().optional(),
});

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof markSchema>;
  try {
    body = markSchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 422 });
  }
  const sender = (body.sender ?? "").trim().toLowerCase();
  if (!sender && !body.threadKey) {
    return Response.json({ error: "sender or threadKey required" }, { status: 422 });
  }

  let persist: Awaited<ReturnType<typeof persistNoiseFilter>> | null = null;
  if (body.persistGmail && sender) {
    persist = await persistNoiseFilter(ctx.userId, sender);
  }

  const overrides = await getNoiseOverrides(ctx.userId);
  // De-dupe: drop any existing override for the same target before re-adding.
  const filtered = overrides.filter((o) =>
    body.threadKey ? o.threadKey !== body.threadKey : o.sender?.toLowerCase() !== sender,
  );
  const override: NoiseOverride = {
    sender,
    ...(body.threadKey ? { threadKey: body.threadKey } : {}),
    ...(persist && persist.persisted ? { gmailFilterId: persist.filterId } : {}),
    at: new Date().toISOString(),
  };
  filtered.push(override);
  await saveNoiseOverrides(ctx.userId, filtered);

  return Response.json({ override, gmail: persist });
}

export async function DELETE(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const sender = (url.searchParams.get("sender") ?? "").trim().toLowerCase();
  const threadKey = (url.searchParams.get("threadKey") ?? "").trim();
  if (!sender && !threadKey) {
    return Response.json({ error: "sender or threadKey required" }, { status: 422 });
  }
  const overrides = await getNoiseOverrides(ctx.userId);
  const next = overrides.filter((o) =>
    threadKey ? o.threadKey !== threadKey : o.sender?.toLowerCase() !== sender,
  );
  await saveNoiseOverrides(ctx.userId, next);
  return Response.json({ ok: true });
}
