/**
 * Immediate unblock: stamp emailVerified for martin.paviot@pilae.ch.
 * Equivalent to the user clicking the verification link — sets the single
 * source of truth (auth_user."emailVerified") the gates read. Idempotent.
 */
import postgres from "postgres";

const TARGET = "martin.paviot@pilae.ch";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  const before = await sql`
    SELECT id, email, "emailVerified" FROM auth_user
    WHERE lower(email) = ${TARGET.toLowerCase()}`;
  console.log("before:", JSON.stringify(before));

  if (before.length === 0) {
    console.log("no such user — nothing to do");
    await sql.end();
    return;
  }
  if (before[0].emailVerified) {
    console.log("already verified — no change");
    await sql.end();
    return;
  }

  const after = await sql`
    UPDATE auth_user SET "emailVerified" = now()
    WHERE lower(email) = ${TARGET.toLowerCase()}
    RETURNING id, email, "emailVerified"`;
  console.log("after :", JSON.stringify(after));

  // Burn any outstanding verify tokens now that the address is confirmed.
  const burned = await sql`
    UPDATE email_verification_tokens SET used_at = now()
    WHERE user_id = ${before[0].id} AND used_at IS NULL
    RETURNING id`;
  console.log(`outstanding tokens invalidated: ${burned.length}`);

  await sql.end();
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
