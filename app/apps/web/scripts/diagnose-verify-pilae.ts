/**
 * One-off diagnostic: why didn't the verification email to
 * martin.paviot@pilae.ch arrive? Read-only — inspects DB state + Resend
 * domain/account state. Does NOT send anything.
 */
import postgres from "postgres";
import { Resend } from "resend";

const TARGET = "martin.paviot@pilae.ch";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  console.log("=== 1. auth_user lookup ===");
  const users = await sql`
    SELECT id, email, "emailVerified" AS email_verified,
           (password_hash IS NOT NULL) AS has_password, name
    FROM auth_user
    WHERE lower(email) = ${TARGET.toLowerCase()}
       OR email ILIKE '%pilae%'`;
  console.log(JSON.stringify(users, null, 2));

  for (const u of users) {
    console.log(`\n=== 2. linked accounts for ${u.email} ===`);
    const accts = await sql`
      SELECT provider, type, "providerAccountId"
      FROM auth_account WHERE "userId" = ${u.id}`;
    console.log(accts.map((a) => `${a.provider}(${a.type})`).join(", ") || "none");

    console.log(`\n=== 3. email_verification_tokens for ${u.email} ===`);
    const toks = await sql`
      SELECT id, created_at, expires_at, used_at,
             (expires_at < now()) AS expired,
             requested_ip, requested_user_agent
      FROM email_verification_tokens
      WHERE user_id = ${u.id}
      ORDER BY created_at DESC`;
    console.log(`count=${toks.length}`);
    console.log(JSON.stringify(toks, null, 2));
  }

  await sql.end();

  console.log("\n=== 4. Resend config ===");
  console.log("RESEND_API_KEY set:", Boolean(process.env.RESEND_API_KEY));
  console.log(
    "INVITE_FROM_ADDRESS:",
    process.env.INVITE_FROM_ADDRESS || "(unset -> falls back to 'Elevay <no-reply@resend.dev>')"
  );
  console.log(
    "NEXT_PUBLIC_APP_URL:",
    process.env.NEXT_PUBLIC_APP_URL || "(unset -> falls back to 'https://app.elevay.com')"
  );

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    console.log("\n=== 5. Resend verified domains ===");
    try {
      const domains = await resend.domains.list();
      console.log(JSON.stringify(domains, null, 2));
    } catch (e) {
      console.log("domains.list threw:", e instanceof Error ? e.message : e);
    }
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
