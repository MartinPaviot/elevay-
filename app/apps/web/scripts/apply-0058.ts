import postgres from "postgres";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const file = join(__dirname, "..", "drizzle", "0058_capture_approvals.sql");
  const raw = await readFile(file, "utf8");
  const statements = raw
    .split("--> statement-breakpoint")
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
  const s = postgres(process.env.DATABASE_URL!, { max: 1 });
  for (const stmt of statements) {
    await s.unsafe(stmt);
    console.log("applied:", stmt.slice(0, 60).replace(/\s+/g, " "), "...");
  }
  await s.end();
  console.log("0058 applied.");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
