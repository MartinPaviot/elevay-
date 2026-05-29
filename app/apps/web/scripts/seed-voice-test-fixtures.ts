/**
 * Seed voice-test fixtures on staging: one phone number in the pool,
 * one test contact with a phone, both in the tenant that the logged-in
 * user already belongs to.
 *
 * Idempotent. Re-running re-uses existing rows (ON CONFLICT DO
 * NOTHING). Edit the CONSTANTS block below before first run.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/seed-voice-test-fixtures.ts
 *
 * What it does:
 *   1. Looks up the user by USER_EMAIL → grabs their tenantId
 *   2. Inserts a phone_number_pool row with the bought Twilio number
 *      (tenant-scoped + globally unique on e164)
 *   3. Inserts a test contact with the prospect phone (whichever phone
 *      you want the softphone to dial — typically your own mobile so
 *      you can hear it ring and pick up to test the full loop).
 *
 * What it does NOT do:
 *   - Buy the Twilio number (do it in Twilio Console first)
 *   - Touch the Pilae tenant (separate Clerk identity needed there)
 *   - Place a call (open /insights/hot-to-call and click Call)
 */

import postgres from "postgres";

// ────────────────────────────────────────────────────────────
// EDIT THESE BEFORE FIRST RUN
// ────────────────────────────────────────────────────────────

/** Email of the existing user whose tenant we seed into. */
const USER_EMAIL = "martin@elevay.dev";

/** E.164 phone number you bought in Twilio Console (Phone Numbers > Buy). */
const TWILIO_NUMBER_E164 = "+33xxxxxxxxx"; // TODO replace

/** Twilio SID for that bought number (starts with PN, 34 chars). */
const TWILIO_NUMBER_SID = "PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"; // TODO replace

/** ISO country code of the bought number. */
const TWILIO_NUMBER_COUNTRY = "FR";

/** Optional area code, used by local-presence dialing in number-selector.ts. */
const TWILIO_NUMBER_AREA_CODE: string | null = null;

/** Test prospect: a friendly name (anything). */
const TEST_CONTACT_FIRST = "Test";
const TEST_CONTACT_LAST = "Prospect";

/** Phone the softphone will dial when you click Call on the test contact.
 *  Use your own mobile so you can pick up and hear yourself talk via the
 *  loop. Must be in E.164 (+33..., +1..., etc.). */
const TEST_CONTACT_PHONE = "+33xxxxxxxxx"; // TODO replace

/** Optional email for the test contact (used elsewhere in the CRM). */
const TEST_CONTACT_EMAIL = "test.prospect@example.com";

// ────────────────────────────────────────────────────────────
// SCRIPT — no edits below this line should be needed
// ────────────────────────────────────────────────────────────

function preflightFail(msg: string): never {
  console.error(`\n[FAIL] ${msg}\n`);
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) preflightFail("DATABASE_URL is required");

  // Preflight: catch the TODO placeholders.
  if (TWILIO_NUMBER_E164.includes("xxxx")) {
    preflightFail(
      "Edit TWILIO_NUMBER_E164 at the top of the script — still set to the placeholder.",
    );
  }
  if (TWILIO_NUMBER_SID.includes("xxxx")) {
    preflightFail(
      "Edit TWILIO_NUMBER_SID at the top of the script — still set to the placeholder.",
    );
  }
  if (TEST_CONTACT_PHONE.includes("xxxx")) {
    preflightFail(
      "Edit TEST_CONTACT_PHONE — use your own mobile in E.164 so you can pick up.",
    );
  }
  if (!TWILIO_NUMBER_SID.startsWith("PN") || TWILIO_NUMBER_SID.length !== 34) {
    preflightFail(
      `TWILIO_NUMBER_SID should match /PN[0-9a-f]{32}/ (got prefix ${TWILIO_NUMBER_SID.slice(0, 2)}, length ${TWILIO_NUMBER_SID.length}).`,
    );
  }

  const sql = postgres(url!, { max: 1 });

  console.log("\n=== 1. Look up user + tenant ===");
  const [user] = await sql<
    Array<{ id: string; tenant_id: string }>
  >`SELECT id, tenant_id FROM users WHERE email = ${USER_EMAIL} LIMIT 1`;
  if (!user) {
    await sql.end();
    preflightFail(
      `User ${USER_EMAIL} not found in 'users' table. Sign in once via /sign-in to create the row, or edit USER_EMAIL.`,
    );
  }
  console.log(`  [OK] user.id     = ${user.id}`);
  console.log(`       tenant.id   = ${user.tenant_id}`);

  console.log("\n=== 2. Seed phone_number_pool ===");
  const poolResult = await sql<
    Array<{ id: string; inserted: boolean }>
  >`
    WITH ins AS (
      INSERT INTO phone_number_pool (
        id, tenant_id, e164, twilio_sid,
        country_code, area_code, voice, sms, active
      )
      VALUES (
        gen_random_uuid()::text,
        ${user.tenant_id},
        ${TWILIO_NUMBER_E164},
        ${TWILIO_NUMBER_SID},
        ${TWILIO_NUMBER_COUNTRY},
        ${TWILIO_NUMBER_AREA_CODE},
        TRUE, FALSE, TRUE
      )
      ON CONFLICT (e164) DO NOTHING
      RETURNING id
    )
    SELECT
      COALESCE(
        (SELECT id FROM ins),
        (SELECT id FROM phone_number_pool WHERE e164 = ${TWILIO_NUMBER_E164})
      ) AS id,
      EXISTS (SELECT 1 FROM ins) AS inserted
  `;
  console.log(
    `  [${poolResult[0].inserted ? "OK" : "--"}] phone_number_pool.${poolResult[0].id} (${poolResult[0].inserted ? "created" : "already existed"})`,
  );
  console.log(`       e164: ${TWILIO_NUMBER_E164}`);

  console.log("\n=== 3. Seed test contact ===");
  // Idempotent by (tenant_id, email) lookup since contacts has no
  // natural unique key. If a contact with this email already exists in
  // the tenant, we re-use it.
  const [existingContact] = await sql<
    Array<{ id: string }>
  >`
    SELECT id FROM contacts
    WHERE tenant_id = ${user.tenant_id} AND email = ${TEST_CONTACT_EMAIL}
    LIMIT 1
  `;
  let contactId: string;
  let contactInserted = false;
  if (existingContact) {
    contactId = existingContact.id;
  } else {
    const [created] = await sql<
      Array<{ id: string }>
    >`
      INSERT INTO contacts (
        id, tenant_id, first_name, last_name, email, phone, owner_id, score
      )
      VALUES (
        gen_random_uuid()::text,
        ${user.tenant_id},
        ${TEST_CONTACT_FIRST},
        ${TEST_CONTACT_LAST},
        ${TEST_CONTACT_EMAIL},
        ${TEST_CONTACT_PHONE},
        ${user.id},
        0.9
      )
      RETURNING id
    `;
    contactId = created.id;
    contactInserted = true;
  }
  console.log(
    `  [${contactInserted ? "OK" : "--"}] contacts.${contactId} (${contactInserted ? "created" : "already existed"})`,
  );
  console.log(
    `       ${TEST_CONTACT_FIRST} ${TEST_CONTACT_LAST} · ${TEST_CONTACT_EMAIL} · ${TEST_CONTACT_PHONE}`,
  );

  console.log("\n=== Ready to dial ===");
  console.log(
    "  1. Run: tsx --env-file=.env.local scripts/smoke-voice.ts",
  );
  console.log("  2. Sign into the app as", USER_EMAIL);
  console.log(
    "  3. Either: open /insights/hot-to-call (waits for a signal first)",
  );
  console.log(
    `     Or  : POST /api/calls/start with body { "contactId": "${contactId}" }`,
  );
  console.log("  4. Your mobile rings.");

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
