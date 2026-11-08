// Captures the real app mid-action for the videos: every screen here is the
// product itself, driven by clicks. Demo mode on the public site; Live screens
// from a local server pointed at the testnet contract.
//
//   node capture.mjs <out-dir> [--base https://verity-pied-phi.vercel.app] [--live http://localhost:3200]

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const out = args[0] || "shots";
const flag = (n, d) => (args.indexOf(`--${n}`) >= 0 ? args[args.indexOf(`--${n}`) + 1] : d);
const BASE = flag("base", "https://verity-pied-phi.vercel.app");
const LIVE = flag("live", "");
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
// Captures from a local dev server: hide Next's development badge.
const newContext = browser.newContext.bind(browser);
browser.newContext = async (o) => {
  const c = await newContext(o);
  await c.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal{display:none!important}";
      document.head.append(s);
    }),
  );
  return c;
};
const shot = async (page, name, el) => {
  const f = path.join(out, `${name}.png`);
  if (el) {
    // Close-ups: keep the sticky header from sliding over the element.
    await page.evaluate(() => document.querySelector("header")?.style.setProperty("position", "relative"));
    // Finish fade-ins first, except where the rewrite highlight itself is the subject.
    await el.screenshot({ path: f, animations: name.includes("rewriting") ? "allow" : "disabled" });
    await page.evaluate(() => document.querySelector("header")?.style.removeProperty("position"));
  } else await page.screenshot({ path: f, animations: name.includes("rewriting") ? "allow" : "disabled" });
  console.log(f);
};
const para = (page, text) => page.locator("article p", { hasText: text }).first();
const wait = (page, ms) => page.waitForTimeout(ms);

async function desktop() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const card = () => page.locator("aside").first().locator("> div").first();

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await shot(page, "d01_home");

  await page.goto(`${BASE}/wiki/mount-everest`, { waitUntil: "networkidle" });
  await wait(page, 600);
  await shot(page, "d02_everest");
  await shot(page, "c02_card_mallory", card());
  await shot(page, "c02_paragraph", para(page, "Mallory"));

  await page.getByRole("button", { name: "$100" }).first().click();
  await wait(page, 300);
  await shot(page, "c03_card_100", card());
  await page.getByRole("button", { name: /^Bet \$100 on True/ }).first().click();
  await wait(page, 380);
  await shot(page, "d04_rewriting");
  await shot(page, "c04_paragraph_rewriting", para(page, "Mallory"));
  await wait(page, 2600);
  await shot(page, "d05_rewritten");
  await shot(page, "c05_paragraph_rewritten", para(page, "Mallory"));
  await shot(page, "c05_card_after", card());
  await shot(page, "c05_history", page.locator("section", { hasText: "Page history" }));

  // Pay with any coin
  await page.getByRole("button", { name: "Pay with any coin" }).first().click();
  await wait(page, 500);
  await shot(page, "d06_coins");
  await shot(page, "c06_coins", page.getByRole("dialog"));
  await page.getByRole("dialog").getByRole("button", { name: "ETH" }).click();
  await page.getByRole("button", { name: /^Send / }).waitFor({ timeout: 20000 });
  await wait(page, 400);
  await shot(page, "c07_quote", page.getByRole("dialog"));
  await page.getByRole("button", { name: /^Send / }).click();
  await wait(page, 1700);
  await shot(page, "c08_moving", page.getByRole("dialog"));
  await wait(page, 2500);

  // Settle: Great Wall
  await page.goto(`${BASE}/wiki/great-wall-of-china`, { waitUntil: "networkidle" });
  await wait(page, 500);
  await shot(page, "d09_wall");
  await card().getByRole("radio", { name: /False/ }).click();
  await card().getByRole("button", { name: /^Bet \$20 on False/ }).click();
  await wait(page, 300);
  await card().getByRole("button", { name: /Ask the AI judge/ }).click();
  await card().getByRole("button", { name: /Skip/ }).waitFor({ timeout: 20000 });
  await wait(page, 1500);
  await shot(page, "c10_judge_says", card());
  await card().getByRole("button", { name: /Skip/ }).click();
  await wait(page, 3200);
  await page.evaluate(() => scrollTo(0, 0));
  await wait(page, 300);
  await shot(page, "d11_wall_settled");
  await shot(page, "c11_card_settled", card());
  await shot(page, "c11_paragraph_settled", para(page, "from space"));

  // Dispute: Voynich decipherment → panel of three
  await page.goto(`${BASE}/wiki/voynich-manuscript?fact=voynich-decoded`, { waitUntil: "networkidle" });
  await wait(page, 500);
  await card().getByRole("button", { name: /Ask the AI judge/ }).click();
  await card().getByRole("button", { name: /Dispute/ }).waitFor({ timeout: 20000 });
  await card().getByRole("button", { name: /Dispute/ }).click();
  await card().getByText("Final answer").waitFor({ timeout: 20000 });
  await wait(page, 1500);
  await shot(page, "c12_panel", card());

  // Open question: Mallory can't be settled
  await page.goto(`${BASE}/wiki/mount-everest`, { waitUntil: "networkidle" });
  await wait(page, 400);
  await card().getByRole("button", { name: /Ask the AI judge/ }).click();
  await card().getByText("Can't settle yet").waitFor({ timeout: 20000 });
  await wait(page, 1500);
  await shot(page, "c13_cant_settle", card());

  await page.goto(`${BASE}/bets`, { waitUntil: "networkidle" });
  await wait(page, 600);
  await shot(page, "d14_bets");

  await page.goto(`${BASE}/how`, { waitUntil: "networkidle" });
  await wait(page, 400);
  await shot(page, "d15_how");
  await ctx.close();
}

async function phone() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/wiki/pluto`, { waitUntil: "networkidle" });
  await wait(page, 500);
  await shot(page, "m01_article");
  await page.locator(".fact").first().click();
  await wait(page, 600);
  await shot(page, "m02_sheet");
  await ctx.close();
}

async function live() {
  if (!LIVE) return;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${LIVE}/wiki/mount-everest?mode=demo`, { waitUntil: "networkidle" });
  await wait(page, 500);
  await page.getByRole("button", { name: "Switch to Live" }).click();
  await wait(page, 500);
  await shot(page, "c16_mode", page.getByRole("dialog"));
  await page.getByRole("dialog").getByRole("button", { name: /^Live/ }).click();
  await wait(page, 4000);
  await shot(page, "d17_live_everest");
  await page.getByRole("button", { name: "Connect wallet" }).first().click();
  await wait(page, 500);
  await shot(page, "c18_connect", page.getByRole("dialog"));
  await ctx.close();
}

try {
  await desktop();
  await phone();
  await live();
} finally {
  await browser.close();
}
