import { useEffect, useRef, useState, type CSSProperties } from "react";

export type StickerEntry = { code: string; slot: string; size: string; w: number; h: number; label?: string };
export type Spot = { slot: string; anchor: [number, number]; max: [number, number]; z: number };
export type Layout = { window: { x: number; y: number; w: number; h: number }; spots: Record<string, Spot> };
export type Assigned = { code: string; spot: string; x: number; y: number; w: number; h: number; z: number; slot: string };

export const ROOM_W = 1152;
export const ROOM_H = 2048;
const SCALE: Record<string, number> = { small: 0.6, medium: 0.8, large: 1.0 };

export function useRoomAssets() {
  const [assets, setAssets] = useState<{ layout: Layout; stickers: Record<string, StickerEntry> } | null>(null);
  useEffect(() => {
    Promise.all([fetch("/room/layout.json").then((r) => r.json()), fetch("/stickers/stickers.json").then((r) => r.json())])
      .then(([layout, list]) => setAssets({ layout, stickers: Object.fromEntries((list as StickerEntry[]).map((s) => [s.code, s])) }))
      .catch(() => setAssets(null));
  }, []);
  return assets;
}

function overlap(a: Assigned, b: Assigned) {
  const iw = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const ih = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return (iw * ih) / Math.min(a.w * a.h, b.w * b.h);
}

export function assignStickers(codes: string[], stickers: Record<string, StickerEntry>, layout: Layout, boost = 1): Assigned[] {
  const placed: Assigned[] = [];
  const used = new Set<string>();
  for (const code of codes) {
    const entry = stickers[code];
    if (!entry) { console.log("no sticker for", code); continue; }
    let done = false;
    for (const [name, spot] of Object.entries(layout.spots)) {
      if (spot.slot !== entry.slot || used.has(name)) continue;
      const scale = Math.min(spot.max[0] / entry.w, spot.max[1] / entry.h) * (SCALE[entry.size] ?? 0.8) * boost;
      const cand: Assigned = { code, spot: name, x: spot.anchor[0] - (entry.w * scale) / 2, y: spot.anchor[1] - entry.h * scale,
        w: entry.w * scale, h: entry.h * scale, z: spot.z, slot: entry.slot };
      if (placed.some((p) => overlap(cand, p) > 0.5)) continue;
      placed.push(cand); used.add(name); done = true; break;
    }
    if (!done) console.log("no free spot for", code, entry.slot);
  }
  return placed;
}

const pct = (v: number, total: number) => (v / total * 100) + "%";

const BAND_TOP = 0.18;
const BAND_BOTTOM = 0.96;

export function RoomView({ assigned, viewId, viewTime, band = false }: {
  assigned: Assigned[]; viewId: string; viewTime: string; band?: boolean;
}) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => { fetch("/room/layout.json").then((r) => r.json()).then(setLayout).catch(() => null); }, []);
  useEffect(() => {
    if (!band || !stackRef.current?.parentElement) return;
    const parent = stackRef.current.parentElement;
    const measure = () => setBox({ w: parent.clientWidth, h: parent.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [band, layout]);
  if (!layout) return <div className="room-stack" ref={stackRef} />;
  const win = layout.window;
  // Band mode: fill the width, cropping the room to shelves-to-floor (y 18%-96%).
  // Sticker coordinates stay in the same 1152x2048 room space.
  let bandStyle: CSSProperties | undefined;
  if (band && box.w > 0) {
    const bandH = (BAND_BOTTOM - BAND_TOP) * ROOM_H;
    const s = Math.max(box.w / ROOM_W, box.h / bandH);
    const x = (box.w - ROOM_W * s) / 2;
    const y = -BAND_TOP * ROOM_H * s - Math.max(0, bandH * s - box.h) / 2;
    bandStyle = { width: ROOM_W, height: ROOM_H, transform: `translate(${x}px, ${y}px) scale(${s})`, transformOrigin: "0 0" };
  }
  return (
    <div className={"room-stack" + (band ? " band" : "")} ref={stackRef} style={bandStyle}>
      <img className="view-img" src={"/views/" + viewId + "_" + viewTime + ".webp"} alt=""
        style={{ left: pct(win.x, ROOM_W), top: pct(win.y, ROOM_H), width: pct(win.w, ROOM_W), height: pct(win.h, ROOM_H) }} />
      <img className="room-top" src="/room/room.png" alt="Your room" />
      {[...assigned].sort((a, b) => a.z - b.z).map((a) => (
        <span key={a.code}>
          {a.slot !== "wall"
            ? <span className="sticker-shadow" style={{ left: pct(a.x + a.w * 0.12, ROOM_W), top: pct(a.y + a.h - 6, ROOM_H), width: pct(a.w * 0.76, ROOM_W) }} />
            : <img className="sticker-dropshadow" src={"/stickers/" + a.code + ".webp"} alt=""
                style={{ left: pct(a.x + 6, ROOM_W), top: pct(a.y + 9, ROOM_H), width: pct(a.w, ROOM_W), height: pct(a.h, ROOM_H) }} />}
          <img className="sticker-img" src={"/stickers/" + a.code + ".webp"} alt=""
            style={{ left: pct(a.x, ROOM_W), top: pct(a.y, ROOM_H), width: pct(a.w, ROOM_W), height: pct(a.h, ROOM_H), zIndex: a.z }} />
        </span>
      ))}
      {viewTime === "dusk" && <span className="dusk-wash" />}
    </div>
  );
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
}

export async function composeRoomCanvas(assigned: Assigned[], viewId: string, viewTime: string, layout: Layout) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080; canvas.height = 1920;
  const ctx = canvas.getContext("2d")!;
  const k = 1080 / ROOM_W;
  const view = await loadImg("/views/" + viewId + "_" + viewTime + ".webp");
  ctx.drawImage(view, layout.window.x * k, layout.window.y * k, layout.window.w * k, layout.window.h * k);
  ctx.drawImage(await loadImg("/room/room.png"), 0, 0, 1080, 1920);
  for (const a of [...assigned].sort((x, y) => x.z - y.z)) {
    const img = await loadImg("/stickers/" + a.code + ".webp");
    ctx.drawImage(img, a.x * k, a.y * k, a.w * k, a.h * k);
  }
  return canvas;
}

export function download(canvas: HTMLCanvasElement, name: string) {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png"); a.download = name; a.click();
}
