/** Share links: the whole result in the URL (codes only, no personal data). */
import type { Assigned, Layout } from "./Room";
import { ROOM_H, ROOM_W } from "./Room";

export type ShareData = { t: string[]; w: string | null; v: string; vt: string; r: string[] };

export function encodeShare(d: ShareData): string {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(d))));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodeShare(code: string): ShareData | null {
  try {
    const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
    const d = JSON.parse(decodeURIComponent(escape(atob(b64)))) as ShareData;
    if (!Array.isArray(d.t) || !Array.isArray(d.r)) return null;
    return { t: d.t.slice(0, 3), w: d.w ?? null, v: d.v || "campus", vt: d.vt || "day", r: d.r.slice(0, 8) };
  } catch { return null; }
}
/** Short domain printed on the video end card (the full /r/<code> link
 * only ever goes in the share text, never in the video). */
export const SHORT_DOMAIN = "myinkling.com";

/** Canonical share link on the production domain, wherever it is copied from. */
export const shareUrl = (d: ShareData) => `https://${SHORT_DOMAIN}/r/${encodeShare(d)}`;

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
}

import { createKit } from "./design/kit";

/** Bake the shared sound kit into a 10s buffer with an OfflineAudioContext,
 * so the video's soundtrack is sample-accurate whatever the live context does. */
async function renderKitTrack(assignedCount: number, hasWildcard: boolean): Promise<AudioBuffer> {
  const sr = 44100;
  const off = new OfflineAudioContext(2, sr * 10, sr);
  const kit = createKit(off, off.destination);
  for (let i = 0; i < assignedCount; i++) kit.pop(0.4 + i * 0.35, i);
  for (let j = 0; j < 3; j++) { kit.whoosh(3.5 + j * 1.16); kit.marimba(3.55 + j * 1.16, j); }
  if (hasWildcard) kit.wildcard(7.05);
  kit.endChord(8.6);
  return off.startRendering();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (ctx.measureText(next).width > maxW && cur) { lines.push(cur); cur = w; if (lines.length === maxLines) break; }
    else cur = next;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = last.trimEnd() + "…";
  }
  return lines;
}

/** Fit a name on a card: shrink Fraunces from `start` until it wraps to at most 3 lines. */
function fitName(ctx: CanvasRenderingContext2D, name: string, maxW: number, start = 84): { lines: string[]; size: number } {
  for (let size = start; size >= 34; size -= 6) {
    ctx.font = `900 ${size}px Fraunces, Georgia, serif`;
    const lines = wrapLines(ctx, name, maxW, 3);
    if (lines.length <= 3 && lines.every((l) => ctx.measureText(l).width <= maxW)) return { lines, size };
  }
  ctx.font = "900 34px Fraunces, Georgia, serif";
  return { lines: wrapLines(ctx, name, maxW, 3), size: 34 };
}

/** Render the 10-second 1080x1920 share video in real time from the room scene.
 * Storyboard (prompts/11 F): hook tag + fast sticker drops, one big moment
 * per top-3 subject, wildcard flip, end card on the dimmed room. */
export async function makeShareVideo(opts: {
  assigned: Assigned[]; viewId: string; viewTime: string; layout: Layout;
  top: { code: string; name: string }[]; wildcard: { code: string; name: string } | null; shortUrl: string;
}): Promise<{ blob: Blob; ext: string }> {
  const W = 1080, H = 1920, k = W / ROOM_W;
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const [viewImg, roomImg] = await Promise.all([
    loadImg(`/views/${opts.viewId}_${opts.viewTime}.webp`), loadImg("/room/room.webp")]);
  const stickerImgs = new Map<string, HTMLImageElement>();
  for (const a of opts.assigned) stickerImgs.set(a.code, await loadImg(`/stickers/${a.code}.webp`));
  if (opts.wildcard && !stickerImgs.has(opts.wildcard.code))
    stickerImgs.set(opts.wildcard.code, await loadImg(`/stickers/${opts.wildcard.code}.webp`).catch(() => null as unknown as HTMLImageElement));

  // Soundtrack: the shared kit, baked offline, then streamed with the canvas.
  const audioCtx = new AudioContext();
  const audioDest = audioCtx.createMediaStreamDestination();
  try {
    const buf = await renderKitTrack(opts.assigned.length, !!opts.wildcard);
    const src = audioCtx.createBufferSource(); src.buffer = buf; src.connect(audioDest);
    void audioCtx.resume();
    src.start();
  } catch { /* silent video if WebAudio is unavailable */ }

  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...audioDest.stream.getAudioTracks()]);
  const mime = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<{ blob: Blob; ext: string }>((resolve) => {
    rec.onstop = () => resolve({ blob: new Blob(chunks, { type: mime || "video/webm" }), ext: mime.includes("mp4") ? "mp4" : "webm" });
  });

  const win = opts.layout.window;
  const byCode = new Map(opts.assigned.map((a) => [a.code, a]));
  const stickerStart = (i: number) => 0.4 + i * 0.35;
  const paper = (x: number, y: number, w: number, h: number, r = 22) => {
    ctx.fillStyle = "#FBF6EE"; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
    ctx.strokeStyle = "#ddd2c2"; ctx.lineWidth = 2; ctx.stroke();
  };
  function drawScene(t: number, push: { a: Assigned; p: number } | null) {
    // Camera push toward the featured subject's sticker (top-3 moments).
    ctx.save();
    if (push) {
      const fx = (push.a.x + push.a.w / 2) * k, fy = (push.a.y + push.a.h / 2) * k;
      const z = 1 + 0.12 * push.p;
      ctx.translate(fx, fy); ctx.scale(z, z); ctx.translate(-fx, -fy);
    }
    ctx.fillStyle = "#1E1830"; ctx.fillRect(-200, -200, W + 400, H + 400);
    ctx.drawImage(viewImg, win.x * k, win.y * k, win.w * k, win.h * k);
    ctx.drawImage(roomImg, 0, 0, W, H);
    opts.assigned.forEach((a, i) => {
      const p = Math.min(1, Math.max(0, (t - stickerStart(i)) / 0.3));
      if (p <= 0) return;
      const img = stickerImgs.get(a.code); if (!img) return;
      const featured = push?.a.code === a.code;
      const scale = (p < 0.7 ? 0.6 + (p / 0.7) * 0.48 : 1.08 - ((p - 0.7) / 0.3) * 0.08) * (featured ? 1 + 0.1 * push.p : 1);
      const w = a.w * k * scale, h = a.h * k * scale;
      const lift = featured ? 14 * push.p : 0;
      ctx.save();
      ctx.globalAlpha = p;
      if (featured) { ctx.shadowColor = "rgba(243,217,139,.95)"; ctx.shadowBlur = 46 * push.p; }
      ctx.drawImage(img, (a.x + a.w / 2) * k - w / 2, (a.y + a.h) * k - h - 40 * (1 - p) * k - lift, w, h);
      ctx.restore();
    });
    ctx.restore();
    // Wordmark paper label, top-left throughout.
    paper(36, 36, 252, 76, 14);
    ctx.fillStyle = "#2A2238"; ctx.font = "900 46px Fraunces, Georgia, serif"; ctx.textAlign = "left";
    ctx.fillText("Inkling", 58, 88);
  }
  function draw(t: number) {
    // Which top-3 moment are we in (3.5-7.0s, one per ~1.16s)?
    let push: { a: Assigned; p: number } | null = null;
    let moment = -1;
    if (t >= 3.5 && t < 7.0) {
      moment = Math.min(2, Math.floor((t - 3.5) / 1.16));
      const a = byCode.get(opts.top[moment]?.code || "");
      if (a) push = { a, p: Math.min(1, (t - 3.5 - moment * 1.16) / 0.45) };
    }
    drawScene(t, push);
    // Hook tag (0-2.5s).
    if (t < 2.5) {
      const p = Math.min(1, t / 0.25);
      ctx.save(); ctx.globalAlpha = p; ctx.translate(W / 2, 150 + (1 - p) * -16);
      const label = "Filling my room with what I'm into…";
      ctx.font = "700 40px Fraunces, Georgia, serif";
      const tw = ctx.measureText(label).width + 56;
      ctx.translate(-tw / 2, -52); paper(0, 0, tw, 84, 16);
      ctx.fillStyle = "#2A2238"; ctx.fillText(label, 28, 56); ctx.restore();
    }
    // Top-3 cards (3.5-8.6s): identical cards on a fixed grid in the lower
    // third — same x, width and height, evenly spaced; sticker in a fixed
    // square on the left, name vertically centred beside it.
    if (t >= 3.5 && t < 8.6) {
      const shown = moment >= 0 ? moment + 1 : 3;
      const cardW = W - 88, cardH = 168, cardX = 44, gap = 20;
      const gridTop = H - 96 - (cardH * 3 + gap * 2);
      for (let j = 0; j < shown; j++) {
        const subj = opts.top[j]; if (!subj) continue;
        const start = 3.5 + j * 1.16;
        const p = Math.min(1, Math.max(0, (t - start) / 0.35));
        if (p <= 0) continue;
        const x = cardX, y = gridTop + j * (cardH + gap) + (1 - p) * 36;
        ctx.save(); ctx.globalAlpha = p;
        paper(x, y, cardW, cardH, 26);
        const img = stickerImgs.get(subj.code);
        if (img) {
          const box = 124, bx = x + 22, by = y + (cardH - box) / 2;
          const s = Math.min(box / img.width, box / img.height);
          ctx.drawImage(img, bx + (box - img.width * s) / 2, by + (box - img.height * s) / 2, img.width * s, img.height * s);
        }
        const { lines, size } = fitName(ctx, subj.name, cardW - 196, 76);
        ctx.fillStyle = "#2A2238"; ctx.font = `900 ${size}px Fraunces, Georgia, serif`;
        const blockH = lines.length * size * 1.08;
        lines.forEach((line, li) => ctx.fillText(line, x + 168, y + cardH / 2 - blockH / 2 + size * 0.82 + li * (size * 1.08)));
        ctx.restore();
      }
    }
    // Wildcard flip (7.0-8.6s).
    if (t >= 7.0 && t < 8.6 && opts.wildcard) {
      const p = Math.min(1, (t - 7.0) / 0.7), flip = Math.cos(p * Math.PI);
      ctx.save(); ctx.translate(W / 2, 720); ctx.scale(Math.max(0.08, Math.abs(flip)), 1);
      paper(-290, -360, 580, 720, 28);
      ctx.textAlign = "center";
      if (flip > 0) {
        ctx.fillStyle = "#C9B8E8"; ctx.font = "900 190px Fraunces, Georgia, serif"; ctx.fillText("?", 0, 70);
      } else {
        const img = stickerImgs.get(opts.wildcard.code);
        if (img) ctx.drawImage(img, -130, -320, 260, 260);
        const { lines, size } = fitName(ctx, opts.wildcard.name, 500, 64);
        ctx.fillStyle = "#2A2238"; ctx.font = `900 ${size}px Fraunces, Georgia, serif`;
        lines.forEach((line, li) => ctx.fillText(line, 0, 60 + li * (size * 1.08)));
        ctx.fillStyle = "#5a3600"; ctx.font = "700 36px Figtree, Arial";
        ctx.fillText("wildcard", 16, 300);
        ctx.save(); ctx.translate(-88, 288); ctx.beginPath();
        for (let s = 0; s < 10; s++) { const r = s % 2 ? 9 : 20, a = -Math.PI / 2 + s * Math.PI / 5; ctx[s ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fillStyle = "#e59a2c"; ctx.fill(); ctx.restore();
      }
      ctx.restore(); ctx.textAlign = "left";
      // Sparkles.
      ctx.save(); ctx.fillStyle = "#F3D98B";
      for (let s = 0; s < 10; s++) {
        const sx = W / 2 + Math.sin(s * 2.4 + t * 3) * (300 + s * 18), sy = 720 + Math.cos(s * 1.7 + t * 2.4) * (330 + s * 12);
        const r = 5 + 4 * Math.abs(Math.sin(t * 5 + s));
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // End card (8.6-10s): finished room, dimmed.
    if (t >= 8.6) {
      ctx.fillStyle = "rgba(30,24,48,.48)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#FBF6EE"; ctx.textAlign = "center";
      ctx.font = "900 108px Fraunces, Georgia, serif";
      const q = fitName(ctx, "What's your inkling?", W - 160, 108);
      q.lines.forEach((line, li) => ctx.fillText(line, W / 2, 860 + li * 116));
      ctx.font = "600 50px Figtree, Arial";
      ctx.fillText("Find yours at " + SHORT_DOMAIN, W / 2, 860 + q.lines.length * 116 + 30);
      ctx.textAlign = "left";
    }
  }

  rec.start(200);
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const frame = () => {
      const t = (performance.now() - t0) / 1000;
      draw(t);
      if (t < 10) requestAnimationFrame(frame); else resolve();
    };
    frame();
  });
  rec.stop();
  void audioCtx.close();
  return done;
}
