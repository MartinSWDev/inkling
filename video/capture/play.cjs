const { chromium, devices } = require('playwright');
const startCast = require('./cast.cjs');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: +(process.env.DPR||2) });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript((noRec) => {
    if (noRec) window.MediaRecorder = undefined;
    window.__shared = [];
    navigator.canShare = () => true;
    navigator.share = async (d) => {
      for (const f of (d.files || [])) {
        const buf = await f.arrayBuffer(); let s = ''; const u = new Uint8Array(buf);
        for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
        window.__shared.push({ name: f.name, type: f.type, b64: btoa(s), text: d.text });
      }
      await new Promise(r => setTimeout(r, 1500));
    };
  }, !!process.env.NOREC);
  const W = (ms) => p.waitForTimeout(ms);
  const taps = [];
  let cast;
  const tapAt = async (x, y, label) => { cast.mark('tap:' + label); taps.push({ label, x, y }); await p.mouse.click(x, y); };
  const tapEl = async (loc, label) => { const bb = await loc.first().boundingBox(); await tapAt(bb.x + bb.width / 2, bb.y + bb.height / 2, label); };
  const btn = (re) => p.getByRole('button', { name: re });
  const names = () => p.evaluate(() => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && r.bottom > 0 && r.top < innerHeight && getComputedStyle(b).visibility != 'hidden'; }).map(b => (b.getAttribute('aria-label') || b.textContent || '').trim()));
  const swipe = async (dx, dy, label) => {
    const c = p.locator('.card.swipe').first(); if (!(await c.count())) { console.log('NO CARD', (await names()).join('|'), await p.evaluate(()=>[...document.querySelectorAll('[class*=card]')].map(e=>e.className).slice(0,12).join(','))); await p.screenshot({path:'nocard.png'}); return; } const bb = await c.boundingBox({timeout:3000}).catch(()=>null); if (!bb) { console.log('card no box'); return; }
    const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
    cast.mark('swipe:' + label); taps.push({ label: 'swipe:' + label, x, y, dx, dy });
    await p.mouse.move(x, y); await p.mouse.down();
    for (let i = 1; i <= 14; i++) { await p.mouse.move(x + dx * i / 14, y + dy * i / 14); await W(22); }
    await p.mouse.up();
  };

  await p.goto('http://127.0.0.1:4173/'); await W(2500);
  cast = await startCast(p, process.env.OUT||'f_phone', { maxWidth: 780, maxHeight: 1688 });
  cast.mark('landing'); await W(2600);
  await tapEl(btn(/find my subjects/i), 'find'); cast.mark('unfold'); await W(3200);
  cast.mark('intro'); await W(1200);
  await tapEl(btn(/let's go/i), 'letsgo'); await W(3200);
  cast.mark('round1');
  for (const s of ['Maths', 'Physics', 'Computing']) { await tapEl(p.getByText(s, { exact: true }), 'chip:' + s); await W(650); }
  await tapEl(btn(/add another subject/i), 'add'); await W(700);
  const inp = p.locator('.chipsheet input, .other input').first();
  cast.mark('typing'); await inp.focus(); await inp.type('psychology', { delay: 110 }); await W(900);
  const sug = p.locator('.suggestchip'); if (await sug.count()) { await tapEl(sug.first(), 'suggest'); } await W(1200);
  cast.mark('typed-done');
  await tapEl(btn(/^continue$/i), 'continue1'); cast.mark('r1-drop'); await W(3600);
  cast.mark('round2');
  let i = 0;
  while (!(await names()).some(x => /^continue$/i.test(x)) && i < 14) { await swipe(i % 3 === 2 ? -230 : 230, 0, 'r2-' + i); await W(950); i++; }
  await W(500); await tapEl(btn(/^continue$/i), 'continue2'); cast.mark('r2-drop'); await W(3600);
  cast.mark('round3');
  for (let k = 0; k < 20; k++) {
    const ns = await names(); if (!ns.some(x => /can't decide/i.test(x))) break;
    const opts = p.locator('button:visible').filter({ hasNotText: /can't decide|sound/i });
    await tapEl(opts.nth(k % 2), 'pair-' + k); await W(k < 4 ? 1250 : 800);
  }
  cast.mark('r3-end'); await W(3200);
  cast.mark('round4');
  for (let k = 0; k < 14; k++) {
    const ns = await names();
    if (ns.some(x => /build my room/i.test(x)) || ns.some(x => /^continue$/i.test(x))) break;
    if (k === 1) await swipe(0, -260, 'r4-up'); else await swipe(k % 3 === 2 ? -230 : 230, 0, 'r4-' + k);
    await W(k < 3 ? 2200 : 1100);
  }
  const bm = btn(/build my room/i);
  if (await bm.count()) await tapEl(bm, 'build'); else await tapEl(btn(/^continue$/i), 'continue4');
  cast.mark('finale'); await W(4500);
  const st = p.locator('.sticker-img');
  for (const idx of [2, 5]) { if (await st.count() > idx) { await tapEl(st.nth(idx), 'sticker'); cast.mark('tag'); await W(2300); } }
  await p.mouse.click(30, 700); await W(600);
  await tapEl(btn(/see my subjects/i), 'see'); cast.mark('top3'); await W(4200);
  const next = async (label) => { const nx = p.locator('button:visible').filter({ hasText: /^\s*(Next|Share)\s*$/ }); await tapEl(nx.last(), label); };
  await next('next-wild'); cast.mark('wildcard'); await W(1600);
  const wc = p.locator('.wildcard'); if (await wc.count()) { await tapEl(wc, 'flip'); cast.mark('flip'); } await W(3000);
  await next('next-routes'); cast.mark('routes'); await W(2800);
  await p.mouse.wheel(0, 300); await W(1500);
  for (let k = 0; k < 6; k++) {
    const ns = await names();
    const txt = await p.evaluate(() => (document.querySelector('.page.on')?.innerText || '').slice(0, 60).replace(/\n/g, ' '));
    console.log('PAGE', k, txt, '|', ns.join(' | '));
    if (ns.some(x => /share video/i.test(x))) break;
    if (ns.some(x => /see courses/i.test(x))) {
      cast.mark('explore'); await W(2200);
      await tapEl(btn(/see courses/i), 'courses'); cast.mark('courses'); await W(2600);
      console.log('SHEET', (await names()).join(' | '));
      fs.writeFileSync('sheet.txt', await p.evaluate(() => document.querySelector('.coursesheet')?.innerText || 'none'));
      await p.mouse.move(195, 600); await p.mouse.wheel(0, 260); await W(1600);
      const ap = p.locator('button:visible', { hasText: /^\s*Apprenticeships\s*$/ }); if (await ap.count()) { await tapEl(ap, 'tab-appr'); cast.mark('sheet-appr'); await W(2400); }
      const close = p.locator('button:visible[aria-label="Close courses"], button:visible:has-text("Close")'); if (await close.count()) { await tapEl(close, 'close'); } await W(1000);
    }
    if (ns.some(x => /^city$/i.test(x)) && ns.some(x => /campus town/i.test(x)) && !ns.some(x => /see courses/i.test(x))) { cast.mark('views'); await W(1200); await tapEl(p.locator('button:visible', { hasText: /^\s*Coast\s*$/ }), 'view-coast'); await W(1800); }
    await next('next-' + k); await W(2200);
  }
  cast.mark('share');
  if (process.env.NOREC) { const r = await cast.stop(); console.log(JSON.stringify({frames:r.frames,dur:r.dur})); fs.writeFileSync('tapsB.json', JSON.stringify(taps, null, 1)); await b.close(); return; }
  for (let k = 0; k < 40; k++) { if (!(await btn(/share video/i).first().isDisabled())) break; await W(500); }
  await W(1500);
  await tapEl(btn(/share video/i), 'sharevideo'); cast.mark('shared'); await W(2500);
  const sh = await p.evaluate(() => window.__shared);
  for (const f of sh) { fs.writeFileSync('shared_' + f.name, Buffer.from(f.b64, 'base64')); console.log('saved', f.name, f.type); }
  fs.writeFileSync('taps.json', JSON.stringify(taps, null, 1));
  fs.writeFileSync('state.json', JSON.stringify({ errs }, null, 1));
  const r = await cast.stop(); console.log(JSON.stringify(r));
  await p.screenshot({ path: 'end.png' });
  await b.close();
})();
