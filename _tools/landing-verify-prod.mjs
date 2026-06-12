/** Prod smoke of the landing: real browser against www.elevay.dev —
 * asserts the new sections actually render, captures hero + cockpit. */
import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "_research/raw/landing-v3";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1380, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

await page.goto("https://www.elevay.dev/", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/prod-01-hero.png` });

const text = await page.evaluate(() => document.body.innerText);
for (const marker of ["cold-call cockpit", "Meridian", "Up next", "more likely to qualify"]) {
  console.log(`MARKER "${marker}":`, text.includes(marker) ? "OK" : "MISSING");
}

try {
  await page.getByText("A cold-call cockpit that preps you", { exact: false }).first().scrollIntoViewIfNeeded({ timeout: 8000 });
  await page.waitForTimeout(5200);
  await page.screenshot({ path: `${OUT}/prod-02-callmode-live.png` });
  console.log("SHOT prod cockpit (live)");
} catch (e) { console.log("MISS cockpit:", String(e).slice(0, 100)); }

const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
console.log("OVERFLOW", JSON.stringify(overflow), overflow.sw <= overflow.cw ? "OK" : "FAIL");
console.log("PAGEERRORS", errors.length, JSON.stringify(errors.slice(0, 3)));
await browser.close();
console.log("DONE");
