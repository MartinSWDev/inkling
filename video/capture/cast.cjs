// Screencast helper: collects JPEG frames with timestamps from CDP.
const fs = require('fs'), path = require('path');
module.exports = async function startCast(page, dir, { maxWidth, maxHeight }) {
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = []; let n = 0; const marks = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const file = path.join(dir, String(n++).padStart(6, '0') + '.jpg');
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth, maxHeight, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  return {
    mark: (name) => { marks.push({ name, t: Date.now() / 1000 }); console.log('mark', name, (Date.now() / 1000 - t0).toFixed(2)); },
    stop: async () => {
      await new Promise(r => setTimeout(r, 400));
      await cdp.send('Page.stopScreencast');
      const start = frames[0].t;
      // concat list with per-frame durations -> CFR later
      let list = '';
      for (let i = 0; i < frames.length; i++) {
        const d = i + 1 < frames.length ? frames[i + 1].t - frames[i].t : 0.5;
        list += `file '${frames[i].file}'\nduration ${Math.max(d, 0.001).toFixed(4)}\n`;
      }
      list += `file '${frames[frames.length - 1].file}'\n`;
      fs.writeFileSync(path.join(dir, 'list.txt'), list);
      const m = marks.map(x => ({ name: x.name, s: +(x.t - start).toFixed(3) }));
      fs.writeFileSync(path.join(dir, 'marks.json'), JSON.stringify(m, null, 1));
      return { frames: frames.length, dur: frames[frames.length - 1].t - start, marks: m };
    }
  };
};
