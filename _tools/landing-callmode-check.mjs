/** Focused check: the Call Mode step now enters like the other surfaces
 * (heading left-aligned, frame fades+settles in on scroll), and the page
 * still has no stranded content / overflow. */
import { chromium } from "playwright";
import fs from "node:fs";

const PORT = process.argv[2] || "3000";
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = "_research/raw/landing-v3";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1380, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 160)));

await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(2500);

// Capture the Campaigns step (the one right before Call Mode) and the Call
// Mode step in the same scroll pass, so the heading alignment + framing can be
// compared side by side.
async function shoot(text, name, settle = 1600) {
  const loc = page.getByText(text, { exact: false }).first();
  await loc.scrollIntoViewIfNeeded({ timeout: 8000 });
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("SHOT", name);
}

await shoot("Outreach drafted from real context", "fix-01-campaigns-step", 1800);
// Watch the cockpit enter: screenshot quickly after it scrolls in (catch the
// settle), then again once the cycle is mid-call.
const cockpit = page.getByText("A cold-call cockpit that preps you", { exact: false }).first();
await cockpit.scrollIntoViewIfNeeded();
await page.waitForTimeout(350);
await page.screenshot({ path: `${OUT}/fix-02-callmode-entering.png` });
await page.waitForTimeout(1300);
await page.screenshot({ path: `${OUT}/fix-03-callmode-settled.png` });
await page.waitForTimeout(4200);
await page.screenshot({ path: `${OUT}/fix-04-callmode-live.png` });
await shoot("Every meeting captured", "fix-05-meetings-step", 1800);

// Heading alignment probe: the Call Mode label/number should share the same
// left x as the Campaigns step heading (both left-aligned now).
const aligns = await page.evaluate(() => {
  const find = (t) => [...document.querySelectorAll("h3")].find((h) => h.textContent?.includes(t));
  const a = find("Outreach drafted from real context");
  const b = find("A cold-call cockpit that preps you");
  return {
    campaignsLeft: a ? Math.round(a.getBoundingClientRect().left) : null,
    callmodeLeft: b ? Math.round(b.getBoundingClientRect().left) : null,
    callmodeTextAlign: b ? getComputedStyle(b).textAlign : null,
  };
});
console.log("ALIGN", JSON.stringify(aligns));

// FAQ stagger sanity + open animation.
try {
  await page.getByText("How is this different from a CRM", { exact: false }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/fix-06-faq.png` });
  console.log("SHOT fix-06-faq");
} catch (e) { console.log("MISS faq", String(e).slice(0, 80)); }

const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
console.log("OVERFLOW", JSON.stringify(overflow), overflow.sw <= overflow.cw ? "OK" : "FAIL");

// Full sweep for stranded content.
for (let y = 0; y <= (await page.evaluate(() => document.body.scrollHeight)); y += 700) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(160);
}
const stranded = await page.evaluate(() => {
  const bad = [];
  document.querySelectorAll("section, h2, h3, p").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 80 && r.height > 14 && parseFloat(getComputedStyle(el).opacity || "1") < 0.05) {
      bad.push(el.tagName + ":" + (el.textContent || "").trim().slice(0, 40));
    }
  });
  return bad;
});
console.log("STRANDED", stranded.length, JSON.stringify(stranded.slice(0, 6)));
console.log("CONSOLE_ERRORS", errors.length, JSON.stringify(errors.slice(0, 4)));
await browser.close();
console.log("DONE");
