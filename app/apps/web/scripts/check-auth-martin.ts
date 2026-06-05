import postgres from "postgres";
async function main() {
  const s = postgres(process.env.DATABASE_URL!, { max: 1 });
  const au = await s`SELECT id, email, "emailVerified" AS email_verified, (password_hash IS NOT NULL) AS has_password FROM auth_user WHERE lower(email) = 'martin@elevay.dev'`;
  console.log("auth_user:", JSON.stringify(au));
  if (au.length > 0) {
    const accts = await s`SELECT provider, type FROM auth_account WHERE "userId" = ${au[0].id}`;
    console.log("linked accounts:", accts.map((a) => `${a.provider}(${a.type})`).join(", ") || "none");
  } else {
    // maybe the email is on a different auth_user casing or not present
    const all = await s`SELECT email FROM auth_user WHERE email ILIKE '%elevay%' OR email ILIKE '%martin%' LIMIT 10`;
    console.log("similar auth_user emails:", all.map((r) => r.email).join(", ") || "none");
  }
  await s.end();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
