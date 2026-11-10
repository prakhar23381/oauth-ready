// Dev helper: screenshot a page in both themes and audit computed fonts against DESIGN.md.
// usage: node scripts/shot.mjs <url> <outPrefix> [width] [height]
import { chromium } from "playwright-core";
import os from "os";
const [url, out, w = "1280", h = "2400"] = process.argv.slice(2);
const exe = process.env.CHROME_PATH ?? `${os.homedir()}/Library/Caches/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const browser = await chromium.launch({ executablePath: exe });
for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h } });
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}-${theme}.png` });
  const audit = await page.evaluate(() => {
    const bad = new Map();
    for (const el of document.querySelectorAll("body *")) {
      if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      const fam = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      const isMono = /JetBrains/i.test(fam), isSans = /^Geist(?! Mono)/i.test(fam);
      const wt = +cs.fontWeight;
      let why = null;
      if (!isMono && !isSans) why = `family ${fam}`;
      else if (isSans && wt > 500) why = `sans weight ${wt}`;
      else if (isSans && cs.textTransform === "uppercase") why = "uppercase sans";
      if (why) bad.set(why, (bad.get(why) ?? 0) + 1);
    }
    const radii = new Set();
    for (const el of document.querySelectorAll("body *")) {
      const r = getComputedStyle(el).borderTopLeftRadius;
      if (r !== "0px" && !/^(9999|3\.35544e\+07|50%)/.test(r) && el.getBoundingClientRect().width > 12) radii.add(`${el.tagName.toLowerCase()}.${(el.className + "").slice(0, 40)} ${r}`);
    }
    return { fontViolations: Object.fromEntries(bad), roundedElements: [...radii].slice(0, 8), overflowX: document.documentElement.scrollWidth > innerWidth };
  });
  console.log(theme, JSON.stringify(audit), errors.length ? `errors: ${errors.slice(0, 3).join(" | ")}` : "no console errors");
  await ctx.close();
}
await browser.close();
