/**
 * Final prod drift reconciliation (ADDITIVE ONLY, idempotent).
 * Closes the real drift found by audit-prod-schema-complete.ts:
 *   tables : distillation_samples (0031), prompt_experiments +
 *            prompt_experiment_metrics + meeting_opt_outs +
 *            anonymized_signal_benchmarks (0032), auth_verificationToken (0000)
 *   columns: agent_prompt_versions.canary_percent (0031),
 *            sequence_steps.step_type + channel_config (0020),
 *            activities.body_tsvector (0019, generated FTS),
 *            embeddings.search_vector (0029, generated FTS),
 *            tasks.deleted_at (0030)
 * Deliberately NOT touched (confirmed false positives):
 *   - eval_case_runs table  -> renamed to llm_eval_case_runs by 0050
 *   - eval_runs 7 columns   -> superseded LLM shape now in llm_eval_runs
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";

const url = (process.env.DATABASE_URL || "")
  .replace(/[\r\n\s]+/g, "")
  .replace(/(\/[A-Za-z0-9_]+)(?:[\\/]n|\\n)?$/, "$1")
  .trim();
if (!url) throw new Error("DATABASE_URL missing");

const dz = (f: string) =>
  readFileSync(new URL(`../drizzle/${f}`, import.meta.url), "utf8");

// 0031 + 0032 ship fully idempotent (IF NOT EXISTS + DO-$$ enum) -> run verbatim.
const verbatim = [dz("0031_distillation_and_canary.sql"), dz("0032_experiments_optouts_benchmarks.sql")];

// The rest, made idempotent by hand.
const stmts: string[] = [
  // auth_verificationToken (0000)
  `CREATE TABLE IF NOT EXISTS "auth_verificationToken" (
     "identifier" text NOT NULL,
     "token" text NOT NULL,
     "expires" timestamp NOT NULL,
     CONSTRAINT "auth_verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
   )`,
  // sequence_steps channels (0020)
  `ALTER TABLE "sequence_steps" ADD COLUMN IF NOT EXISTS "step_type" text NOT NULL DEFAULT 'email'`,
  `ALTER TABLE "sequence_steps" ADD COLUMN IF NOT EXISTS "channel_config" jsonb NOT NULL DEFAULT '{}'::jsonb`,
  `CREATE INDEX IF NOT EXISTS "sequence_steps_step_type_idx" ON "sequence_steps" ("sequence_id","step_type")`,
  // tasks soft-delete (0030)
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_tenant_not_deleted ON tasks (tenant_id) WHERE deleted_at IS NULL`,
  // embeddings FTS (0029) — generated column
  `ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS search_vector tsvector
     GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED`,
  `CREATE INDEX IF NOT EXISTS embeddings_search_vector_idx ON embeddings USING gin(search_vector)`,
  // activities FTS (0019) — generated column, guarded
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'activities' AND column_name = 'body_tsvector'
     ) THEN
       ALTER TABLE activities ADD COLUMN body_tsvector tsvector
         GENERATED ALWAYS AS (
           to_tsvector('english', COALESCE(raw_content, '') || ' ' || COALESCE(summary, ''))
         ) STORED;
       CREATE INDEX IF NOT EXISTS idx_activities_body_fts ON activities USING gin(body_tsvector);
     END IF;
   END $$`,
];

async function main() {
  const sql = postgres(url, { max: 1 });
  console.log(`host: ${new URL(url).host}`);
  let ok = 0, skipped = 0;
  for (const block of verbatim) {
    try { await sql.unsafe(block); ok++; console.log("  applied verbatim migration block"); }
    catch (e: any) { skipped++; console.warn(`  skip verbatim: ${e.message.split("\n")[0]}`); }
  }
  for (const stmt of stmts) {
    try { await sql.unsafe(stmt); ok++; }
    catch (e: any) { skipped++; console.warn(`  skip: ${e.message.split("\n")[0]} :: ${stmt.slice(0, 60).replace(/\s+/g, " ")}`); }
  }
  console.log(`applied ok:${ok} skipped:${skipped}`);
  await sql.end();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
