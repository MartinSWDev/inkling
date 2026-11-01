/** Scripted playthrough for review at phone (390x844) and desktop (1280x800).
 * Saves scene screenshots (desktop ones suffixed -desktop) plus flow.webm and
 * flow-desktop.webm. Run: npm --prefix web run capture (API on 8000, web server up)
 * Env: CAPTURE_URL (default http://127.0.0.1:5174)
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdirSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../review_out");
const BASE = process.env.CAPTURE_URL || "http://127.0.0.1:5174";
mkdirSync(OUT, { recursive: true });

async function playthrough(browser: Browser, vp: { width: number; height: number }, suffix: string) {
  const context = await browser.newContext({
    viewport: vp, deviceScaleFactor: 2, isMobile: suffix === "", hasTouch: true,
    recordVideo: { dir: OUT, size: vp },
  });
  const page = await context.newPage();
  const shot = async (name: string) => { await page.screenshot({ path: `${OUT}/${name}${suffix}.png` }); console.log("shot", name + suffix); };
  const clickText = async (re: RegExp) => {
    const btn = page.getByRole("button", { name: re }).first();
    if (await btn.count()) { await btn.click().catch(() => null); return true; }
    return false;
  };
  const step = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { console.log("step failed (continuing):", name, String(e).slice(0, 140)); }
  };

  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => page.goto(BASE));
  await page.waitForTimeout(1200);
  await shot("01-landing");
  await step("start", async () => { await clickText(/find my subjects|start/i); });
  await page.waitForTimeout(750);
  await shot("01b-unfold");
  await page.waitForTimeout(1100);
  await shot("02-intro");
  await step("lets-go", async () => { await clickText(/let's go|lets go|continue/i); });
  await page.waitForTimeout(1400);
  await shot("03-round-title-or-round1");
  await step("round1 chips", async () => {
    const chips = page.locator(".chip");
    for (let i = 0; i < Math.min(4, await chips.count()); i++) { await chips.nth(i).click(); await page.waitForTimeout(250); }
  });
  await shot("04-round1-picked");
  await step("round1 continue", async () => { await clickText(/continue/i); });
  await page.waitForTimeout(3400);
  await shot("05-round2");
  await step("round2 swipe + buttons", async () => {
    const card = page.locator(".card.swipe");
    const box = await card.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(700);
    }
    for (let i = 0; i < 4; i++) { await page.getByRole("button", { name: /^yes$/i }).click().catch(() => null); await page.waitForTimeout(450); }
  });
  await shot("06-round2-done");
  await step("sticker tag", async () => {
    const st = page.locator(".room-wrap .sticker-img");
    if (await st.count()) { await st.first().click({ force: true }); await page.waitForTimeout(600); }
  });
  await shot("06b-sticker-tag");
  await step("round2 continue", async () => { await clickText(/continue/i); });
  await page.waitForTimeout(3400);
  await shot("07-round3-pairs");
  await step("round3 pairs", async () => {
    for (let i = 0; i < 10; i++) {
      const pc = page.locator(".pcard");
      if (!(await pc.count())) break;
      await pc.first().click().catch(() => null);
      await page.waitForTimeout(500);
      if (await page.locator(".card.swipe").count()) break;
    }
  });
  await page.waitForTimeout(3400);
  await shot("08-round4");
  await step("round4 answers", async () => {
    await page.keyboard.press("ArrowUp").catch(() => null);
    await page.waitForTimeout(600);
    for (let i = 0; i < 4; i++) { await page.getByRole("button", { name: /^yes$/i }).click().catch(() => null); await page.waitForTimeout(450); }
  });
  await shot("09-round4-done");
  await step("build room", async () => { await clickText(/build my room|continue|see my subjects/i); });
  await page.waitForTimeout(2500);
  await shot("10-finale-or-reveal");
  await step("finale tap", async () => { await page.locator(".finale").click().catch(() => null); });
  await page.waitForTimeout(1500);
  await shot("11-reveal-0-top3");
  for (let p = 1; p <= 5; p++) {
    if (p === 2) {
      await step("wildcard flip", async () => { await page.locator(".wildcard").click().catch(() => null); });
      await page.waitForTimeout(1100);
      await shot("11-reveal-2-wildcard");
    }
    await step("reveal page " + p, async () => {
      await page.locator(".zone.right").click({ force: true }).catch(() => page.mouse.click(vp.width - 50, vp.height / 2));
    });
    await page.waitForTimeout(1200);
    await shot(`11-reveal-${p}`);
    if (p === 2) {
      await step("course sheet", async () => {
        await page.getByRole("button", { name: /see courses/i }).first().click();
        await page.waitForTimeout(900);
      });
      await shot("11-reveal-2-courses");
      await step("close course sheet", async () => { await page.getByRole("button", { name: /^close$/i }).click().catch(() => null); await page.waitForTimeout(400); });
    }
  }
  await page.waitForTimeout(800);
  const videoPath = await page.video()?.path().catch(() => null);
  await context.close();
  if (videoPath) { const dest = `${OUT}/flow${suffix}.webm`; renameSync(videoPath, dest); console.log("video", dest); }
}

const browser = await chromium.launch();
await playthrough(browser, { width: 390, height: 844 }, "");
await playthrough(browser, { width: 1280, height: 800 }, "-desktop");
await browser.close();
console.log("done ->", OUT);
