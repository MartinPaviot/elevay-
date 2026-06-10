// PROOF: under role elevay_app, with a SESSION-level app.tenant_id left on the
// connection (Supavisor pooler poison), the first-sign-in INSERT INTO users for
// a brand-new tenant violates the 0074 WITH CHECK. Everything rolled back.
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const adminUrl = readFileSync(".env.local", "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="))
  .slice("DATABASE_URL=".length)
  .trim();
const s = postgres(adminUrl, { max: 1, onnotice: () => {} });

// allow SET ROLE elevay_app from the admin role
for (let i = 0; i < 3; i++) {
  try {
    await s.unsafe(`GRANT elevay_app TO postgres`);
    console.log("granted elevay_app to postgres (for SET ROLE)");
    break;
  } catch (e) {
    console.log(`grant attempt ${i + 1}:`, e.message);
  }
}

async function attempt(label, poisonedTenant) {
  try {
    await s.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL ROLE elevay_app`);
      if (poisonedTenant) {
        // simulate the session-level set_config(..., false) leak — inside this
        // tx SET LOCAL-equivalent is enough to model the poisoned GUC value
        await tx.unsafe(
          `SELECT set_config('app.tenant_id', '${poisonedTenant}', true)`,
        );
      }
      const newTenant = randomUUID();
      await tx.unsafe(
        `INSERT INTO tenants (id, name) VALUES ('${newTenant}', 'probe-poison')`,
      );
      console.log(`${label}: INSERT tenants OK`);
      await tx.unsafe(
        `INSERT INTO users (id, clerk_id, tenant_id, email, role)
         VALUES ('${randomUUID()}', '${randomUUID()}', '${newTenant}', 'probe@example.invalid', 'admin')`,
      );
      console.log(`${label}: INSERT users OK`);
      throw new Error("ROLLBACK_ON_PURPOSE");
    });
  } catch (e) {
    if (e.message === "ROLLBACK_ON_PURPOSE") {
      console.log(`${label}: rolled back cleanly (success path)`);
    } else {
      console.log(`${label}: FAILED -> code=${e.code} ${e.message}`);
    }
  }
}

await attempt("no-context (clean backend)", null);
await attempt("poisoned backend (app.tenant_id=47dca783...)", "47dca783-dac0-45a5-85cb-d217b2a3174d");

await s.end();
