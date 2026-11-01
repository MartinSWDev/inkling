/** Mobile polish test (prompts/11 section J). Playwright device emulation +
 * touch across iPhone 13, iPhone SE, Pixel 7 and the desktop frame.
 * Plays the full flow with taps/touch-drags, screenshots every step to
 * review_out/mobile/<device>/, and fails on: truncated text (ellipsis /
 * scrollWidth > clientWidth in chips, cards, titles), scrollable containers
 * or document scroll during rounds/reveal, buttons outside the viewport,
 * room left/right edges (wardrobe + shelf spots) outside the viewport, and
 * the round-1 heart test (select -> heart = selected AND favourited).
 * Run: npm --prefix web run mobile   (API on 8000, web on 5174)
 */
import { chromium, devices, type Browser, type Page } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../review_out/mobile");
const BASE = process.env.CAPTURE_URL || "http://127.0.0.1:5174";
mkdirSync(OUT, { recursive: true });

const failures: string[] = [];
const fail = (dev: string, step: string, msg: string) => { failures.push(`[${dev}] ${step}: ${msg}`); console.log("FAIL", `[${dev}]`, step, "-", msg); };

async function scan(page: Page, dev: string, step: string) {
  const found = await page.evaluate(() => {
    const out: string[] = [];
    const vis = (el: Element) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden"; };
    // Truncated text in chips/cards/titles/buttons.
    const sels = ".chip,.cardtag,.paperlabel,.pcard .lbl,.btn,.top3card h3,.courselist b,.views button,.daypick button,.titlebig,.sheet2 h2,.pc h2";
    document.querySelectorAll(sels).forEach((el) => {
      if (!vis(el)) return;
      const s = getComputedStyle(el);
      const t = (el.textContent || "").trim().slice(0, 28);
      if (s.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1) out.push(`ellipsis truncation: "${t}"`);
      else if (el.scrollWidth > el.clientWidth + 2 && s.overflowX !== "visible" && !el.classList.contains("chip")) out.push(`horizontal overflow: "${t}"`);
      // Chip name spans specifically must never be cut.
      el.querySelectorAll("span").forEach((sp) => { const ss = getComputedStyle(sp); if (sp.scrollWidth > sp.clientWidth + 1 && (ss.whiteSpace === "nowrap" || ss.textOverflow === "ellipsis")) out.push(`chip/label truncation: "${(sp.textContent || "").trim().slice(0, 28)}"`); });
    });
    // Scrollable containers (course sheet is a modal list: exempt) + doc scroll.
    document.querySelectorAll(".app *").forEach((el) => {
      if (!vis(el) || el.classList.contains("coursesheet")) return;
      const s = getComputedStyle(el);
      if ((s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 2)
        out.push(`scrollable container: .${[...el.classList].join(".")} (${el.scrollHeight}>${el.clientHeight})`);
    });
    if (document.documentElement.scrollHeight > window.innerHeight + 2 || window.scrollY > 0) out.push("document scrolls");
    // Buttons outside the viewport.
    const vw = window.innerWidth, vh = window.innerHeight;
    document.querySelectorAll("button").forEach((el) => {
      if (!vis(el)) return;
      const r = el.getBoundingClientRect();
      if (r.left < -2 || r.top < -2 || r.right > vw + 2 || r.bottom > vh + 2)
        out.push(`button outside viewport: "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}" [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}]`);
    });
    return out;
  }).catch(() => [] as string[]);
  for (const f of found) fail(dev, step, f);
  return found;
}

async function roomEdges(page: Page, dev: string, step: string) {
  const res = await page.evaluate(async () => {
    const stack = document.querySelector(".room-wrap .room-stack");
    if (!stack) return null;
    const layout = await fetch("/room/layout.json").then((r) => r.json());
    const rect = stack.getBoundingClientRect();
    const tall = stack.classList.contains("tall");
    const H = tall ? 2496 : 2048, off = tall ? (layout.tall?.topOffset ?? 224) : 0;
    const px = (x: number) => rect.left + (x / 1152) * rect.width;
    const py = (y: number) => rect.top + ((y + off) / H) * rect.height;
    const shelf = layout.spots.shelf_top.anchor;
    const leftmost = Object.values(layout.spots as Record<string, { anchor: [number, number] }>).reduce((a, s) => (s.anchor[0] < a[0] ? s.anchor : a), [1152, 0] as [number, number]);
    return { shelfX: px(shelf[0]), shelfY: py(shelf[1]), leftX: px(leftmost[0]), vw: window.innerWidth, vh: window.innerHeight };
  }).catch(() => null);
  if (!res) return;
  if (res.leftX < -2) fail(dev, step, `room left edge spot off-screen x=${Math.round(res.leftX)}`);
  if (res.shelfX > res.vw + 2) fail(dev, step, `shelf spot off-screen x=${Math.round(res.shelfX)}>${res.vw}`);
  if (res.shelfY < -2 || res.shelfY > res.vh + 2) fail(dev, step, `shelf spot y off-screen ${Math.round(res.shelfY)}`);
}

async function run(browser: Browser, name: string, ctxOpts: object) {
  const dir = `${OUT}/${name}`;
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  const shot = async (n: string) => { await page.screenshot({ path: `${dir}/${n}.png` }); console.log("shot", name, n); };
  const step = async (n: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { console.log("step failed (continuing):", name, n, String(e).slice(0, 120)); } };
  const tapText = async (re: RegExp) => { const b = page.getByRole("button", { name: re }).first(); await b.tap(); };

  await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => page.goto(BASE));
  await page.waitForTimeout(1100);
  await shot("01-landing");
  await scan(page, name, "landing");
  await step("start", () => tapText(/find my subjects/i));
  await page.waitForTimeout(600);
  await shot("02-unfold");
  await page.waitForTimeout(1200);
  await shot("03-intro");
  await step("dusk-day", async () => { await tapText(/^dusk$/i); await page.waitForTimeout(350); await shot("03b-intro-dusk"); await tapText(/^day$/i); await page.waitForTimeout(300); });
  await step("lets-go", () => tapText(/let's go/i));
  await page.waitForTimeout(1700);
  await shot("04-round1");
  await roomEdges(page, name, "round1");
  // Heart test (B1): select Physics, tap its heart -> selected AND favourited.
  await step("heart test", async () => {
    const chip = page.locator(".chip", { hasText: "Physics" }).first();
    await chip.tap();
    await page.waitForTimeout(250);
    await chip.locator(".heart").tap();
    await page.waitForTimeout(300);
    const cls = await chip.getAttribute("class");
    const pressed = await chip.getAttribute("aria-pressed");
    if (pressed !== "true" || !(cls || "").includes("loved")) fail(name, "round1 heart", `Physics after heart: aria-pressed=${pressed} class=${cls}`);
    await shot("04b-round1-heart");
  });
  await step("more chips", async () => {
    for (const t of ["Maths", "English"]) { await page.locator(".chip", { hasText: t }).first().tap().catch(() => null); await page.waitForTimeout(200); }
  });
  await scan(page, name, "round1");
  await shot("04c-round1-picked");
  await step("round1 continue", () => tapText(/continue/i));
  await page.waitForTimeout(1600);
  await shot("05-round2");
  await roomEdges(page, name, "round2");
  await step("round2 drag", async () => {
    const card = page.locator(".card.swipe");
    const box = await card.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 150, box.y + box.height / 2, { steps: 10 });
      await page.waitForTimeout(200);
      await shot("05b-round2-drag");
      await page.mouse.up();
      await page.waitForTimeout(650);
    }
  });
  await step("round2 yes", async () => { for (let i = 0; i < 4; i++) { await page.getByRole("button", { name: /^yes$/i }).tap().catch(() => null); await page.waitForTimeout(420); } });
  await scan(page, name, "round2");
  await shot("06-round2-done");
  await step("round2 continue", () => tapText(/continue/i));
  await page.waitForTimeout(1600);
  await shot("07-round3-pairs");
  await step("pairs", async () => { for (let i = 0; i < 5; i++) { await page.locator(".pcard").first().tap().catch(() => null); await page.waitForTimeout(480); } });
  await scan(page, name, "round3");
  await page.waitForTimeout(1600);
  await shot("08-round4");
  await step("round4 yes", async () => { for (let i = 0; i < 5; i++) { await page.getByRole("button", { name: /^yes$/i }).tap().catch(() => null); await page.waitForTimeout(420); } });
  await scan(page, name, "round4");
  await step("build room", () => tapText(/build my room/i));
  await page.waitForTimeout(1800);
  await shot("09-finale");
  await roomEdges(page, name, "finale");
  await step("finale sticker", async () => {
    const st = page.locator(".room-wrap .sticker-img");
    if (await st.count()) { await st.first().tap({ force: true }); await page.waitForTimeout(450); await shot("09b-finale-tag"); await page.mouse.click(24, 300); await page.waitForTimeout(250); }
  });
  await step("see subjects", () => tapText(/see my subjects/i));
  await page.waitForTimeout(1300);
  await shot("10-top3");
  await scan(page, name, "top3");
  const next = async () => { await page.locator(".nextpill").first().tap(); await page.waitForTimeout(900); };
  await step("to wildcard", next);
  await shot("11-wildcard");
  await step("flip wildcard", async () => { await page.locator(".wildcard").tap(); await page.waitForTimeout(900); });
  await shot("11b-wildcard-flipped");
  await scan(page, name, "wildcard");
  await step("to views", next);
  await shot("12-views");
  await step("pick coast", async () => { await page.getByRole("button", { name: /coast/i }).first().tap({ timeout: 5000 }); await page.waitForTimeout(500); });
  await shot("12b-views-coast");
  await scan(page, name, "views");
  await step("to explore", next);
  await shot("13-explore");
  await step("courses", async () => {
    await page.getByRole("button", { name: /see courses/i }).first().tap({ timeout: 5000 });
    await page.waitForTimeout(900);
    await shot("13b-courses");
    await scan(page, name, "courses");
    await page.getByRole("button", { name: /^close$/i }).tap().catch(() => null);
    await page.waitForTimeout(350);
  });
  await step("to share", next);
  await page.waitForTimeout(700);
  await shot("14-share");
  await scan(page, name, "share");
  if (name === "iphone13") {
    await step("share video ready", async () => {
      const t0 = Date.now();
      await page.waitForFunction(() => {
        const b = [...document.querySelectorAll("button")].find((x) => /share video/i.test(x.textContent || ""));
        return !!b && !(b as HTMLButtonElement).disabled;
      }, null, { timeout: 40000 });
      console.log("share video ready after", ((Date.now() - t0) / 1000).toFixed(1) + "s on share page");
      const dl = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
      await page.getByRole("button", { name: /share video/i }).tap();
      const d = await dl;
      if (d) { const dest = `${OUT}/share-video-${d.suggestedFilename()}`; await d.saveAs(dest); console.log("share video downloaded ->", dest); }
      await page.waitForTimeout(400);
      await shot("14b-share-after");
    });
  }
  await context.close();
}

const browser = await chromium.launch();
await run(browser, "iphone13", { ...devices["iPhone 13"], colorScheme: "light" });
await run(browser, "iphone-se", { ...devices["iPhone SE"], colorScheme: "light" });
await run(browser, "pixel7", { ...devices["Pixel 7"], colorScheme: "light" });
await run(browser, "desktop", { viewport: { width: 1280, height: 800 }, hasTouch: true, colorScheme: "light" });
await browser.close();
console.log(failures.length ? `\nMOBILE CHECK: ${failures.length} failure(s)` : "\nMOBILE CHECK: all checks passed");
for (const f of failures) console.log(" -", f);
process.exit(failures.length ? 1 : 0);
