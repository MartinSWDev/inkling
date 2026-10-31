/** Scripted playthrough for review: screenshots of every scene + flow.webm.
 * Run: npm --prefix web run capture   (needs API on 8000 and web dev/preview server)
 * Env: CAPTURE_URL (default http://127.0.0.1:5174)
 */
import { chromium, type Page } from "playwright";
import { mkdirSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../review_out");
const BASE = process.env.CAPTURE_URL || "http://127.0.0.1:5174";
mkdirSync(OUT, { recursive: true });

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
}
async function clickText(page: Page, re: RegExp) {
  const btn = page.getByRole("button", { name: re }).first();
  if (await btn.count()) { await btn.click().catch(() => null); return true; }
  return false;
}
async function step(name: string, fn: () => Promise<void>) {
  try { await fn(); } catch (e) { console.log("step failed (continuing):", name, String(e).slice(0, 160)); }
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  recordVideo: { dir: OUT, size: { width: 390, height: 844 } },
});
const page = await context.newPage();
await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => page.goto(BASE));
await page.waitForTimeout(1200);
await shot(page, "01-landing");

await step("start", async () => { await clickText(page, /find my subjects|start/i); });
await page.waitForTimeout(1800);
await shot(page, "02-intro");
await step("lets-go", async () => { await clickText(page, /let's go|lets go|continue/i); });
await page.waitForTimeout(1400);
await shot(page, "03-round-title-or-round1");

await step("round1 chips", async () => {
  const chips = page.locator(".chip");
  for (let i = 0; i < Math.min(4, await chips.count()); i++) { await chips.nth(i).click(); await page.waitForTimeout(250); }
});
await shot(page, "04-round1-picked");
await step("round1 continue", async () => { await clickText(page, /continue/i); });
await page.waitForTimeout(3400);
await shot(page, "05-round2");

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
await shot(page, "06-round2-done");
await step("round2 continue", async () => { await clickText(page, /continue/i); });
await page.waitForTimeout(3400);
await shot(page, "07-round3-pairs");

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
await shot(page, "08-round4");
await step("round4 answers", async () => {
  await page.keyboard.press("ArrowUp").catch(() => null);
  await page.waitForTimeout(600);
  for (let i = 0; i < 4; i++) { await page.getByRole("button", { name: /^yes$/i }).click().catch(() => null); await page.waitForTimeout(450); }
});
await shot(page, "09-round4-done");
await step("build room", async () => { await clickText(page, /build my room|continue|see my subjects/i); });
await page.waitForTimeout(2500);
await shot(page, "10-finale-or-reveal");

for (let p = 1; p <= 5; p++) {
  await step("reveal page " + p, async () => {
    await page.locator(".zone.right").click({ force: true }).catch(() => page.mouse.click(340, 420));
  });
  await page.waitForTimeout(1200);
  await shot(page, `11-reveal-${p}`);
}
await page.waitForTimeout(800);
const videoPath = await page.video()?.path().catch(() => null);
await context.close();
await browser.close();
if (videoPath) { renameSync(videoPath, `${OUT}/flow.webm`); console.log("video", `${OUT}/flow.webm`); }
console.log("done ->", OUT);
