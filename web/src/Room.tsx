import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

export type StickerEntry = { code: string; slot: string; size: string; w: number; h: number; label?: string };
export type Spot = { slot: string; anchor: [number, number]; max: [number, number]; z: number };
export type Layout = { window: { x: number; y: number; w: number; h: number }; spots: Record<string, Spot>; tall?: { height: number; topOffset: number; file: string } };
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

export function assignStickers(codes: string[], stickers: Record<string, StickerEntry>, layout: Layout, boost = 1, floorLift = 0): Assigned[] {
  const placed: Assigned[] = [];
  const used = new Set<string>();
  for (const code of codes) {
    const entry = stickers[code];
    if (!entry) { console.log("no sticker for", code); continue; }
    let done = false;
    for (const [name, spot] of Object.entries(layout.spots)) {
      if (spot.slot !== entry.slot || used.has(name)) continue;
      const fit = Math.min(spot.max[0] / entry.w, spot.max[1] / entry.h);
      const scale = Math.min(fit * (SCALE[entry.size] ?? 0.8) * boost, fit);
      const w = entry.w * scale, h = entry.h * scale;
      // Desk stickers must sit wholly on the desk top (its right edge is ~x 1105).
      const maxX = entry.slot === "desk" ? Math.min(ROOM_W - w, 1105 - w) : ROOM_W - w;
      const cand: Assigned = { code, spot: name,
        x: Math.max(0, Math.min(maxX, spot.anchor[0] - w / 2)),
        y: Math.max(0, Math.min(ROOM_H - h, spot.anchor[1] - h - (entry.slot === "floor" ? floorLift : 0))),
        w, h, z: spot.z, slot: entry.slot };
      if (placed.some((p) => overlap(cand, p) > 0.5)) continue;
      placed.push(cand); used.add(name); done = true; break;
    }
    if (!done) console.log("no free spot for", code, entry.slot);
  }
  return placed;
}

const pct = (v: number, total: number) => (v / total * 100) + "%";

/** Sticker info tag: rendered, measured, then clamped inside the app with a
 * 12px margin. Flips below the sticker when there is no room above, with a
 * small pointer that keeps aiming at the sticker centre. */
function StickTag({ name, line, leftPct, topAbove, topBelow, belowFirst, anchorFrac }: {
  name: string; line?: string; leftPct: string; topAbove: string; topBelow: string; belowFirst: boolean;
  anchorFrac: { x: number };
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [adj, setAdj] = useState<{ dx: number; dy: number; flipped: boolean; px: number }>({ dx: 0, dy: 0, flipped: belowFirst, px: 50 });
  useLayoutEffect(() => {
    const tag = ref.current;
    if (!tag) return;
    const app = (tag.closest(".app") ?? tag.parentElement) as HTMLElement | null;
    if (!app) return;
    const r = tag.getBoundingClientRect();
    const ar = app.getBoundingClientRect();
    if (!adj.flipped && r.top < ar.top + 12) { setAdj((s) => ({ ...s, flipped: true, dx: 0, dy: 0 })); return; }
    let dx = 0, dy = 0;
    if (r.left < ar.left + 12) dx = ar.left + 12 - r.left;
    else if (r.right > ar.right - 12) dx = ar.right - 12 - r.right;
    if (r.bottom > ar.bottom - 12) dy = ar.bottom - 12 - r.bottom;
    if (r.top + dy < ar.top + 12) dy = ar.top + 12 - r.top;
    const stack = tag.parentElement?.parentElement?.getBoundingClientRect();
    const anchorX = stack ? stack.left + anchorFrac.x * stack.width : r.left + r.width / 2;
    const px = Math.max(16, Math.min(r.width - 16, anchorX - (r.left + dx)));
    if (Math.abs(dx - adj.dx) > 0.5 || Math.abs(dy - adj.dy) > 0.5 || Math.abs(px - adj.px) > 0.5)
      setAdj({ dx, dy, flipped: adj.flipped, px });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adj.flipped, name]);
  return (
    <span ref={ref} className={"sticktag" + (adj.flipped ? " flipped" : "")}
      style={{ left: leftPct, top: adj.flipped ? topBelow : topAbove, zIndex: 40, ["--px" as string]: adj.px + "px",
        transform: `translate(-50%, ${adj.flipped ? "10%" : "-112%"}) translate(${adj.dx}px, ${adj.dy}px) rotate(-1deg)` }}>
      <b>{name}</b>{line && <small>{line}</small>}
    </span>
  );
}

const BAND_TOP = 0.18;
const BAND_BOTTOM = 0.96;

export function RoomView({ assigned, viewId, viewTime, band = false, celebrate = false, highlight = null, dropCodes = [], liftCodes = [], onStickerTap, onEmptyTap, tapInfo = null, tall = false }: {
  assigned: Assigned[]; viewId: string; viewTime: string; band?: boolean; celebrate?: boolean; highlight?: string | null; dropCodes?: string[]; liftCodes?: string[];
  onStickerTap?: (code: string) => void; onEmptyTap?: () => void; tapInfo?: { code: string; name: string; line?: string } | null; tall?: boolean;
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
  // Tall phone room: same x, y shifted by the recorded top offset.
  const TH = tall && layout.tall ? layout.tall.height : ROOM_H;
  const OFF = tall && layout.tall ? layout.tall.topOffset : 0;
  const py = (v: number) => pct(v + OFF, TH);
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
    <div className={"room-stack" + (band ? " band" : "") + (tall ? " tall" : "")} ref={stackRef}
      style={{ ...bandStyle, pointerEvents: tapInfo ? "auto" : undefined }}
      onClick={onEmptyTap ? (e) => { if (!(e.target as HTMLElement).closest(".sticker-img")) onEmptyTap(); } : undefined}>
      <img className="view-img" src={"/views/" + viewId + "_" + viewTime + "_sm.webp"} alt="" fetchPriority="high"
        style={{ left: pct(win.x - win.w * 0.14, ROOM_W), top: py(win.y - win.h * 0.1), width: pct(win.w * 1.28, ROOM_W), height: pct(win.h * 1.28, TH) }} />
      <img className="room-top" src={tall && layout.tall ? layout.tall.file : "/room/room.webp"} alt="Your room" />
      {[...assigned].sort((a, b) => a.z - b.z).map((a, ai) => (
        <span key={a.code}>
          {a.slot !== "wall"
            ? <span className="sticker-shadow" style={{ left: pct(a.x + a.w * 0.12, ROOM_W), top: py(a.y + a.h - 6), width: pct(a.w * 0.76, ROOM_W) }} />
            : <img className="sticker-dropshadow" draggable={false} onDragStart={(e) => e.preventDefault()} src={"/stickers/" + a.code + ".webp"} alt=""
                style={{ left: pct(a.x + 6, ROOM_W), top: py(a.y + 9), width: pct(a.w, ROOM_W) }} />}
          <img className={"sticker-img" + (celebrate && !dropCodes.includes(a.code) ? " wiggle" : "") + (liftCodes.includes(a.code) || tapInfo?.code === a.code ? " lifted" : "")}
            draggable={false} onDragStart={(e) => e.preventDefault()}
            src={"/stickers/" + a.code + ".webp"} alt={onStickerTap ? a.code : ""}
            onClick={onStickerTap ? (e) => { e.stopPropagation(); onStickerTap(a.code); } : undefined}
            style={{ left: pct(a.x, ROOM_W), top: py(a.y), width: pct(a.w, ROOM_W), zIndex: a.z, animationDelay: dropCodes.includes(a.code) ? (dropCodes.indexOf(a.code) * 140) + "ms" : celebrate ? (ai * 120) + "ms" : undefined, pointerEvents: onStickerTap ? "auto" : "none", cursor: onStickerTap ? "pointer" : undefined }} />
          {highlight === a.code && <span className="plusflag" style={{ left: pct(a.x + a.w, ROOM_W), top: py(a.y), zIndex: a.z + 5 }}>+1</span>}
          {tapInfo?.code === a.code && (
            <StickTag name={tapInfo.name} line={tapInfo.line}
              leftPct={pct(a.x + a.w / 2, ROOM_W)} topAbove={py(a.y)} topBelow={py(a.y + a.h)}
              belowFirst={(a.y + OFF) / TH < 0.28} anchorFrac={{ x: (a.x + a.w / 2) / ROOM_W }} />)}
        </span>
      ))}
      {viewTime === "dusk" && <span className="dusk-wash" />}
    </div>
  );
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
}

export async function composeRoomCanvas(assigned: Assigned[], viewId: string, viewTime: string, layout: Layout, palUrl?: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080; canvas.height = 1920;
  const ctx = canvas.getContext("2d")!;
  const k = 1080 / ROOM_W;
  const view = await loadImg("/views/" + viewId + "_" + viewTime + ".webp");
  ctx.drawImage(view, (layout.window.x - layout.window.w * 0.14) * k, (layout.window.y - layout.window.h * 0.1) * k, layout.window.w * 1.28 * k, layout.window.h * 1.28 * k);
  ctx.drawImage(await loadImg("/room/room.webp"), 0, 0, 1080, 1920);
  for (const a of [...assigned].sort((x, y) => x.z - y.z)) {
    const img = await loadImg("/stickers/" + a.code + ".webp");
    ctx.drawImage(img, a.x * k, a.y * k, a.w * k, a.h * k);
  }
  if (palUrl) {
    // The live paper pal on a small paper card, bottom-right.
    try {
      const pal = await loadImg(palUrl);
      const cardW = 300, cardH = 330, x = 1080 - cardW - 36, y = 1920 - cardH - 36;
      ctx.save();
      ctx.fillStyle = "#fbf6ee";
      ctx.strokeStyle = "#ddd2c2";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 18);
      ctx.fill();
      ctx.stroke();
      ctx.clip();
      ctx.drawImage(pal, x + 12, y + 12, cardW - 24, cardW - 24);
      ctx.restore();
    } catch { /* the share image is fine without the pal */ }
  }
  return canvas;
}

export function download(canvas: HTMLCanvasElement, name: string) {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png"); a.download = name; a.click();
}
