/**
 * Custom intention-Split CRUD (B3 R4). Owner-scoped; persists to the
 * user_preferences JSONB store (no migration). A split is a named per-sender
 * grouping, so an empty-senders split is rejected (it would match nothing).
 * Structural sibling of /api/inbox/lanes.
 */
import { getAuthContext } from "@/lib/auth/auth-utils";
import { getUserSplits, saveUserSplits } from "@/lib/inbox/split-store";
import type { CustomSplit } from "@/lib/inbox/splits";
import { z } from "zod";

const splitSchema = z.object({
  name: z.string().min(1).max(60),
  senders: z.array(z.string().min(1)).min(1, "a split needs at least one sender"),
  hideWhenEmpty: z.boolean().optional(),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ splits: await getUserSplits(ctx.userId) });
}

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: z.infer<typeof splitSchema>;
  try {
    body = splitSchema.parse(await req.json());
  } catch (e) {
    return Response.json(
      { error: e instanceof z.ZodError ? e.issues[0]?.message : "Invalid body" },
      { status: 422 },
    );
  }
  const splits = await getUserSplits(ctx.userId);
  const split: CustomSplit = { id: crypto.randomUUID(), ...body };
  splits.push(split);
  await saveUserSplits(ctx.userId, splits);
  return Response.json({ split }, { status: 201 });
}

export async function PATCH(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: z.infer<ReturnType<typeof splitSchema.partial>> & { id: string };
  try {
    body = splitSchema.partial().extend({ id: z.string().min(1) }).parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 422 });
  }
  const splits = await getUserSplits(ctx.userId);
  const idx = splits.findIndex((s) => s.id === body.id);
  if (idx < 0) return Response.json({ error: "Split not found" }, { status: 404 });
  splits[idx] = { ...splits[idx], ...body };
  await saveUserSplits(ctx.userId, splits);
  return Response.json({ split: splits[idx] });
}

export async function DELETE(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 422 });
  const splits = (await getUserSplits(ctx.userId)).filter((s) => s.id !== id);
  await saveUserSplits(ctx.userId, splits);
  return Response.json({ ok: true });
}
