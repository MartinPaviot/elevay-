/** Minimal: does the current RESEND_API_KEY have domain permissions? */
async function main() {
  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  });
  const body = await res.text();
  console.log("GET /domains ->", res.status, res.statusText);
  console.log(body);
}
main().catch((e) => console.error("ERR", e instanceof Error ? e.message : e));
