import { db } from "@/db";
import { emailOptouts, tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "crypto";

function generateToken(tenantId: string, email: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return createHmac("sha256", secret)
    .update(`${tenantId}:${email}`)
    .digest("hex");
}

function verifyToken(
  tenantId: string,
  email: string,
  token: string
): boolean {
  try {
    const expected = generateToken(tenantId, email);
    const expectedBuf = Buffer.from(expected, "hex");
    const tokenBuf = Buffer.from(token, "hex");
    if (expectedBuf.length !== tokenBuf.length) return false;
    return timingSafeEqual(expectedBuf, tokenBuf);
  } catch {
    return false;
  }
}

function htmlResponse(title: string, message: string, status = 200) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} - LeadSens</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #09090b;
      color: rgba(255,255,255,0.92);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1rem;
    }
    .card {
      max-width: 480px;
      width: 100%;
      background: #121214;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 2rem;
      text-align: center;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 0.75rem;
    }
    p {
      color: rgba(255,255,255,0.64);
      font-size: 0.9375rem;
      line-height: 1.6;
      margin: 0;
    }
    .brand {
      color: #6366f1;
      font-size: 0.875rem;
      margin-top: 1.5rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <p class="brand">LeadSens</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function processUnsubscribe(
  email: string | null,
  tenantId: string | null,
  token: string | null
) {
  if (!email || !tenantId || !token) {
    return htmlResponse(
      "Invalid Link",
      "This unsubscribe link is missing required parameters. Please contact the sender directly to unsubscribe.",
      400
    );
  }

  if (!verifyToken(tenantId, email, token)) {
    return htmlResponse(
      "Invalid Link",
      "This unsubscribe link is invalid or has been tampered with. Please contact the sender directly to unsubscribe.",
      403
    );
  }

  // Verify tenant exists
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, tenantId));
  if (!tenant) {
    return htmlResponse(
      "Invalid Link",
      "The sender associated with this link could not be found.",
      404
    );
  }

  // Insert opt-out (ignore conflict if already unsubscribed)
  try {
    await db
      .insert(emailOptouts)
      .values({
        tenantId,
        emailAddress: email.toLowerCase(),
        reason: "unsubscribe",
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error("Failed to process unsubscribe:", error);
    return htmlResponse(
      "Error",
      "Something went wrong while processing your unsubscribe request. Please try again later or contact the sender directly.",
      500
    );
  }

  return htmlResponse(
    "Unsubscribed Successfully",
    `You have been unsubscribed. The email address <strong>${email}</strong> will no longer receive outbound messages from this sender.`
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const tenantId = searchParams.get("tenant");
  const token = searchParams.get("token");

  return processUnsubscribe(email, tenantId, token);
}

export async function POST(req: Request) {
  // Support List-Unsubscribe-Post header (RFC 8058)
  // The POST body is typically "List-Unsubscribe=One-Click"
  // But we also support JSON and URL-encoded with email/tenant/token
  const contentType = req.headers.get("content-type") || "";

  let email: string | null = null;
  let tenantId: string | null = null;
  let token: string | null = null;

  // Try to get params from URL first (List-Unsubscribe-Post uses the URL)
  const { searchParams } = new URL(req.url);
  email = searchParams.get("email");
  tenantId = searchParams.get("tenant");
  token = searchParams.get("token");

  // If not in URL, try the body
  if (!email || !tenantId || !token) {
    try {
      if (contentType.includes("application/json")) {
        const body = await req.json();
        email = email || body.email;
        tenantId = tenantId || body.tenant;
        token = token || body.token;
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const text = await req.text();
        const params = new URLSearchParams(text);
        email = email || params.get("email");
        tenantId = tenantId || params.get("tenant");
        token = token || params.get("token");
      }
    } catch {
      // Fall through to validation
    }
  }

  return processUnsubscribe(email, tenantId, token);
}
