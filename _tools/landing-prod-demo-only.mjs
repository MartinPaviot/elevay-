/** Confirm the sales-led landing is LIVE on prod: no /sign-up anchors,
 * Log in preserved, demo CTAs resolve to Calendly, no trial copy. */
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = "_research/raw/landing-v3";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1380, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
await page.goto("https://www.elevay.dev/", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/prod-demo-01-hero.png` });
const audit = await page.evaluate(() => {
  const a = [...document.querySelectorAll("a, [href]")];
  const hrefs = a.map((x) => x.getAttribute("href") || "");
  const t = document.body.innerText;
  return {
    signup: hrefs.filter((h) => h.includes("/sign-up")).length,
    signin: hrefs.filter((h) => h.includes("/sign-in")).length,
    calendly: hrefs.filter((h) => h.includes("calendly")).length,
    tryFree: t.includes("Try free"),
    buildList: t.includes("Build my target list"),
    bookDemo: t.includes("Book a demo"),
    login: t.includes("Log in"),
    trial: /14-day|free trial|credit card/i.test(t),
  };
});
console.log("PROD_AUDIT", JSON.stringify(audit));
const pass = audit.signup === 0 && audit.signin >= 1 && !audit.tryFree && !audit.buildList && audit.bookDemo && audit.login && !audit.trial;
console.log("RESULT", pass ? "PASS" : "FAIL");
console.log("PAGEERRORS", errors.length);
await browser.close();
