import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// ---------------------------------------------------------------------------
// FINDING-004: Database region assertion
//
// When GDPR_REGION=eu, verify that DATABASE_URL points to a known EU Neon
// host (e.g. *.eu-central-1.aws.neon.tech). This prevents accidental
// deployment against a US database when the privacy page claims EU hosting.
//
// In production: logs a CRITICAL warning (a hard throw would prevent
// recovery deploys, so we log and let the ops alert fire).
// In development: logs a warning to stderr.
// ---------------------------------------------------------------------------

const EU_NEON_HOST_PATTERNS = [
  ".eu-central-1.aws.neon.tech",
  ".eu-west-1.aws.neon.tech",
  ".eu-central-1.neon.tech",
  ".eu-west-1.neon.tech",
];

function assertDatabaseRegion(databaseUrl: string): void {
  const gdprRegion = process.env.GDPR_REGION?.toLowerCase();
  if (gdprRegion !== "eu") return; // No region enforcement requested

  try {
    // Parse the hostname without logging the full URL (contains password)
    const url = new URL(databaseUrl);
    const hostname = url.hostname.toLowerCase();

    const isEuHost = EU_NEON_HOST_PATTERNS.some((pattern) =>
      hostname.endsWith(pattern),
    );

    if (!isEuHost) {
      const safeHost = hostname.replace(/^[^.]+/, "***"); // Mask the project ID
      const message =
        `[db] GDPR_REGION=eu but DATABASE_URL hostname (${safeHost}) ` +
        `does not match any known EU Neon region. Expected one of: ` +
        `${EU_NEON_HOST_PATTERNS.join(", ")}. ` +
        `Provision a Neon project in eu-central-1 or set GDPR_REGION to a non-eu value.`;

      if (process.env.NODE_ENV === "production") {
        console.error(`CRITICAL: ${message}`);
      } else {
        console.warn(`WARNING: ${message}`);
      }
    }
  } catch {
    // URL parsing failed — likely a local postgres:// URL without a host
    // pattern. Silently skip; the connection itself will fail if truly bad.
  }
}

assertDatabaseRegion(process.env.DATABASE_URL!);

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle({ client, schema });

export * from "./schema";
