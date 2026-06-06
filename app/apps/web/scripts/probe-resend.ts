/**
 * Probe Resend the same way the app does. Prints raw HTTP status + body so
 * we capture the literal error (e.g. the resend.dev / unverified-domain 403).
 */
const KEY = process.env.RESEND_API_KEY!;
const FROM = process.env.INVITE_FROM_ADDRESS || "Elevay <no-reply@resend.dev>";
const TO = "martin.paviot@pilae.ch";

async function hit(label: string, url: string, init: RequestInit) {
  console.log(`\n=== ${label} ===`);
  console.log(`${init.method ?? "GET"} ${url}`);
  try {
    const res = await fetch(url, init);
    const body = await res.text();
    console.log("status:", res.status, res.statusText);
    console.log("body:", body);
  } catch (e) {
    console.log("NETWORK ERROR:", e instanceof Error ? `${e.name}: ${e.message}` : e);
    if (e instanceof Error && e.cause) console.log("cause:", e.cause);
  }
}

async function main() {
  const auth = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

  await hit("A. List domains (is any domain verified?)", "https://api.resend.com/domains", {
    headers: auth,
  });

  await hit("B. Reproduce the verification send", "https://api.resend.com/emails", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      subject: "[diagnostic] Confirm your Elevay email",
      text: "Diagnostic send to capture Resend's response. Safe to ignore.",
    }),
  });
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
