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
export const shareUrl = (d: ShareData) => `${window.location.origin}/r/${encodeShare(d)}`;

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
}

function thwipAt(ctx: AudioContext, dest: MediaStreamAudioDestinationNode, t: number) {
  const len = Math.floor(ctx.sampleRate * 0.09);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  src.connect(f).connect(g).connect(dest); src.start(t);
}

/** Render the 10-second 1080x1920 share video in real time from the room scene. */
export async function makeShareVideo(opts: {
  assigned: Assigned[]; viewId: string; viewTime: string; layout: Layout;
  topNames: string[]; wildcardName: string | null; shortUrl: string;
}): Promise<{ blob: Blob; ext: string }> {
  const W = 1080, H = 1920, k = W / ROOM_W;
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const [viewImg, roomImg] = await Promise.all([
    loadImg(`/views/${opts.viewId}_${opts.viewTime}.webp`), loadImg("/room/room.png")]);
  const stickerImgs = new Map<string, HTMLImageElement>();
  for (const a of opts.assigned) stickerImgs.set(a.code, await loadImg(`/stickers/${a.code}.webp`));

  const audioCtx = new AudioContext();
  const audioDest = audioCtx.createMediaStreamDestination();
  const n = Math.max(1, opts.assigned.length);
  opts.assigned.forEach((_, i) => thwipAt(audioCtx, audioDest, audioCtx.currentTime + 1 + (i * 4) / n));

  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...audioDest.stream.getAudioTracks()]);
  const mime = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<{ blob: Blob; ext: string }>((resolve) => {
    rec.onstop = () => resolve({ blob: new Blob(chunks, { type: mime || "video/webm" }), ext: mime.includes("mp4") ? "mp4" : "webm" });
  });

  const win = opts.layout.window;
  function draw(t: number) {
    ctx.fillStyle = "#1E1830"; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(viewImg, win.x * k, win.y * k, win.w * k, win.y * k * 0 + win.h * k);
    ctx.drawImage(roomImg, 0, 0, W, H);
    ctx.fillStyle = "#FBF6EE"; ctx.font = "900 54px Fraunces, Georgia, serif";
    ctx.fillText("Inkling", 44, 84);
    opts.assigned.forEach((a, i) => {
      const start = 1 + (i * 4) / n, p = Math.min(1, Math.max(0, (t - start) / 0.35));
      if (p <= 0) return;
      const img = stickerImgs.get(a.code); if (!img) return;
      const scale = p < 0.7 ? 0.6 + (p / 0.7) * 0.48 : 1.08 - ((p - 0.7) / 0.3) * 0.08;
      const w = a.w * k * scale, h = a.h * k * scale;
      ctx.globalAlpha = p;
      ctx.drawImage(img, (a.x + a.w / 2) * k - w / 2, (a.y + a.h) * k - h - 40 * (1 - p) * k, w, h);
      ctx.globalAlpha = 1;
    });
    if (t >= 5) {
      opts.topNames.slice(0, 3).forEach((name, i) => {
        const p = Math.min(1, Math.max(0, (t - 5 - i) / 0.3)); if (p <= 0) return;
        const y = H - 560 + i * 168;
        ctx.save(); ctx.globalAlpha = p; ctx.translate(0, (1 - p) * 40);
        ctx.fillStyle = "#FBF6EE"; ctx.beginPath(); ctx.roundRect(44, y, W - 88, 148, 22); ctx.fill();
        ctx.fillStyle = "#2A2238"; ctx.font = "900 52px Fraunces, Georgia, serif";
        ctx.fillText(name.slice(0, 26), 76, y + 92); ctx.restore();
      });
    }
    if (t >= 8 && t < 9.3) {
      const p = Math.min(1, (t - 8) / 1.3), flip = Math.cos(p * Math.PI);
      ctx.save(); ctx.translate(W / 2, 760); ctx.scale(Math.max(0.08, Math.abs(flip)), 1);
      ctx.fillStyle = "#FBF6EE"; ctx.beginPath(); ctx.roundRect(-260, -340, 520, 680, 26); ctx.fill();
      ctx.fillStyle = flip > 0 ? "#C9B8E8" : "#2A2238"; ctx.font = "900 90px Fraunces, Georgia, serif"; ctx.textAlign = "center";
      ctx.fillText(flip > 0 ? "?" : (opts.wildcardName || "Wildcard").slice(0, 16), 0, 30); ctx.restore(); ctx.textAlign = "left";
    }
    if (t >= 9.3) {
      ctx.fillStyle = "#FBF6EE"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#2A2238"; ctx.font = "900 92px Fraunces, Georgia, serif"; ctx.textAlign = "center";
      ctx.fillText("What's your inkling?", W / 2, 900);
      ctx.font = "400 44px Figtree, Arial"; ctx.fillText(opts.shortUrl.replace(/^https?:\/\//, ""), W / 2, 990);
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
