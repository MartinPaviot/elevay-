/**
 * Provision Elevay owner-SMTP capacity from the Instantly-warmed cold mailboxes.
 *
 * Turns each `connected_mailboxes` row that is currently `provider="instantly"`
 * (warmed via Instantly's connect-your-own-mailbox model, no SMTP creds stored)
 * into `provider="smtp_custom"` with the box's real SMTP/IMAP credentials — so
 * the cold send path leaves via Elevay's OWN SMTP (owner-SMTP), never the
 * Instantly API. The boxes stay registered in Instantly for warm-up (which maps
 * accounts by email, not by our provider tag). See
 * `lib/sending/identity/provision-owner-smtp.ts` for the pure logic + the rigor
 * guarantees (every cred is SMTP-verified before any row is written).
 *
 * SAFE BY DEFAULT: runs in --verify-only mode unless --apply is passed. So you
 * can confirm every credential connects + authenticates WITHOUT mutating a
 * single row (and without sending a single email).
 *
 *   Verify only (no writes):  tsx scripts/provision-owner-smtp.ts [creds.json]
 *   Apply (convert rows):     tsx scripts/provision-owner-smtp.ts [creds.json] --apply
 *
 * Creds file (default scripts/.owner-smtp-creds.json — GITIGNORED, never commit):
 *   {
 *     "tenantId": "fdf9b795-...",
 *     "defaults": { "smtpHost": "smtp.zoho.eu", "smtpPort": 465,
 *                   "imapHost": "imap.zoho.eu", "imapPort": 993 },
 *     "mailboxes": [
 *       { "email": "go@getelevay.com", "password": "APP_SPECIFIC_PW" },
 *       { "email": "hi@startelevay.com", "password": "...", "smtpHost": "smtp.zoho.com" }
 *     ]
 *   }
 *
 * Env (read from process.env, else parsed from .env.local):
 *   DATABASE_URL_OWNER  — owner-role connection (port 6543 txn pooler). Falls
 *                         back to DATABASE_URL. Required only with --apply.
 *   ELEVAY_APP_SECRET   — AES key for encryptSecret. Required only with --apply.
 */

import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { verifySmtp } from "../src/lib/integrations/smtp-send";
import { encryptSecret } from "../src/lib/crypto/settings-encryption";
import {
  provisionOwnerSmtp,
  summarizeProvision,
  type OwnerSmtpCred,
  type ProvisionDeps,
} from "../src/lib/sending/identity/provision-owner-smtp";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface CredsFile {
  tenantId: string;
  defaults?: Partial<Pick<OwnerSmtpCred, "smtpHost" | "smtpPort" | "imapHost" | "imapPort">>;
  mailboxes: Array<{ email: string } & Partial<Omit<OwnerSmtpCred, "emailAddress">>>;
}

/** Read a key from process.env, falling back to a parse of .env.local. */
function readEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const envPath = join(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) return undefined;
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`));
  if (!line) return undefined;
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
}

/** Mask a connection string before printing. */
const maskUrl = (s: string) => s.replace(/:\/\/[^@\s]*@/g, "://***:***@");

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const credsPath = args.find((a) => !a.startsWith("--")) ?? join(__dirname, ".owner-smtp-creds.json");

  if (!existsSync(credsPath)) {
    console.error(`[provision] creds file not found: ${credsPath}`);
    console.error(`[provision] create it (gitignored) — see the header of this script for the shape.`);
    process.exit(2);
  }

  const file = JSON.parse(await readFile(credsPath, "utf8")) as CredsFile;
  if (!file.tenantId || !Array.isArray(file.mailboxes) || file.mailboxes.length === 0) {
    console.error(`[provision] creds file must have { tenantId, mailboxes: [...] }`);
    process.exit(2);
  }

  // Build the cred list, applying per-host defaults.
  const creds: OwnerSmtpCred[] = file.mailboxes.map((m) => ({
    emailAddress: m.email,
    password: m.password ?? "",
    smtpHost: m.smtpHost ?? file.defaults?.smtpHost ?? "",
    smtpPort: m.smtpPort ?? file.defaults?.smtpPort ?? 465,
    imapHost: m.imapHost ?? file.defaults?.imapHost ?? null,
    imapPort: m.imapPort ?? file.defaults?.imapPort ?? null,
  }));

  console.log(`[provision] tenant=${file.tenantId}  mailboxes=${creds.length}  mode=${apply ? "APPLY (writes)" : "verify-only (no writes)"}`);

  let sql: ReturnType<typeof postgres> | null = null;
  const deps: ProvisionDeps = {
    verifyOnly: !apply,
    verifySmtp: (c) => verifySmtp({ emailAddress: c.emailAddress, smtpHost: c.smtpHost, smtpPort: c.smtpPort, password: c.password }),
    encryptSecret,
    findMailbox: async (tenantId, email) => {
      if (!sql) throw new Error("db not connected");
      const rows = await sql`
        select id, provider from connected_mailboxes
        where tenant_id = ${tenantId} and lower(email_address) = ${email}
        limit 1`;
      return rows[0] ? { id: rows[0].id as string, provider: rows[0].provider as string } : null;
    },
    updateMailbox: async (id, f) => {
      if (!sql) throw new Error("db not connected");
      await sql`
        update connected_mailboxes set
          provider = ${f.provider},
          smtp_host = ${f.smtpHost},
          smtp_port = ${f.smtpPort},
          imap_host = ${f.imapHost},
          imap_port = ${f.imapPort},
          secret_encrypted = ${f.secretEncrypted},
          updated_at = now()
        where id = ${id}`;
    },
  };

  // DB + encryption are only needed when actually writing.
  if (apply) {
    const url = readEnv("DATABASE_URL_OWNER") ?? readEnv("DATABASE_URL");
    if (!url) {
      console.error("[provision] --apply needs DATABASE_URL_OWNER (or DATABASE_URL)");
      process.exit(2);
    }
    if (!readEnv("ELEVAY_APP_SECRET")) {
      console.error("[provision] --apply needs ELEVAY_APP_SECRET (encryptSecret key)");
      process.exit(2);
    }
    process.env.ELEVAY_APP_SECRET = readEnv("ELEVAY_APP_SECRET");
    console.log(`[provision] db=${maskUrl(url)}`);
    sql = postgres(url, { ssl: "require", max: 1, idle_timeout: 5 });
  }

  try {
    const results = await provisionOwnerSmtp(file.tenantId, creds, deps);
    for (const r of results) {
      const tag =
        r.outcome === "converted" || r.outcome === "verified_only"
          ? "OK "
          : r.outcome === "verify_failed"
            ? "FAIL"
            : "----";
      console.log(`  ${tag} ${r.emailAddress.padEnd(28)} ${r.outcome}${r.detail ? `  (${r.detail})` : ""}`);
    }
    const tally = summarizeProvision(results);
    console.log(
      `\n[provision] converted=${tally.converted} verified=${tally.verified_only} verify_failed=${tally.verify_failed} not_found=${tally.not_found} invalid=${tally.invalid}`,
    );
    if (!apply) console.log(`[provision] verify-only — no rows written. Re-run with --apply to convert.`);
    // Non-zero exit if any credential failed to authenticate, so CI/ops notices.
    if (tally.verify_failed > 0) process.exit(1);
  } finally {
    if (sql) await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[provision] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
